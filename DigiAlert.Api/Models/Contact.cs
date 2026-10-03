using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DigiAlert.Api.Models
{
    [Table("contacts")]
    public class Contact
    {
        [Key]
        [Column("id_contact")]
        public Guid IdContact { get; set; }

        [Required]
        [Column("id_user")]
        public Guid IdUser { get; set; }

        
        [Column("first_name")]
        public string? FirstName { get; set; } = string.Empty;

        [Column("last_name")]
        public string? LastName { get; set; }

        [Required]
        [Column("phone_number")]
        public string PhoneNumber { get; set; } = string.Empty;

        [Column("email", TypeName = "varchar(150)")]
        public string? Email { get; set; }

        [ForeignKey("IdUser")]
        [JsonIgnore] 
        public User? User { get; set; }

        [JsonIgnore] 
        public ICollection<EventParticipant>? EventParticipants { get; set; }
    }
}