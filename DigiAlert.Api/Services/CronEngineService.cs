using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Data;
using DigiAlert.Api.Models;
using System.Net;
using System.Net.Mail;
using System.Net.Security;
using System.Security.Cryptography.X509Certificates;

namespace DigiAlert.Api.Services
{
    public class CronEngineService : BackgroundService
    {
        private readonly ILogger<CronEngineService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        public CronEngineService(
            ILogger<CronEngineService> logger,
            IServiceScopeFactory scopeFactory,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Moteur Cron DigiAlert démarré en arrière-plan...");

            while (!stoppingToken.IsCancellationRequested)
            {
                await ProcessPendingReminders();
                await AutoCompletePastEvents();
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        // ─────────────────────────────────────────────────────────────────
        // Passe automatiquement les événements terminés au statut COMPLETED.
        // ─────────────────────────────────────────────────────────────────
        private async Task AutoCompletePastEvents()
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var pastEvents = await context.Events
                    .Where(e => e.Status == "PLANNED" && e.EndDateTime <= DateTime.UtcNow)
                    .ToListAsync();

                if (pastEvents.Any())
                {
                    foreach (var evt in pastEvents)
                    {
                        evt.Status = "COMPLETED";
                    }
                    await context.SaveChangesAsync();
                    _logger.LogInformation($" CRON : {pastEvents.Count} événements du passé ont été passés en statut COMPLETED.");
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────
        // Traite les rappels REMINDER et CANCELLATION en attente lorsque leur heure est arrivée.
        // ─────────────────────────────────────────────────────────────────
        private async Task ProcessPendingReminders()
        {
            using (var scope = _scopeFactory.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var now = DateTime.UtcNow;

                int lockedCount = await context.Reminders
                    .Where(r => r.Status == ReminderStatus.Pending && r.ScheduledTime <= now)
                    .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, "PROCESSING"));

                if (lockedCount == 0) return;
                var processingReminders = await context.Reminders
                    .Include(r => r.Contact)
                    .Include(r => r.Event).ThenInclude(e => e!.User)
                    .Where(r => r.Status == "PROCESSING" && r.ScheduledTime <= now)
                    .ToListAsync();

                if (!processingReminders.Any()) return;

                _logger.LogInformation($"🔔 {processingReminders.Count} rappel(s) verrouillé(s) et prêt(s) à être expédié(s) !");

                // 3. 🚀 ENVOI DES MESSAGES
                foreach (var reminder in processingReminders)
                {
                    try
                    {
                        var finalMessage = string.IsNullOrWhiteSpace(reminder.MessageText)
                            ? (reminder.Purpose == ReminderPurpose.Cancellation
                                ? $"Votre rendez-vous \"{reminder.Event?.Title ?? "RDV"}\" a été annulé."
                                : $"Rappel: {reminder.Event?.Title ?? "Événement"} - {reminder.ScheduledTime:u}")
                            : reminder.MessageText;

                        if (reminder.Channel != null && reminder.Channel.ToUpper() == ReminderChannel.Email)
                        {
                            if (reminder.Contact == null || string.IsNullOrWhiteSpace(reminder.Contact.Email))
                            {
                                reminder.Status = ReminderStatus.Failed;
                                reminder.ApiResponse = "Contact sans adresse email";
                                _logger.LogWarning($"Rappel {reminder.IdReminder} : email contact manquant.");
                                continue;
                            }

                            try
                            {
                                _logger.LogInformation($"Tentative d'envoi d'un Email via API à {reminder.Contact.Email}...");

                                // 1. On nettoie brutalement les potentiels guillemets ou espaces invisibles sauvés en BDD
                                var smtpFrom = reminder.Event?.User?.EmailSender?.Trim().Replace("\"", "").Replace(" ", "");
                                var apiKey = reminder.Event?.User?.EmailApiKey?.Trim().Replace("\"", "").Replace(" ", ""); 

                                // DEBUG : Ça va s'afficher dans votre terminal pour qu'on voit EXACTEMENT ce qui est envoyé !
                                _logger.LogInformation($"[DEBUG] Clé Brevo utilisée : '{apiKey}'");

                                if (string.IsNullOrWhiteSpace(smtpFrom) || string.IsNullOrWhiteSpace(apiKey))
                                {
                                    reminder.Status = ReminderStatus.Failed;
                                    reminder.ApiResponse = "Configuration Email (Expéditeur ou Clé API) manquante.";
                                    _logger.LogWarning($"Email annulé : Clé API ou Expéditeur manquant pour ce cabinet.");
                                    continue;
                                }

                                var subjectPrefix = reminder.Purpose == ReminderPurpose.Cancellation ? "Annulation" : "Rappel";
                                string companyName = reminder.Event?.User?.CompanyName ?? "Votre praticien";
                                var subject = $"{subjectPrefix}: {reminder.Event?.Title ?? "Rendez-vous"}";
                                var bodyText = $"{finalMessage}\n\nDate: {reminder.Event?.StartDateTime:g}\n\nCordialement,\n{companyName}";

                                var httpClient = _httpClientFactory.CreateClient("BrevoClient");

                                // 2. On s'assure d'avoir un client propre et on ajoute les bons headers Brevo
                                httpClient.DefaultRequestHeaders.Clear();
                                httpClient.DefaultRequestHeaders.Add("api-key", apiKey);
                                httpClient.DefaultRequestHeaders.Add("accept", "application/json");

                                var payload = new
                                {
                                    sender = new { name = companyName, email = smtpFrom },
                                    to = new[] { new { email = reminder.Contact.Email.Trim() } },
                                    subject = subject,
                                    textContent = bodyText
                                };

                                var response = await httpClient.PostAsJsonAsync("https://api.brevo.com/v3/smtp/email", payload);

                                if (response.IsSuccessStatusCode)
                                {
                                    reminder.Status = ReminderStatus.Sent;
                                    reminder.MessageText = finalMessage;
                                    reminder.ApiResponse = "200 OK - Email envoyé via API Brevo";
                                    _logger.LogInformation("✅ Email envoyé avec succès par l'API !");
                                }
                                else
                                {
                                    string errorBody = await response.Content.ReadAsStringAsync();
                                    reminder.Status = ReminderStatus.Failed;
                                    reminder.ApiResponse = $"Erreur API Brevo {response.StatusCode}";
                                    _logger.LogError($"❌ Échec de l'API Brevo : {errorBody}");
                                }
                            }
                            catch (Exception ex)
                            {
                                reminder.Status = ReminderStatus.Failed;
                                reminder.ApiResponse = $"{ex.GetType().Name}: {ex.Message}";
                                _logger.LogError($"❌ Erreur d'exécution Email : {ex.Message}");
                            }
                        }
                        else
                        {
                            try 
                            {
                                _logger.LogInformation($"📡 Envoi d'un VRAI SMS à {reminder.Contact?.PhoneNumber}...");
                                
                                string apiKey = reminder.Event?.User?.ApiKey ?? "";
                                string senderId = reminder.Event?.User?.SenderId ?? "DIGIALERT";
                                
                                if (string.IsNullOrWhiteSpace(apiKey)) {
                                    throw new Exception("Clé API SMS manquante pour ce cabinet.");
                                }

                                var httpClient = _httpClientFactory.CreateClient("DigiSmsClient");
                                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

                                var payload = new {
                                    sender_id = string.IsNullOrWhiteSpace(senderId) ? "DIGIALERT" : senderId,
                                    phone_number = reminder.Contact?.PhoneNumber,
                                    message = finalMessage
                                };

                                var response = await httpClient.PostAsJsonAsync("https://apiservice.digi-sms.com/api/v1/public/sms/send", payload);
                                
                                if (response.IsSuccessStatusCode) {
                                    reminder.Status = ReminderStatus.Sent;
                                    reminder.MessageText = finalMessage;
                                    reminder.ApiResponse = "200 OK - SMS envoyé par DigiSMS";
                                    _logger.LogInformation("✅ SMS expédié avec succès via DigiSMS.");
                                } else {
                                    string errorBody = await response.Content.ReadAsStringAsync();
                                    throw new Exception($"Erreur {response.StatusCode} : {errorBody}");
                                }
                            }
                            catch (Exception ex)
                            {
                                reminder.Status = ReminderStatus.Failed;
                                reminder.ApiResponse = ex.Message;
                                _logger.LogError($"❌ Échec de l'envoi du SMS via DigiSMS : {ex.Message}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        reminder.Status = ReminderStatus.Failed;
                        reminder.ApiResponse = ex.Message;
                        _logger.LogError($"❌ Échec critique du rappel {reminder.IdReminder}: {ex.Message}");
                    }
                }
                
                await context.SaveChangesAsync();
            }
        }
    }
}