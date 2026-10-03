using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DigiAlert.Api.Models
{
    [Table("events")]
    public class Event
    {
        [Key]
        [Column("id_event")]
        public Guid IdEvent { get; set; }

        [Required]
        [Column("id_user")]
        public Guid IdUser { get; set; }

        [Required]
        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Required]
        [Column("start_datetime")]
        public DateTime StartDateTime { get; set; }

        [Required]
        [Column("end_datetime")]
        public DateTime EndDateTime { get; set; }

        [Column("status")]
        public string Status { get; set; } = "PLANNED";

        // Relations
        [ForeignKey("IdUser")]
        public User? User { get; set; }
        public ICollection<EventParticipant>? EventParticipants { get; set; }
        public ICollection<Reminder>? Reminders { get; set; }
    }
}