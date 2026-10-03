namespace DigiAlert.Api.DTOs
{
    public class DashboardSummaryDto
    {
        public int RdvDuJour { get; set; }
        public int SmsEnvoyes { get; set; }
        public int EmailsEnvoyes { get; set; }
        public double TauxDelivrabilite { get; set; }
        public List<UpcomingSmsDto> ProchainsSms { get; set; } = new();

        
        public int TotalEvents { get; set; }
        public int EventsPlanned { get; set; }
        public int EventsCompleted { get; set; }
        public int RemindersPending { get; set; }
        public int RemindersSent { get; set; }
        public int RemindersFailed { get; set; }
        public int EmailsSent { get; set; }
        public int SmsSent { get; set; }
    }

    public class UpcomingSmsDto
    {
        public Guid Id { get; set; }
        public string ClientName { get; set; } = string.Empty;
        public DateTime scheduledTime { get; set; }
        public string Status { get; set; } = string.Empty;
        public string EventTitle{get; set; } = string.Empty;
        public string MessageText{get; set; } = string.Empty;
        public string PhoneNumber{get; set; } = string.Empty;
        public string Channel { get; set; } = "SMS";
    }
}