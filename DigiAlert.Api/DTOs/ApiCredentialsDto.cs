namespace DigiAlert.Api.DTOs
{
    public class ApiCredentialsDto
    {
        public string ApiKey { get; set; } = string.Empty;
        public string SenderId { get; set; } = string.Empty;
        public string EmailApiKey { get; set; } = string.Empty; 
        public string EmailSender { get; set; } = string.Empty; 
    }
}