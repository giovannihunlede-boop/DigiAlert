namespace DigiAlert.Api.DTOs
{
    public class EventCreateDto
    {
        public string Title { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public string? Status { get; set; }
        
        public List<Guid> ContactIds { get; set; } = new List<Guid>(); 
    } 
}