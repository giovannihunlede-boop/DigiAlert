using System.Text;
using System.Text.Json;

namespace DigiAlert.Api.Services
{
    public class DigiSmsService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<DigiSmsService> _logger;

        public DigiSmsService(HttpClient httpClient, ILogger<DigiSmsService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<bool> SendSmsAsync(string phoneNumber, string message, string senderId, string apiKey)
        {
            try
            {
                // 1. Préparation du JSON DigiSMS.
                var payload = new {
                    phone_number = phoneNumber,
                    message = message,
                    sender_id = senderId 
                };

                // 2. Ajoute l'authentification Bearer DigiSMS.
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}"); 

                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                
                // 3. terminaison DigiSMS V1.
                var response = await _httpClient.PostAsync("https://apiservice.digi-sms.com/api/v1/public/sms/send", content);
                
                if (response.IsSuccessStatusCode) 
                {
                    _logger.LogInformation($"✅ [DigiSMS] Message expédié avec succès à {phoneNumber}.");
                    return true;
                } 
                else 
                {
                    // L'API a refusé la requête.
                    var errorDetails = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning($"⚠️ [DigiSMS REJET] Code: {(int)response.StatusCode}, Détails: {errorDetails}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"❌ [ERREUR CRITIQUE RÉSEAU] Impossible de joindre les serveurs DigiSMS : {ex.Message}");
                return false;
            }
        }
    }
}