using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

namespace DigiAlert.Api.Models
{
    [Table("users")]
    [Index(nameof(Email), IsUnique = true)]
    public class User
    {
        [Column("role")]
        public string Role { get; set; } = "Owner"; 

        [Column("parent_id")]
        public Guid? ParentId { get; set; } 

        [Column("kiosk_token")]
        [JsonIgnore] 
        public Guid KioskToken { get; set; } = Guid.NewGuid();
        
        [Key]
        [Column("id_user")]
        public Guid IdUser { get; set; }

        [Required]
        [Column("company_name")]
        public string CompanyName { get; set; } = string.Empty;

        [Required, EmailAddress]
        [Column("email")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [Column("password_hash")]
        [JsonIgnore]
        public string PasswordHash { get; set; } = string.Empty;

        [Column("reset_token")]
        [JsonIgnore]
        public string? ResetToken { get; set; }

        [Column("reset_token_expires")]
        [JsonIgnore]
        public DateTime? ResetTokenExpires { get; set; }

        [Column("api_key")]
        [JsonIgnore]
        public string? ApiKey { get; set; }

        [Column("sender_id")]
        [MaxLength(11)]
        public string? SenderId { get; set; }

        [Column("email_api_key")]
        [JsonIgnore]
        public string? EmailApiKey { get; set; }

        [Column("email_sender")]
        public string? EmailSender { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        
        [JsonIgnore]
        public ICollection<Contact>? Contacts { get; set; }
        
        [JsonIgnore]
        public ICollection<Event>? Events { get; set; }
        
        [JsonIgnore]
        public ICollection<SmsTemplate>? SmsTemplates { get; set; }
    }
}