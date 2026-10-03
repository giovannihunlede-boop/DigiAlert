using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Data;
using DigiAlert.Api.Models;
using DigiAlert.Api.DTOs;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace DigiAlert.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context)
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

        private static DateTime ToUtc(DateTime dt)
        {
            return dt.Kind switch
            {
                DateTimeKind.Utc => dt,
                DateTimeKind.Local => dt.ToUniversalTime(),
                _ => DateTime.SpecifyKind(dt, DateTimeKind.Utc) // Unspecified -> on force Utc
            };
        }

        // GET: api/Dashboard
        [HttpGet]
        public async Task<ActionResult<DashboardSummaryDto>> GetSummary([FromQuery] string? targetDate)
        {
            try
            {
                Guid userId = GetUserIdFromToken();

                var actualToday = DateTime.UtcNow.Date;
                var filterDate = actualToday;

                if (!string.IsNullOrEmpty(targetDate) && DateTime.TryParse(targetDate, out DateTime parsed))
                {
                    // Force Kind à Utc, dans une colonne "timestamp with time zone".
                    filterDate = ToUtc(parsed.Date);
                }

                var filterDateEnd = filterDate.AddDays(1);

                // 1. RDV du jour
                var rdvDuJour = await _context.Events
                    .Where(e => e.IdUser == GetUserIdFromToken() && e.StartDateTime >= filterDate && e.StartDateTime < filterDateEnd)
                    .CountAsync();

                // 2. Stats des rappels
                var smsEnvoyes = await _context.Reminders.CountAsync(r => r.Event.IdUser == userId && (r.Channel == "SMS" || r.Channel == null) && r.Status.ToUpper() == "SENT");
                var smsFailed = await _context.Reminders.CountAsync(r => r.Event.IdUser == userId && (r.Channel == "SMS" || r.Channel == null) && r.Status.ToUpper() == "FAILED");
                var processedSms = smsEnvoyes + smsFailed;

                double tauxDelivrabilite = 0;
                if (processedSms > 0)
                {
                    tauxDelivrabilite = Math.Round(((double)smsEnvoyes / processedSms) * 100, 1);
                }

                // comptage des Emails envoyés
                var emailsEnvoyes = await _context.Reminders.CountAsync(r => r.Event.IdUser == userId && r.Channel.ToUpper() == "EMAIL" && r.Status.ToUpper() == "SENT");

                // 3. Prochains SMS

                var prochainsSmsRaw = await _context.Reminders
                    .Include(r => r.Contact)
                    .Include(r => r.Event)
                    .Where(r => r.Event.IdUser == GetUserIdFromToken() && r.Status == "PENDING" && r.ScheduledTime >= actualToday)
                    .OrderBy(r => r.ScheduledTime)
                    .Take(5)
                    .ToListAsync();


                var prochainsSms = prochainsSmsRaw.Select(r => new UpcomingSmsDto
                {
                    Id = r.IdReminder,
                    ClientName = r.Contact != null ? $"{r.Contact.FirstName} {r.Contact.LastName ?? ""}".Trim() : "Inconnu",
                    PhoneNumber = r.Contact != null ? r.Contact.PhoneNumber : "Inconnu",
                    EventTitle = r.Event?.Title ?? "Événement inconnu",
                    scheduledTime = r.ScheduledTime,
                    Status = r.Status ?? "PENDING",
                    MessageText = r.MessageText ?? ""
                }).ToList();

                var summary = new DashboardSummaryDto
                {
                    RdvDuJour = rdvDuJour,
                    SmsEnvoyes = smsEnvoyes,
                    EmailsEnvoyes = emailsEnvoyes,
                    TauxDelivrabilite = tauxDelivrabilite,
                    ProchainsSms = prochainsSms
                };

                return Ok(summary);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message, Details = ex.InnerException?.Message });
            }
        }


        [HttpGet("chart")]
        public async Task<ActionResult<List<int>>> GetChartData([FromQuery] string startDate)
        {
            Guid userId = GetUserIdFromToken();
            if (!DateTime.TryParse(startDate, out DateTime parsedStart)) return BadRequest();
            

            var startUtc = DateTime.SpecifyKind(parsedStart.Date, DateTimeKind.Utc);
            var endUtc = startUtc.AddDays(7);

            var weeklyDates = await _context.Reminders
                .Where(r => r.Event.IdUser == userId && r.Status.ToUpper() == "SENT" && r.ScheduledTime >= startUtc && r.ScheduledTime < endUtc)
                .Select(r => r.ScheduledTime)
                .ToListAsync();

            var counts = new List<int>();
            for (int i = 0; i < 7; i++)
            {
                var dayStart = startUtc.AddDays(i);
                var dayEnd = dayStart.AddDays(1);

                counts.Add(weeklyDates.Count(d => d >= dayStart && d < dayEnd));
            }

            return Ok(counts);
        }

        // GET: api/Dashboard/notifications
        [HttpGet("notifications")]
        public async Task<ActionResult> GetNotifications()
        {
            // Récupèration de l'identifiant du praticien connecté.
            var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            if (string.IsNullOrEmpty(userIdString)) return Unauthorized();
            
            var userId = Guid.Parse(userIdString); 

            var notifications = new List<object>();

            // 1. Vérification si la clé API doit encore être configurée.
            var user = await _context.Users.FindAsync(userId);
            if (user != null && string.IsNullOrEmpty(user.ApiKey))
            {
                notifications.Add(new {
                    id = "api_warning",
                    title = "Configuration Requise",
                    message = "Votre clé API DigiSMS n'est pas configurée. Aucun rappel ne pourra être envoyé.",
                    type = "warning"
                });
            }

            // 2. Récupèration des cinq derniers SMS qui n'ont pas été envoyés.
            var failedSms = await _context.Reminders
                .Include(r => r.Contact)
                .Include(r => r.Event) 
                .Where(r => r.Event != null && r.Event.IdUser == userId && r.Status.ToUpper() == "FAILED" && !r.IsRead)
                .OrderByDescending(r => r.ScheduledTime)
                .Take(5)
                .Select(r => new {
                    id = $"failed_{r.IdReminder}",
                    title = "Échec d'envoi de rappel",
                    message = $"Le rappel {r.Channel} pour {r.Contact!.FirstName} {r.Contact.LastName} n'a pas pu être envoyé.",
                    type = "error"
                })
                .ToListAsync();

            notifications.AddRange(failedSms);

            // 3. Récupèration des patients arrivés aujourd'hui dans la salle d'attente.
            var today = DateTime.UtcNow.Date;
            
            var arrivedEvents = await _context.Events
                .Include(e => e.EventParticipants)
                    .ThenInclude(ep => ep.Contact)
                .Where(e => e.IdUser == userId && e.Status.ToUpper() == "ARRIVED" && e.StartDateTime.Date == today && !e.IsRead)
                .Select(e => new {
                    id = $"arrived_{e.IdEvent}",
                    title = "Patient en salle d'attente",
                    message = e.EventParticipants.FirstOrDefault() != null 
                              ? $"{e.EventParticipants.First().Contact!.FirstName} {e.EventParticipants.First().Contact!.LastName} est arrivé pour son RDV de {e.StartDateTime.ToString("HH:mm")}."
                              : $"Un patient est arrivé pour le RDV de {e.StartDateTime.ToString("HH:mm")}.",
                    type = "success"
                })
                .ToListAsync();

            notifications.AddRange(arrivedEvents);

            return Ok(notifications);
        }
        // PUT: api/Dashboard/notifications/{id}/read
        [HttpPut("notifications/{id}/read")]
        public async Task<IActionResult> MarkNotificationAsRead(string id)
        {
            try
            {
                // l'alerte API doit rester tant que la clé n'est pas mise
                if (id == "api_warning") return Ok(new { Message = "Alerte système non dismissable" });

                if (id.StartsWith("failed_"))
                {
                    var reminderIdStr = id.Replace("failed_", "");
                    if (Guid.TryParse(reminderIdStr, out Guid reminderId))
                    {
                        var reminder = await _context.Reminders.FirstOrDefaultAsync(r => r.IdReminder == reminderId && r.Event.IdUser == GetUserIdFromToken());
                        
                        if (reminder != null && reminder.Status == "FAILED")
                        {
                            reminder.IsRead = true;
                            await _context.SaveChangesAsync();
                        }
                    }
                }
                return Ok();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // PUT: api/Dashboard/notifications/read-all
        [HttpPut("notifications/read-all")]
        public async Task<IActionResult> MarkAllNotificationsAsRead()
        {
            try
            {
                var userId = GetUserIdFromToken();

                // 1. Marquer les SMS comme lus
                var failedReminders = await _context.Reminders
                    .Include(r => r.Event)
                    .Where(r => r.Event.IdUser == userId && r.Status.ToUpper() == "FAILED" && !r.IsRead)
                    .ToListAsync();

                foreach (var reminder in failedReminders)
                {
                    reminder.IsRead = true;
                }

                // 2. Marquer les patients arrivés comme lus
                var today = DateTime.UtcNow.Date;
                var arrivedEvents = await _context.Events
                    .Where(e => e.IdUser == userId && e.Status.ToUpper() == "ARRIVED" && e.StartDateTime.Date == today && !e.IsRead)
                    .ToListAsync();

                foreach (var ev in arrivedEvents)
                {
                    ev.IsRead = true;
                }

                await _context.SaveChangesAsync();
                
                return Ok();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }
    }
}