using Microsoft.EntityFrameworkCore;
using DigiAlert.Api.Models;

namespace DigiAlert.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<Contact> Contacts { get; set; }
        public DbSet<Event> Events { get; set; }
        public DbSet<EventParticipant> EventParticipants { get; set; }
        public DbSet<Reminder> Reminders { get; set; }
        public DbSet<SmsTemplate> SmsTemplates { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<EventParticipant>()
                .HasKey(ep => new { ep.IdEvent, ep.IdContact });
                
            modelBuilder.Entity<Reminder>()
                .Property(r => r.Purpose)
                .HasDefaultValue(ReminderPurpose.Reminder)
                .IsRequired();
        }
    }
}