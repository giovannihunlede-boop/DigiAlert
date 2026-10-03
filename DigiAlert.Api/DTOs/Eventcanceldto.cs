using System.ComponentModel.DataAnnotations;

namespace DigiAlert.Api.DTOs
{
    
    public class EventCancelDto
    {
        [Required(ErrorMessage = "Le message d'annulation est obligatoire.")]
        [StringLength(500, MinimumLength = 3, ErrorMessage = "Le message doit contenir entre 3 et 500 caractères.")]
        public string Message { get; set; } = string.Empty;
    }
}