namespace DigiAlert.Api.DTOs
{
    public class ReminderUpdateDto
    {
        public DateTime ScheduledTime { get; set; }
        public string MessageText { get; set; } = string.Empty;
        public string Status { get; set; } = "PENDING";
    }
}