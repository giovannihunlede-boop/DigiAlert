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
    public class RemindersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RemindersController(AppDbContext context)
        {
            _context = context;
        }

        private Guid GetUserIdFromToken()
        {
            var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier) 
                            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (string.IsNullOrEmpty(userIdString))
            {
                throw new Exception("Impossible de lire le Token de sécurité.");
            }

            return Guid.Parse(userIdString);
        }

        // GET: api/Reminders 
        // Modifié pour renvoyer TOUS les rappels de l'utilisateur (utile pour le graphique React et la modale)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetAllReminders()
        {
            Guid userId = GetUserIdFromToken();
            
            var reminders = await _context.Reminders
                .Include(r => r.Event)
                .Include(r => r.Contact)
                .Where(r => r.Event.IdUser == userId) // 🔒 On s'assure que l'événement appartient bien au user
                .OrderByDescending(r => r.ScheduledTime)
                .Select(r => new {
                    r.IdReminder,
                    r.IdEvent,
                    r.IdContact,
                    r.Channel,  
                    ClientName = r.Contact.FirstName + " " + r.Contact.LastName,
                    PhoneNumber = r.Contact.PhoneNumber,
                    EventTitle = r.Event.Title,
                    r.ScheduledTime,
                    r.MessageText,
                    r.Status,
                    
                })
                .ToListAsync();

            return Ok(reminders);
        }

        [HttpGet("pending")]
        public async Task<ActionResult<IEnumerable<object>>> GetPendingReminders()
        {
            Guid userId = GetUserIdFromToken();

            var reminders = await _context.Reminders
                .Include(r => r.Event)
                .Include(r => r.Contact)
                .Where(r => r.Event.IdUser == userId && r.Status == "PENDING")
                .OrderByDescending(r => r.ScheduledTime)
                .Select(r => new {
                    r.IdReminder,
                    r.IdEvent,
                    r.IdContact,
                    r.Channel,  
                    ClientName = r.Contact.FirstName + " " + r.Contact.LastName,
                    PhoneNumber = r.Contact.PhoneNumber,
                    EventTitle = r.Event.Title,
                    r.ScheduledTime,
                    r.MessageText,
                    r.Status,                 
                })
                .ToListAsync();

            return Ok(reminders);
        }

        // POST: api/Reminders (Programmer des SMS en lot)
        [HttpPost]
        public async Task<ActionResult> CreateReminder(ReminderCreateDto dto)
        {
            Guid userId = GetUserIdFromToken();
            var evt = await _context.Events.FirstOrDefaultAsync(e => e.IdEvent == dto.IdEvent && e.IdUser == userId);
            
            if (evt == null) return Forbid("Cet événement ne vous appartient pas.");

            // Aucun rappel ne peut être ajouté à un événement annulé ou terminé.
            if (evt.Status.ToUpper() == "CANCELLED" || evt.Status.ToUpper() == "COMPLETED")
            {
                return BadRequest(new { Message = $"Impossible d'ajouter un rappel à un événement {evt.Status}." });
            }

            if (evt.StartDateTime <= DateTime.UtcNow)
            {
                return BadRequest(new { Message = "Impossible de programmer un rappel pour un événement passé ou en cours." });
            }

            // Vérifie également que l'heure prévue du rappel n'est pas passée.
            if (dto.ScheduledTime <= DateTime.UtcNow.AddMinutes(-2))
            {
                return BadRequest(new { Message = "La date d'envoi du rappel ne peut pas être dans le passé." });
            }
            
            // EMAIL : le contact doit avoir une adresse
            if ((dto.Channel ?? "SMS").ToUpper() == "EMAIL")
            {
                foreach (var contactId in dto.ContactIds)
                {
                    var contact = await _context.Contacts.FindAsync(contactId);
                    if (contact == null || string.IsNullOrWhiteSpace(contact.Email))
                    {
                        return BadRequest(new { Message = "Impossible de créer un rappel EMAIL : le contact n'a pas d'adresse email." });
                    }
                }
            }

            var newReminders = new List<Reminder>();

            foreach(var contactId in dto.ContactIds)
            {
                var contact = await _context.Contacts.FirstOrDefaultAsync(c => c.IdContact == contactId && c.IdUser == userId);
                if (contact == null) continue;

                // Un e-mail gratuit est associé à un SMS; il est donc refusé sans SMS correspondant.
                if ((dto.Channel ?? "SMS").ToUpper() == "EMAIL")
                {
                    bool hasSms = await _context.Reminders.AnyAsync(r => r.IdEvent == dto.IdEvent && r.IdContact == contactId && r.Channel.ToUpper() == "SMS" && r.Purpose.ToUpper() == "REMINDER");
                    if (!hasSms) return BadRequest(new { Message = $"Opération refusée : Impossible de programmer un Email pour {contact.FirstName} car aucun SMS ne lui a été programmé." });
                }

                // On personnalise le message pour CE client précis !
                string personalizedMsg = dto.MessageText
                    .Replace("{Prenom}", contact.FirstName, StringComparison.OrdinalIgnoreCase)
                    .Replace("{Nom}", contact.LastName ?? "", StringComparison.OrdinalIgnoreCase)
                    .Replace("{Date}", evt.StartDateTime.ToString("dd/MM/yyyy"))
                    .Replace("{Heure}", evt.StartDateTime.ToString("HH:mm"));

                newReminders.Add(new Reminder
                {
                    IdEvent = dto.IdEvent,
                    IdContact = contactId,
                    ScheduledTime = dto.ScheduledTime,
                    MessageText = personalizedMsg,
                    Channel = dto.Channel ?? "SMS",
                    Status = "PENDING",
                    Purpose = "REMINDER" 
                });
            }

            _context.Reminders.AddRange(newReminders);
            await _context.SaveChangesAsync();

            return Ok(new { Message = $"{newReminders.Count} Rappel(s) programmé(s) avec succès !" });
        }

        // POST: api/Reminders/5/cancel
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelSingleReminder(Guid id, [FromBody] EventCancelDto dto) // On réutilise le même DTO
        {
            Guid userId = GetUserIdFromToken();
            var reminder = await _context.Reminders
                .Include(r => r.Event)
                .Include(r => r.Contact)
                .FirstOrDefaultAsync(r => r.IdReminder == id && r.Event.IdUser == userId);

            if (reminder == null) return NotFound(new { Message = "Rappel Guidrouvable." });
            if (reminder.Status.ToUpper() != "SENT") return BadRequest(new { Message = "Ce rappel n'a pas encore été expédié." });

            // On génère un nouveau rappel d'annulation immédiat juste pour CE canal précis !
            var cancelReminder = new Reminder
            {
                IdEvent = reminder.IdEvent,
                IdContact = reminder.IdContact,
                ScheduledTime = DateTime.UtcNow, // Départ immédiat !
                MessageText = dto.Message,
                Channel = reminder.Channel, // 👈 Si on a cliqué sur un Email, ça partira par Email !
                Status = "PENDING",
                Purpose = "CANCELLATION"
            };

            _context.Reminders.Add(cancelReminder);
            await _context.SaveChangesAsync();

            return Ok(new { Message = $"Message d'annulation programmé avec succès pour {reminder.Contact.FirstName} via {reminder.Channel}." });
        }

        // PUT: api/Reminders/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateReminder(Guid id, ReminderUpdateDto dto)
        {
            Guid userId = GetUserIdFromToken();

            var reminder = await _context.Reminders
                .Include(r => r.Event)
                .FirstOrDefaultAsync(r => r.IdReminder == id);

            if (reminder == null || reminder.Event.IdUser != userId)
            {
                return NotFound(new { Message = "Rappel Guidrouvable ou accès non autorisé." });
            }

            // Les rappels déjà traités restent inchangés afin de préserver l'historique.
            if (reminder.Status.ToUpper() == "SENT")
            {
                return BadRequest(new { Message = "Archivage strict : Impossible de modifier un rappel qui a déjà été envoyé." });
            }

            // 2. 🔒 CONTRÔLE DU TEMPS (Uniquement si on essaie de changer la date/heure)
            if (dto.ScheduledTime <= DateTime.UtcNow)
            {
                return BadRequest(new { Message = "Erreur : La nouvelle date programmée doit être dans le futur." });
            }

            // Mise à jour
            reminder.ScheduledTime = dto.ScheduledTime;
            reminder.MessageText = dto.MessageText;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Rappel modifié avec succès." });
        }

        // DELETE: api/Reminders/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteReminder(Guid id)
        {
            Guid userId = GetUserIdFromToken();

            // 1. 🔒 CONTRÔLE DE PROPRIÉTÉ
            var reminder = await _context.Reminders
                .Include(r => r.Event)
                .FirstOrDefaultAsync(r => r.IdReminder == id);

            if (reminder == null || reminder.Event.IdUser != userId) 
            {
                return NotFound(new { Message = "Rappel Guidrouvable ou accès non autorisé." });
            }

            // 🛡️ BARRAGE DE TRAÇABILITÉ : On ne touche pas à l'histoire !
            if (reminder.Status.ToUpper() == "SENT")
            {
                return BadRequest(new { Message = "Archivage strict : Impossible de supprimer un rappel déjà envoyé." });
            }

            // Respecte la règle métier qui lie l'e-mail gratuit au SMS associé.
            if (reminder.Channel.ToUpper() == "SMS")
            {
                // On cherche l'email gratuit associé à ce contact pour ce même événement
                var associatedEmail = await _context.Reminders.FirstOrDefaultAsync(r => 
                    r.IdEvent == reminder.IdEvent && 
                    r.IdContact == reminder.IdContact && 
                    r.Channel.ToUpper() == "EMAIL" && 
                    r.Status.ToUpper() == "PENDING");
                    
                if (associatedEmail != null)
                {
                    _context.Reminders.Remove(associatedEmail); // On supprime l'email avec le SMS !
                }
            }

            _context.Reminders.Remove(reminder);
            await _context.SaveChangesAsync();
            
            return Ok(new { Message = "Rappel supprimé avec succès." });
        }

        // DELETE: api/Reminders/event/5 — nettoie les rappels PENDING d'un événement
        [HttpDelete("event/{eventId}")]
        public async Task<IActionResult> DeletePendingByEvent(Guid eventId)
        {
            Guid userId = GetUserIdFromToken();
            var evt = await _context.Events.FirstOrDefaultAsync(e => e.IdEvent == eventId && e.IdUser == userId);
            if (evt == null) return NotFound(new { Message = "Événement Guidrouvable." });

            var pending = await _context.Reminders
                // Supprime uniquement les rappels PENDING; les rappels FAILED sont conservés dans l'historique.
                .Where(r => r.IdEvent == eventId && r.Status.ToUpper() == "PENDING")
                .ToListAsync();

            _context.Reminders.RemoveRange(pending);
            await _context.SaveChangesAsync();
            return Ok(new { Message = $"{pending.Count} rappel(s) non envoyé(s) supprimé(s)." });
        }
    }
}