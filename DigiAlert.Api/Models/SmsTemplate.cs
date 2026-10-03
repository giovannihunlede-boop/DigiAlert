using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DigiAlert.Api.Models
{
    [Table("sms_templates")]
    public class SmsTemplate
    {
        [Key]
        [Column("id_template")]
        public Guid IdTemplate { get; set; }

        [Required]
        [Column("id_user")]
        public Guid IdUser { get; set; }

        [Required]
        [Column("template_name")]
        public string TemplateName { get; set; } = string.Empty;

        [Required]
        [Column("message_content")]
        public string MessageContent { get; set; } = string.Empty;

        // Relations
        [ForeignKey("IdUser")]
        public User? User { get; set; }
    }
}