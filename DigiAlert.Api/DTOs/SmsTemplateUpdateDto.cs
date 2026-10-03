namespace DigiAlert.Api.DTOs
{
    public class SmsTemplateUpdateDto
    {
        public string TemplateName { get; set; } = string.Empty;
        public string MessageContent { get; set; } = string.Empty;
    }
}