using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DigiAlert.Api.Models
{
    [Table("event_participants")]
    public class EventParticipant
    {
        [Column("id_event")]
        public Guid IdEvent { get; set; }

        [Column("id_contact")]
        public Guid IdContact { get; set; }

        // Relations
        [ForeignKey("IdEvent")]
        [JsonIgnore]
        public Event? Event { get; set; }

        [ForeignKey("IdContact")]
        [JsonIgnore]
        public Contact? Contact { get; set; }
    }
}