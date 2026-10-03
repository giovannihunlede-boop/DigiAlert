using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Data;
using DigiAlert.Api.Models;
using DigiAlert.Api.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace DigiAlert.Api.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class SmsTemplatesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SmsTemplatesController(AppDbContext context)
        {
            _context = context;
        }

        private Guid GetUserIdFromToken()
        {
            // vérification des deux noms!
            var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier) 
                            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (string.IsNullOrEmpty(userIdString))
            {
                throw new Exception("Impossible de lire le Token de sécurité.");
            }

            return Guid.Parse(userIdString);
        }

        // GET: api/SmsTemplates/User/1 
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SmsTemplate>>> GetTemplates()
        {
            Guid userId = GetUserIdFromToken();
            var templates = await _context.SmsTemplates
                                          .Where(t => t.IdUser == userId)
                                          .ToListAsync();
            return Ok(templates);
        }

        // POST: api/SmsTemplates 
        [HttpPost]
        public async Task<ActionResult> CreateTemplate(SmsTemplateCreateDto dto)
        {
            // 1. Récupération de l'ID via le Token
            var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier) 
                            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (string.IsNullOrEmpty(userIdString))
            {
                return Unauthorized("Utilisateur non identifié.");
            }

            Guid userId = Guid.Parse(userIdString);

            // 2. Création entité de base de données
            var template = new SmsTemplate
            {
                IdUser = userId,
                TemplateName = dto.TemplateName,
                MessageContent = dto.MessageContent
            };

            _context.SmsTemplates.Add(template);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Template créé avec succès !", TemplateId = template.IdTemplate });
        }

        // PUT: api/SmsTemplates/5 
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTemplate(Guid id, SmsTemplateUpdateDto dto)
        {
            Guid userId = GetUserIdFromToken();

            // 1. Recherche du template 
            var existingTemplate = await _context.SmsTemplates
                .FirstOrDefaultAsync(t => t.IdTemplate == id && t.IdUser == userId);

            if (existingTemplate == null)
            {
                return NotFound(new { Message = "Modèle Guidrouvable ou vous n'avez pas les droits pour le modifier." });
            }

            // 2. On met à jour les champs autorisés
            existingTemplate.TemplateName = dto.TemplateName;
            existingTemplate.MessageContent = dto.MessageContent;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.SmsTemplates.Any(e => e.IdTemplate == id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent(); 
        }

        // DELETE: api/SmsTemplates/5 
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTemplate(Guid id)
        {
            Guid userId = GetUserIdFromToken();
            var template = await _context.SmsTemplates
                .FirstOrDefaultAsync(t => t.IdTemplate == id && t.IdUser == userId);

            if (template == null)
            {
                return NotFound(new { Message = "Modèle Guidrouvable ou accès non autorisé." });
            }

            _context.SmsTemplates.Remove(template);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}