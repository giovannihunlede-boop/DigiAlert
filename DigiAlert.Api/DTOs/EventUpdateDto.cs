namespace DigiAlert.Api.DTOs
{
    public class EventUpdateDto
    {
        public string Title { get; set; } = string.Empty;
        public DateTime StartDatetime { get; set; }
        public DateTime EndDatetime { get; set; }
        public string Status { get; set; } = string.Empty; 
        public List<Guid> ContactIds { get; set; } = new List<Guid>(); 
    }
}
