using System.ComponentModel.DataAnnotations;

namespace DigiAlert.Api.DTOs
{
    public class TeamMemberDto
    {
        [Required(ErrorMessage = "un nom est obligatoire.")]
        public string FirstName { get; set; } = string.Empty;

        [Required(ErrorMessage = "L'email est obligatoire.")]
        [EmailAddress(ErrorMessage = "Format d'email invalide.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Un mot de passe provisoire est obligatoire.")]
        public string Password { get; set; } = string.Empty;

        public string Role { get; set; } = "User";
    }
}