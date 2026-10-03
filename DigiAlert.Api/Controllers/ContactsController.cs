using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Data;
using DigiAlert.Api.Models;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace DigiAlert.Api.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    
    public class ContactsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ContactsController(AppDbContext context)
        {
            _context = context;
        }
        // Extraction de l'identifiant de l'utilisateur ddu token JWT.
        private Guid GetUserIdFromToken()
        {
            var userIdString = User?.FindFirstValue(ClaimTypes.NameIdentifier) 
                            ?? User?.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (string.IsNullOrEmpty(userIdString))
            {
                throw new Exception("Impossible de lire le Token de sécurité.");
            }

            return Guid.Parse(userIdString);
        }

        

        // GET: api/Contacts/User/5
        // GET: api/Contacts/User/5
        [HttpGet]
        public async Task<ActionResult> GetContacts([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            Guid userId = GetUserIdFromToken();
            var query = _context.Contacts.AsNoTracking().Where(c => c.IdUser == userId);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(c => 
                    (c.FirstName + " " + c.LastName).ToLower().Contains(searchLower) ||
                    (c.PhoneNumber != null && c.PhoneNumber.ToLower().Contains(searchLower)) ||
                    (c.Email != null && c.Email.ToLower().Contains(searchLower))
                );
            }

            var totalCount = await query.CountAsync();
            var contacts = await query
                .OrderBy(c => c.FirstName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { TotalCount = totalCount, Contacts = contacts });
        }


        // GET: api/Contacts/5 
        [HttpGet("{id}")]
        public async Task<ActionResult<Contact>> GetContact(Guid id)
        {
            Guid userId = GetUserIdFromToken();

            var contact = await _context.Contacts
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.IdContact == id && c.IdUser == userId);

            if (contact == null)
            {
                return NotFound("Contact Guid introuvable ou vous n'avez pas l'autorisation d'y accéder.");
            }

            return Ok(contact);
        }
        
        // POST: api/Contacts
        [HttpPost]
        public async Task<ActionResult<Contact>> CreateContact(Contact contact)
        {
            Guid userId = GetUserIdFromToken();
            contact.IdUser = userId;
            contact.Email = string.IsNullOrWhiteSpace(contact.Email) ? null : contact.Email.Trim();
            contact.FirstName = string.IsNullOrWhiteSpace(contact.FirstName) ? null : contact.FirstName.Trim();
            contact.LastName = string.IsNullOrWhiteSpace(contact.LastName) ? null : contact.LastName.Trim();
            
            bool phoneExists = await _context.Contacts.AnyAsync(c => c.IdUser == userId && c.PhoneNumber == contact.PhoneNumber);
            if (phoneExists)
            {
                return BadRequest("Ce numéro de téléphone est déjà enregistré dans vos contacts.");
            }
            bool emailExists = await _context.Contacts.AnyAsync(c => c.IdUser == userId && c.Email == contact.Email);
            if (emailExists)
            {
                return BadRequest("Un contact avec cette adresse e-mail existe déjà dans votre carnet.");
            }

            _context.Contacts.Add(contact);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetContacts), new { id = contact.IdContact }, contact);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateContact(Guid id, Contact contact)
        {
            Guid userId = GetUserIdFromToken();

            var existing = await _context.Contacts.FirstOrDefaultAsync(c => c.IdContact == id && c.IdUser == userId);
            if (existing == null) return NotFound("Contact Guid introuvable ou accès non autorisé.");

            if (contact.IdContact != Guid.Empty && contact.IdContact != id)
            {
                return BadRequest("L'ID du contact ne correspond pas.");
            }

            bool duplicatePhone = await _context.Contacts.AnyAsync(c =>
                c.IdUser == userId && c.PhoneNumber == contact.PhoneNumber && c.IdContact != id);
            if (duplicatePhone)
            {
                return BadRequest("Ce numéro de téléphone est déjà utilisé par un autre contact.");
            }
            bool emailExists = await _context.Contacts.AnyAsync(c =>
                c.IdUser == userId && c.Email == contact.Email && c.IdContact != id);
            if (emailExists)
            {
                return BadRequest("Un autre contact utilise déjà cette adresse e-mail.");
            }

            existing.FirstName = string.IsNullOrWhiteSpace(contact.FirstName) ? null : contact.FirstName.Trim();
            existing.LastName = string.IsNullOrWhiteSpace(contact.LastName) ? null : contact.LastName.Trim();
            existing.PhoneNumber = contact.PhoneNumber?.Trim() ?? existing.PhoneNumber;
            existing.Email = string.IsNullOrWhiteSpace(contact.Email) ? null : contact.Email.Trim();

            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        // DELETE: api/Contacts/5 
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteContact(Guid id)
        {
            Guid userId = GetUserIdFromToken();
            var contact = await _context.Contacts.FindAsync(id);
            if (contact == null) return NotFound();
            if (contact.IdUser != userId) return Forbid();

            _context.Contacts.Remove(contact);
            await _context.SaveChangesAsync();

            return NoContent(); // Code 204: Supprimé avec succès
        }
    }
    
}