namespace DigiAlert.Api.DTOs
{
    public class SmsTemplateCreateDto
    {
        public string TemplateName { get; set; } = string.Empty;
        public string MessageContent { get; set; } = string.Empty;
    }
}