namespace DigiAlert.Api.DTOs
{
    public class CheckinDto
    {
        public string Telephone { get; set; }
        
        public Guid KioskToken { get; set; } 
    }
}