using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Data;
using DigiAlert.Api.DTOs;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.RateLimiting;

namespace DigiAlert.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("login")]
        [EnableRateLimiting("StrictPolicy")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            // recherche de l'utilisateur par son email
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            
            // Vérification si l'utilisateur existe ET si le mot de passe correspond au hash
            if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                return Unauthorized("Email ou mot de passe incorrect.");
            }

            // le claim "Sub" d'un employé utilise l'identifiant de son patron.
            Guid effectiveUserId = user.ParentId ?? user.IdUser;

            // Gèrer l'identité des administrateurs et des membres de l'équipe.
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role ?? "User")
            };

            if (user.Role == "Admin" || user.ParentId == null)
            {
                // Le claim Sub du patron contient son propre identifiant.
                claims.Add(new Claim(JwtRegisteredClaimNames.Sub, user.IdUser.ToString()));
                claims.Add(new Claim("RealUserId", user.IdUser.ToString()));
            }
            else
            {
                claims.Add(new Claim(JwtRegisteredClaimNames.Sub, user.ParentId.ToString()));
                claims.Add(new Claim("RealUserId", user.IdUser.ToString()));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(12), 
                signingCredentials: creds
            );

            return Ok(new { 
                token = new JwtSecurityTokenHandler().WriteToken(token), 
                userId = user.IdUser, 
                companyName = user.CompanyName,
                role = user.Role
            });
        }
    }
}