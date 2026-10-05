using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Data;
using DigiAlert.Api.Models;
using DigiAlert.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.RateLimiting;

namespace DigiAlert.Api.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        public UsersController(AppDbContext context, IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        private Guid GetCompanyUserIdFromToken()
        {
            var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (string.IsNullOrEmpty(userIdString))
                throw new Exception("Impossible de lire le Token de sécurité.");

            return Guid.Parse(userIdString);
        }

        private Guid GetRealUserIdFromToken()
        {
            var realId = User.FindFirstValue("RealUserId");
            if (!string.IsNullOrEmpty(realId))
                return Guid.Parse(realId);

            return GetCompanyUserIdFromToken();
        }

        private async Task<Guid> GetRootCompanyIdAsync()
        {
            Guid loggedInUserId = GetCompanyUserIdFromToken();
            var currentUser = await _context.Users.FindAsync(loggedInUserId);

            if (currentUser == null) throw new Exception("Utilisateur introuvable.");

            return currentUser.Role == "Owner" ? currentUser.IdUser : currentUser.ParentId ?? loggedInUserId;
        }

        // 1. GET: api/Users/profile
        [HttpGet("profile")]
        public async Task<ActionResult> GetMyProfile()
        {
            Guid realUserId = GetRealUserIdFromToken();
            Guid companyUserId = GetCompanyUserIdFromToken();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.IdUser == realUserId);
            var company = await _context.Users.FirstOrDefaultAsync(u => u.IdUser == companyUserId);

            if (user == null || company == null) return NotFound("Utilisateur introuvable.");

            string maskedSmsKey = string.IsNullOrWhiteSpace(company.ApiKey)
                ? ""
                : $"********{company.ApiKey.Substring(Math.Max(0, company.ApiKey.Length - 4))}";

            string maskedEmailKey = string.IsNullOrWhiteSpace(company.EmailApiKey)
                ? ""
                : $"********{company.EmailApiKey.Substring(Math.Max(0, company.EmailApiKey.Length - 4))}";

            return Ok(new
            {
                idUser = user.IdUser,
                kioskToken = company.KioskToken,
                companyName = company.CompanyName,
                email = user.Email,
                role = user.Role,
                senderId = company.SenderId,
                apikey = maskedSmsKey,
                emailSender = company.EmailSender,
                emailApiKey = maskedEmailKey
            });
        }

        // GET: api/users/team
        [HttpGet("team")]
        public async Task<ActionResult> GetTeam()
        {
            Guid rootCompanyId = await GetRootCompanyIdAsync();
            var team = await _context.Users
                .Where(u => u.IdUser == rootCompanyId || u.ParentId == rootCompanyId)
                .Select(u => new { u.IdUser, u.Email, u.CompanyName, u.Role })
                .ToListAsync();

            return Ok(team);
        }

        // POST: api/users/team
        [HttpPost("team")]
        public async Task<ActionResult> CreateTeamMember(TeamMemberDto dto)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role != "Admin" && role != "Owner")
                return Forbid("Seul un Administrateur ou Propriétaire peut créer des membres.");

            bool emailExists = await _context.Users.AnyAsync(u => u.Email.ToLower() == dto.Email.ToLower());
            if (emailExists)
            {
                return BadRequest(new { Message = "Un compte existe déjà avec cette adresse email." });
            }

            string safeRole = "User";
            if (dto.Role == "Admin")
            {
                if (role == "Owner") safeRole = "Admin";
                else return Forbid("Seul le propriétaire (Owner) peut créer un Administrateur.");
            }

            if (dto.Role == "Owner") return Forbid("Impossible de créer un autre Propriétaire.");

            Guid rootCompanyId = await GetRootCompanyIdAsync();
            var newStaff = new User
            {
                CompanyName = dto.FirstName,
                Email = dto.Email.ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = safeRole,
                ParentId = rootCompanyId
            };

            _context.Users.Add(newStaff);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Membre de l'équipe créé avec succès." });
        }

        // DELETE: api/users/team/{id}
        [HttpDelete("team/{id}")]
        public async Task<IActionResult> DeleteTeamMember(Guid id)
        {
            var role = User.FindFirstValue(ClaimTypes.Role);
            if (role != "Owner" && role != "Admin")
                return Forbid("Seul un Administrateur ou Propriétaire peut retirer un membre.");

            Guid loggedInUserId = GetCompanyUserIdFromToken();
            Guid rootCompanyId = await GetRootCompanyIdAsync();

            var member = await _context.Users.FirstOrDefaultAsync(u => u.IdUser == id);
            if (member == null)
                return NotFound(new { Message = "Membre introuvable." });

            if (member.IdUser != rootCompanyId && member.ParentId != rootCompanyId)
                return Forbid("Ce membre n'appartient pas à votre structure.");

            if (member.IdUser == loggedInUserId || member.Role == "Owner")
                return BadRequest(new { Message = "Impossible de supprimer le propriétaire du compte ou soi-même." });

            if (role == "Admin" && member.Role == "Admin")
                return Forbid("Un administrateur ne peut pas supprimer un autre administrateur.");

            _context.Users.Remove(member);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Membre retiré de l'équipe." });
        }

        // POST: api/users/test-api
        [HttpPost("test-api")]
        [EnableRateLimiting("StrictPolicy")]
        public async Task<IActionResult> TestDigiSmsApi(ApiCredentialsDto dto)
        {
            if (string.IsNullOrEmpty(dto.ApiKey))
            {
                return BadRequest(new { Message = "Veuillez fournir une clé API." });
            }

            try
            {
                var client = _httpClientFactory.CreateClient("DigiSmsClient");
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {dto.ApiKey}");

                var payload = new
                {
                    sender_id = string.IsNullOrWhiteSpace(dto.SenderId) ? "DIGI ALERT" : dto.SenderId,
                    phone_number = "22890000000",
                    message = "Test de connexion DigiAlert"
                };

                var content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(payload),
                    System.Text.Encoding.UTF8,
                    "application/json"
                );

                var response = await client.PostAsync("https://apiservice.digi-sms.com/api/v1/public/sms/send", content);
                if (response.IsSuccessStatusCode)
                {
                    return Ok(new { Message = "Connexion réussie avec le serveur DigiSMS !" });
                }
                else
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    return BadRequest(new { Message = $"DigiSMS a refusé la clé (Code {(int)response.StatusCode}). Détails : {errorBody}" });
                }
            }
            catch (Exception ex)
            {
                return BadRequest(new { Message = $"Erreur réseau interne : {ex.Message}" });
            }
        }

        // POST: api/Users
        [HttpPost]
        [AllowAnonymous]
        public async Task<ActionResult> CreateUser(UserRegisterDto dto)
        {
            bool emailExists = await _context.Users.AnyAsync(u => u.Email == dto.Email);
            if (emailExists)
            {
                return BadRequest(new { Message = "Un compte existe déjà avec cette adresse email." });
            }

            var user = new User
            {
                CompanyName = dto.CompanyName,
                Email = dto.Email,
                SenderId = dto.SenderId ?? "DigiAlert",
                ApiKey = dto.ApiKey,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                CreatedAt = DateTime.UtcNow,
                Role = "Owner"
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Compte créé avec succès !", UserId = user.IdUser });
        }

        // PUT: api/Users/ApiCredentials
        [HttpPut("ApiCredentials")]
        public async Task<IActionResult> UpdateApiCredentials(ApiCredentialsDto dto)
        {
            Guid companyUserId = GetCompanyUserIdFromToken();
            var user = await _context.Users.FindAsync(companyUserId);
            if (user == null) return NotFound("Utilisateur introuvable.");

            if (!string.IsNullOrWhiteSpace(dto.ApiKey) && !dto.ApiKey.StartsWith("********"))
                user.ApiKey = dto.ApiKey;

            if (!string.IsNullOrWhiteSpace(dto.EmailApiKey) && !dto.EmailApiKey.StartsWith("********"))
                user.EmailApiKey = dto.EmailApiKey;

            if (!string.IsNullOrWhiteSpace(dto.SenderId))
                user.SenderId = dto.SenderId;

            if (!string.IsNullOrWhiteSpace(dto.EmailSender))
                user.EmailSender = dto.EmailSender;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Identifiants API mis à jour avec succès !" });
        }

        // PUT: api/users/profile
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile(UpdateProfileDto dto)
        {
            Guid userId = GetRealUserIdFromToken();
            var user = await _context.Users.FindAsync(userId);

            if (user == null) return NotFound("Utilisateur introuvable.");

            if (!string.IsNullOrWhiteSpace(dto.CompanyName))
                user.CompanyName = dto.CompanyName;

            if (!string.IsNullOrWhiteSpace(dto.Email))
                user.Email = dto.Email;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Profil mis à jour avec succès !", CompanyName = user.CompanyName });
        }

        // PUT: api/users/password
        [HttpPut("password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordDto dto)
        {
            Guid realUserId = GetRealUserIdFromToken();
            var user = await _context.Users.FindAsync(realUserId);
            if (user == null) return NotFound("Utilisateur introuvable.");

            if (!BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash))
            {
                return BadRequest("L'ancien mot de passe est incorrect.");
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Mot de passe modifié avec succès." });
        }

        // PUT: api/Users/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdateUser(Guid id, UserRegisterDto dto)
        {
            Guid rootCompanyId = await GetRootCompanyIdAsync();
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "Utilisateur introuvable." });

            if (user.IdUser != rootCompanyId && user.ParentId != rootCompanyId)
                return Forbid("Erreur de sécurité : cet utilisateur n'appartient pas à votre clinique.");

            user.CompanyName = dto.CompanyName;
            user.Email = dto.Email;

            if (!string.IsNullOrEmpty(dto.Password))
            {
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Utilisateur modifié avec succès." });
        }

        // DELETE: api/Users/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteUser(Guid id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "Utilisateur introuvable." });

            Guid rootCompanyId = await GetRootCompanyIdAsync();
            if (user.IdUser != rootCompanyId && user.ParentId != rootCompanyId)
                return Forbid("Erreur de sécurité : cet utilisateur n'appartient pas à votre clinique.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Utilisateur supprimé avec succès." });
        }

        // POST: api/Users/forgot-password
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        [EnableRateLimiting("StrictPolicy")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());

            if (user == null)
                return Ok(new { Message = "Si cet email correspond à un compte, un lien de réinitialisation a été envoyé." });

            var randomBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create()) { rng.GetBytes(randomBytes); }
            string token = Convert.ToBase64String(randomBytes).Replace("+", "-").Replace("/", "_").Replace("=", "");

            user.ResetToken = token;
            user.ResetTokenExpires = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            string originHeader = Request.Headers["Origin"].ToString();
            string frontendUrl = !string.IsNullOrEmpty(dto.ClientUrl) ? dto.ClientUrl :
                !string.IsNullOrEmpty(originHeader) ? originHeader :
                _configuration["FrontendUrl"];

            string brevoApiKey = _configuration["Brevo:ApiKey"];
            string senderEmail = _configuration["Brevo:SenderEmail"];
            string senderName = _configuration["Brevo:SenderName"];
            string resetLink = $"{frontendUrl}/reset-password?token={token}&email={user.Email}";

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("api-key", brevoApiKey);

            var emailPayload = new
            {
                sender = new { name = senderName, email = senderEmail },
                to = new[] { new { email = user.Email } },
                subject = "DigiAlert - Réinitialisation de votre mot de passe",
                htmlContent = $"<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;'>" +
                    $"<h2 style='color: #0F172A; text-align: center;'>Réinitialisation de mot de passe</h2>" +
                    $"<p style='color: #475569;'>Bonjour,</p>" +
                    $"<p style='color: #475569;'>Vous avez demandé à réinitialiser votre mot de passe sur DigiAlert. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe (ce lien est valide pendant 1 heure) :</p>" +
                    $"<div style='text-align: center; margin: 30px 0;'>" +
                    $"<a href='{resetLink}' style='background-color: #EA1552; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Réinitialiser mon mot de passe</a>" +
                    $"</div>" +
                    $"<p style='color: #94a3b8; font-size: 12px; text-align: center;'>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet email.</p>" +
                    $"</div>"
            };

            var response = await httpClient.PostAsJsonAsync("https://api.brevo.com/v3/smtp/email", emailPayload);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[ERREUR BREVO] Impossible d'envoyer le mail de reset : {error}");
            }

            return Ok(new { Message = "Si cet email correspond à un compte, un lien de réinitialisation a été envoyé." });
        }

        // POST: api/Users/reset-password
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());

            if (user == null || user.ResetToken != dto.Token || user.ResetTokenExpires < DateTime.UtcNow)
            {
                return BadRequest(new { Message = "Le lien de réinitialisation est invalide ou a expiré." });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.ResetToken = null;
            user.ResetTokenExpires = null;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Votre mot de passe a été modifié avec succès. Vous pouvez maintenant vous connecter." });
        }
    }
}