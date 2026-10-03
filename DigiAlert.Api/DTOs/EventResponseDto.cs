namespace DigiAlert.Api.DTOs
{
    public class EventResponseDto
    {
        public Guid IdEvent { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public string Status { get; set; } = string.Empty;

        public bool HasSentReminders { get; set; } 
        public List<ParticipantDto> Participants { get; set; } = new List<ParticipantDto>();
    }
    public class ParticipantDto 
    {
        public Guid IdContact { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
    }
}