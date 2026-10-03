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
    public class EventsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EventsController(AppDbContext context)
        {
            _context = context;
        }

        private Guid GetUserIdFromToken()
        {
            var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (string.IsNullOrEmpty(userIdString))
                throw new Exception("Impossible de lire le Token de sécurité.");
            return Guid.Parse(userIdString);
        }

        // GET: api/Events
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EventResponseDto>>> GetEvents()
        {
            Guid userId = GetUserIdFromToken();

            var events = await _context.Events
                .Where(e => e.IdUser == userId)
                .Select(e => new EventResponseDto
                {
                    IdEvent = e.IdEvent,
                    Title = e.Title,
                    StartDateTime = e.StartDateTime,
                    EndDateTime = e.EndDateTime,
                    Status = e.Status,
                    HasSentReminders = _context.Reminders.Any(r => r.IdEvent == e.IdEvent && r.Status == ReminderStatus.Sent),
                    Participants = _context.EventParticipants
                        .Where(ep => ep.IdEvent == e.IdEvent)
                        .Select(ep => new ParticipantDto
                        {
                            IdContact = ep.Contact.IdContact,
                            FirstName = ep.Contact.FirstName,
                            LastName = ep.Contact.LastName ?? ""
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(events);
        }

        // POST: api/Events
        [HttpPost]
        public async Task<ActionResult> CreateEvent(EventCreateDto dto)
        {
            Guid userId = GetUserIdFromToken();

            TimeSpan duration = dto.EndDateTime - dto.StartDateTime;

            if (dto.StartDateTime < DateTime.UtcNow.AddMinutes(-2))
            {
                return BadRequest(new { Message = "Impossible de créer un événement dans le passé." });
            }

            if (duration.TotalMinutes <= 0)
            {
                return BadRequest(new { Message = "Erreur : La date de fin doit être strictement supérieure à la date de début (durée minimale > 0)." });
            }

            if (duration.TotalHours > 24)
            {
                return BadRequest(new { Message = "Erreur : Un rendez-vous ne peut pas excéder une durée de 24 heures." });
            }
            

            bool hasOverlap = await _context.Events.AnyAsync(e =>
                e.IdUser == userId &&
                e.Status != "COMPLETED" &&
                e.Status != "CANCELLED" &&
                e.StartDateTime < dto.EndDateTime &&
                e.EndDateTime > dto.StartDateTime
            );
            if (hasOverlap)
            {
                return BadRequest(new { Message = "Impossible : un rendez-vous existe déjà sur ce créneau horaire." });
            }

            var newEvent = new Event
            {
                IdUser = userId,
                Title = dto.Title,
                StartDateTime = dto.StartDateTime,
                EndDateTime = dto.EndDateTime,
                Status = string.IsNullOrEmpty(dto.Status) ? "PLANNED" : dto.Status
            };

            _context.Events.Add(newEvent);
            await _context.SaveChangesAsync();

            if (dto.ContactIds != null && dto.ContactIds.Any())
            {
                // Rechercher IDs dans la base de donnee
                var validContactIds = await _context.Contacts
                    .Where(c => dto.ContactIds.Contains(c.IdContact) && c.IdUser == userId)
                    .Select(c => c.IdContact)
                    .ToListAsync();

                if (validContactIds.Count != dto.ContactIds.Count)
                {
                    // secu injection ID 
                    return BadRequest(new { Message = "Erreur de sécurité : Certains contacts ne vous appartiennent pas." });
                }

                foreach (var contactId in validContactIds)
                {
                    _context.EventParticipants.Add(new EventParticipant { IdEvent = newEvent.IdEvent, IdContact = contactId });
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new { Message = "Événement créé avec succès !", IdEvent = newEvent.IdEvent });
        }

        // PUT: api/Events/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateEvent(Guid id, EventUpdateDto dto)
        {
            Guid userId = GetUserIdFromToken();

            TimeSpan duration = dto.EndDatetime - dto.StartDatetime;

            

            if (duration.TotalMinutes <= 0)
            {
                return BadRequest(new { Message = "Erreur : La date de fin doit être strictement supérieure à la date de début (durée minimale > 0)." });
            }

            if (duration.TotalHours > 24)
            {
                return BadRequest(new { Message = "Erreur : Un rendez-vous ne peut pas excéder une durée de 24 heures." });
            }

            bool hasOverlap = await _context.Events.AnyAsync(e =>
                e.IdUser == userId &&
                e.IdEvent != id &&
                e.Status != "COMPLETED" &&
                e.Status != "CANCELLED" &&
                e.StartDateTime < dto.EndDatetime &&
                e.EndDateTime > dto.StartDatetime
            );
            if (hasOverlap)
            {
                return BadRequest(new { Message = "Impossible : un rendez-vous existe déjà sur ce créneau horaire." });
            }

            // Si un SMS ou un e-mail a déjà été envoyé, l'événement ne peut plus être modifié.
            bool hasSentReminders = await _context.Reminders.AnyAsync(r => r.IdEvent == id && r.Status == ReminderStatus.Sent);
            if (hasSentReminders)
            {
                return BadRequest(new { message = "Action bloquée : Un rappel (SMS ou Email) a déjà été expédié. L'événement est verrouillé pour des raisons de traçabilité." });
            }

            var evt = await _context.Events
                .Include(e => e.EventParticipants)
                .FirstOrDefaultAsync(e => e.IdEvent == id && e.IdUser == userId);

            if (evt == null)
            {
                return NotFound(new { Message = "Événement Guidrouvable." });
            }
            if (evt.StartDateTime <= DateTime.UtcNow)
            {
                return BadRequest(new { Message = "Impossible de modifier un rendez-vous déjà commencé ou passé." });
            }

            // Les événements terminés ou annulés ne sont plus modifiables.
            if (evt.Status.ToUpper() == "COMPLETED" || evt.Status.ToUpper() == "CANCELLED")
            {
                return BadRequest(new { Message = $"Impossible de modifier un rendez-vous qui est déjà {evt.Status}." });
            }

            evt.Title = dto.Title;
            evt.StartDateTime = dto.StartDatetime;
            evt.EndDateTime = dto.EndDatetime;
            if (!string.IsNullOrEmpty(dto.Status)) evt.Status = dto.Status;

            _context.EventParticipants.RemoveRange(evt.EventParticipants);
            if (dto.ContactIds != null && dto.ContactIds.Any())
            {
                var validContactIds = await _context.Contacts
                    .Where(c => dto.ContactIds.Contains(c.IdContact) && c.IdUser == userId)
                    .Select(c => c.IdContact)
                    .ToListAsync();

                if (validContactIds.Count != dto.ContactIds.Count) return BadRequest(new { Message = "Erreur de sécurité." });

                foreach (var contactId in validContactIds)
                {
                    _context.EventParticipants.Add(new EventParticipant { IdEvent = evt.IdEvent, IdContact = contactId });
                }
            }

            var pendingReminders = await _context.Reminders
                .Where(r => r.IdEvent == id && r.Status == ReminderStatus.Pending && r.Purpose == ReminderPurpose.Reminder)
                .ToListAsync();

            _context.Reminders.RemoveRange(pendingReminders);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Événement mis à jour avec succès !", Event = evt });
        }

        // DELETE: api/Events/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEvent(Guid id)
        {
            Guid userId = GetUserIdFromToken();
            var evt = await _context.Events.FirstOrDefaultAsync(e => e.IdEvent == id && e.IdUser == userId);

            if (evt == null) return NotFound(new { Message = "Événement Guidrouvable." });

            // Éviter une annulation en double ou la suppression d'un événement terminé.
            if (evt.Status.ToUpper() == "CANCELLED" || evt.Status.ToUpper() == "COMPLETED")
            {
                return BadRequest(new { Message = $"Impossible de supprimer un événement déjà {evt.Status}." });
            }

            bool hasSentReminders = await _context.Reminders.AnyAsync(r => r.IdEvent == id && r.Status == ReminderStatus.Sent);
            if (hasSentReminders)
            {
                return BadRequest(new
                {
                    Message = "Un rappel a déjà été envoyé au client. Utilisez l'annulation avec message (POST /api/Events/{id}/cancel) pour le prévenir avant d'annuler.",
                    RequiresCancellationMessage = true
                });
            }

            // Si rien n'a jamais été envoyé
            var pendingReminders = await _context.Reminders
                .Where(r => r.IdEvent == id && r.Status == ReminderStatus.Pending)
                .ToListAsync();
            _context.Reminders.RemoveRange(pendingReminders);

            evt.Status = "CANCELLED";
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Événement supprimé avec succès." });
        }

        // POST: api/Events/{id}/cancel
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelEventWithNotification(Guid id, [FromBody] EventCancelDto dto)
        {
            // récupérération user id via le token
            Guid userId = GetUserIdFromToken();

            // récupèration d'événement
            var evt = await _context.Events.FirstOrDefaultAsync(e => e.IdEvent == id && e.IdUser == userId);
            
            if (evt == null) return NotFound(new { Message = "Événement Guidrouvable." });

            // 1. VÉRIFICATIONS DE VALIDITÉ
            if (evt.Status.ToUpper() == "CANCELLED" || evt.Status.ToUpper() == "COMPLETED")
            {
                return BadRequest(new { Message = $"Impossible d'annuler un événement déjà {evt.Status}." });
            }
            evt.Status = "CANCELLED";

            // 2. NETTOYAGE DES RAPPELS OBSOLÈTES
            var pendingReminders = await _context.Reminders
                .Where(r => r.IdEvent == id && r.Status == ReminderStatus.Pending && r.Purpose == ReminderPurpose.Reminder)
                .ToListAsync();
            
            if (pendingReminders.Any())
            {
                _context.Reminders.RemoveRange(pendingReminders);
            }

            // 3. CIBLAGE GuidELLIGENT
            var totalClients = await _context.EventParticipants
                .Where(ep => ep.IdEvent == id)
                .Select(ep => ep.IdContact)
                .Distinct()
                .ToListAsync();
            
        
            var sentTargets = await _context.Reminders
                .Where(r => r.IdEvent == id && r.Status == ReminderStatus.Sent)
                .Select(r => new { r.IdContact, r.Channel })
                .Distinct()
                .ToListAsync();

            // 4. Génèration des messages d'excuse aux contacts concernés.
            if (!string.IsNullOrWhiteSpace(dto.Message) && sentTargets.Any())
            {
                var cancelReminders = new List<Reminder>();

                foreach (var target in sentTargets)
                {
                    // récupèration de contact complet
                    var contact = await _context.Contacts
                        .FirstOrDefaultAsync(c => c.IdContact == target.IdContact && c.IdUser == userId);
                    
                    if (contact == null) continue;

                    // informations du rendez-vous.
                    string personalizedMsg = dto.Message
                        .Replace("{Prenom}", contact.FirstName ?? "", StringComparison.OrdinalIgnoreCase)
                        .Replace("{Nom}", contact.LastName ?? "", StringComparison.OrdinalIgnoreCase)
                        .Replace("{Date}", evt.StartDateTime.ToString("dd/MM/yyyy"))
                        .Replace("{Heure}", evt.StartDateTime.ToString("HH:mm"));

                    // préparation rappel d'annulation
                    cancelReminders.Add(new Reminder
                    {
                        IdEvent = evt.IdEvent,
                        IdContact = target.IdContact,
                        ScheduledTime = DateTime.UtcNow,
                        MessageText = personalizedMsg,
                        Channel = target.Channel,        // Conservation du canal message 
                        Status = ReminderStatus.Pending,
                        Purpose = ReminderPurpose.Cancellation
                    });
                }

                // On ajoute de liste 
                if (cancelReminders.Any())
                {
                    _context.Reminders.AddRange(cancelReminders);
                }
            }

            // 5. Enregistrement des modifications.
            await _context.SaveChangesAsync();

            // 6. Retourne un résultat client.
            return Ok(new
            {
                Message = sentTargets.Count > 0
                    ? $"Événement annulé. Message d'annulation programmé pour {totalClients.Count} destinataire(s)."
                    : "Événement annulé. Aucun message n'a été envoyé car aucun rappel n'était parti.",
                NotifiedCount = sentTargets.Count
            });
        }

        [HttpPost("checkin")]
        [AllowAnonymous] 
        public async Task<IActionResult> PatientCheckin([FromBody] CheckinDto request)
        {
            if (string.IsNullOrEmpty(request.Telephone))
                return BadRequest(new { message = "Le numéro de téléphone est requis." });

            var clinic = await _context.Users.FirstOrDefaultAsync(u => u.KioskToken == request.KioskToken);
            if (clinic == null)
                return NotFound(new { message = "Lien du kiosque invalide ou expiré." });

            // 1. Trouver contact via numéro
            var contact = await _context.Contacts
                .FirstOrDefaultAsync(c => c.PhoneNumber == request.Telephone && c.IdUser == clinic.IdUser);

            if (contact == null)
                return NotFound(new { message = "Aucun dossier trouvé avec ce numéro." });

            // 2. événement du contact prévu AUJOURD'HUI
            var today = DateTime.UtcNow.Date;
            var eventParticipant = await _context.EventParticipants
                .Include(ep => ep.Event)
                .FirstOrDefaultAsync(ep => 
                    ep.IdContact == contact.IdContact &&
                    ep.Event.StartDateTime.Date == today &&
                    ep.Event.Status != "CANCELLED" &&
                    ep.Event.Status != "COMPLETED"
                );

            if (eventParticipant == null || eventParticipant.Event == null)
                return NotFound(new { message = "Vous n'avez aucun rendez-vous prévu aujourd'hui." });

            // 3. Mettre à jour le statut
            eventParticipant.Event.Status = "ARRIVED"; // 
            _context.Events.Update(eventParticipant.Event);
            await _context.SaveChangesAsync();

            return Ok(new { 
                message = $"Bienvenue {contact.FirstName} {contact.LastName}. Le docteur a été notifié de votre arrivée." 
            });
        }

    }
}