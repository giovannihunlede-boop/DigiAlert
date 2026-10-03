using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DigiAlert.Api.Models
{
    /// <summary>
    /// Valeurs autorisées pour Reminder.Status.
    /// Centralisé pour éviter les typos ("Sent" vs "SENT" vs "sent") qui provoquent
    /// des bugs silencieux dans les filtres (Dashboard, historique, etc.).
    /// </summary>
    public static class ReminderStatus
    {
        public const string Pending = "PENDING";
        public const string Processing = "PROCESSING";
        public const string Sent = "SENT";
        public const string Failed = "FAILED";
    }

    public static class ReminderChannel
    {
        public const string Sms = "SMS";
        public const string Email = "EMAIL";
    }

    /// <summary>
    /// Valeurs autorisées pour Reminder.Purpose.
    /// Reminder = rappel de RDV classique. Cancellation = message envoyé au client
    /// suite à l'annulation d'un événement. Cette distinction permet d'exclure les
    /// annulations des statistiques "SMS envoyés" du Dashboard.
    /// </summary>
    public static class ReminderPurpose
    {
        public const string Reminder = "REMINDER";
        public const string Cancellation = "CANCELLATION";
    }

    [Table("reminders")]
    public class Reminder
    {
        [Key]
        [Column("id_reminder")]
        public Guid IdReminder { get; set; }

        [Required]
        [Column("id_event")]
        public Guid IdEvent { get; set; }

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Required]
        [Column("id_contact")]
        public Guid IdContact { get; set; }

        [Required]
        [Column("scheduled_time")]
        public DateTime ScheduledTime { get; set; }

        [Required]
        [Column("message_text")]
        public string MessageText { get; set; } = string.Empty;

        [Column("channel")]
        public string Channel { get; set; } = ReminderChannel.Sms; 

        [Column("status")]
        public string Status { get; set; } = ReminderStatus.Pending; // PENDING, SENT, FAILED

        [Column("api_response")]
        public string? ApiResponse { get; set; }

        [Required]
        [Column("purpose")]
        public string Purpose { get; set; } = ReminderPurpose.Reminder;

        // Relations
        [ForeignKey("IdEvent")]
        public Event? Event { get; set; }

        [ForeignKey("IdContact")]
        public Contact? Contact { get; set; }
    }
}