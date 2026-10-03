namespace DigiAlert.Api.DTOs
{
    public class ReminderCreateDto
    {
        public Guid IdEvent { get; set; }
        public List<Guid> ContactIds { get; set; } = new List<Guid>(); //
        public DateTime ScheduledTime { get; set; }
        public string MessageText { get; set; } = string.Empty;
        public string Channel { get; set; } = "SMS"; 
    }
}