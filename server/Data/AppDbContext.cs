using Microsoft.EntityFrameworkCore;
using server.Models.Entities;

namespace server.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Tables
        public DbSet<Admin> Admins { get; set; }
        public DbSet<Faculty> Faculties { get; set; }
        public DbSet<ProgramHead> ProgramHeads { get; set; }
        public DbSet<Student> Students { get; set; }
        public DbSet<ResearchGroup> ResearchGroups { get; set; }
        public DbSet<Thesis> Theses { get; set; }
        public DbSet<Submission> Submissions { get; set; }
        public DbSet<Review> Reviews { get; set; }
        public DbSet<Schedule> Schedules { get; set; }
        public DbSet<PanelistSchedule> PanelistSchedules { get; set; }
        public DbSet<ChatSession> ChatSessions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<Admin>(entity =>
            {
                entity.ToTable("Admins");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasMaxLength(128)
                      .ValueGeneratedNever(); // Firebase UID, we supply it
                entity.Property(e => e.Position)
                      .HasMaxLength(100);
            });

            modelBuilder.Entity<Faculty>(entity =>
            {
                entity.ToTable("Faculty");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasMaxLength(128)
                      .ValueGeneratedNever();
                entity.Property(e => e.Institute)
                      .HasMaxLength(100);
            });

            modelBuilder.Entity<ProgramHead>(entity =>
            {
                entity.ToTable("ProgramHeads");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasMaxLength(128)
                      .ValueGeneratedNever();
                entity.Property(e => e.Institute)
                      .HasMaxLength(100);
                entity.Property(e => e.ProgramHandled)
                      .HasMaxLength(100);
            });


            modelBuilder.Entity<Student>(entity =>
            {
                entity.ToTable("Students");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasMaxLength(128)
                      .ValueGeneratedNever();
                entity.Property(e => e.StudentNumber)
                      .HasMaxLength(20)
                      .IsRequired();
                entity.HasIndex(e => e.StudentNumber)
                      .IsUnique();                         
                entity.Property(e => e.Position)
                      .HasMaxLength(50);
                entity.Property(e => e.Institute)
                      .HasMaxLength(100);
                entity.Property(e => e.Program)
                      .HasMaxLength(100);
                entity.Property(e => e.Section)
                      .HasMaxLength(1);

                entity.HasOne(e => e.ResearchGroup)
                      .WithMany()
                      .HasForeignKey(e => e.GroupId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            modelBuilder.Entity<ResearchGroup>(entity =>
            {
                entity.ToTable("ResearchGroups");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasDefaultValueSql("NEWID()");
                entity.Property(e => e.CreatedAt)
                      .HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.UpdatedAt)
                      .HasDefaultValueSql("GETUTCDATE()");
            });

            modelBuilder.Entity<Thesis>(entity =>
            {
                entity.ToTable("Theses");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasDefaultValueSql("NEWID()");
                entity.Property(e => e.Title)
                      .HasMaxLength(255)
                      .IsRequired();
                entity.Property(e => e.Abstract)
                      .IsRequired();
                entity.Property(e => e.FilePath)
                      .IsRequired();
                entity.Property(e => e.UploadedById)
                      .HasMaxLength(128)
                      .IsRequired();
                entity.Property(e => e.Status)
                      .HasMaxLength(15)
                      .HasDefaultValue("Pending")
                      .IsRequired();
                entity.Property(e => e.PineconeStatus)
                      .HasMaxLength(20)
                      .HasDefaultValue("None");
                entity.Property(e => e.UpdatedAt)
                      .HasDefaultValueSql("GETUTCDATE()");

                entity.HasMany(e => e.Submissions)
                      .WithOne(s => s.Thesis)
                      .HasForeignKey(s => s.ThesisId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Submission>(entity =>
            {
                entity.ToTable("Submissions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasDefaultValueSql("NEWID()");
                entity.Property(e => e.StudentNumber)
                      .HasMaxLength(20)
                      .IsRequired();
                entity.Property(e => e.Notes)
                      .HasMaxLength(999);

                entity.HasOne(e => e.Student)
                      .WithMany()
                      .HasForeignKey(e => e.StudentNumber)
                      .HasPrincipalKey(s => s.StudentNumber) 
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Review>(entity =>
            {
                entity.ToTable("Reviews");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasDefaultValueSql("NEWID()");
                entity.Property(e => e.ReviewerId)
                      .HasMaxLength(128)
                      .IsRequired();
                entity.Property(e => e.Decision)
                      .HasMaxLength(20)
                      .IsRequired();
                entity.Property(e => e.Comments)
                      .HasMaxLength(1000);

                entity.HasOne(e => e.Thesis)
                      .WithMany()
                      .HasForeignKey(e => e.ThesisId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Schedule>(entity =>
            {
                entity.ToTable("Schedules");
                entity.HasKey(e => e.ScheduleId);
                entity.Property(e => e.ScheduleId)
                      .HasDefaultValueSql("NEWID()");
                entity.Property(e => e.ScheduledBy)
                      .HasMaxLength(128)
                      .IsRequired();
                entity.Property(e => e.RoomVenue)
                      .HasMaxLength(256)
                      .IsRequired();
                entity.Property(e => e.AdditionalInformation)
                      .HasMaxLength(256);

                entity.HasOne(e => e.ResearchGroup)
                      .WithMany()
                      .HasForeignKey(e => e.GroupId)
                      .OnDelete(DeleteBehavior.SetNull);

                // Schedule → PanelistSchedules
                entity.HasMany(e => e.Panelists)
                      .WithOne(p => p.Schedule)
                      .HasForeignKey(p => p.ScheduleId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<PanelistSchedule>(entity =>
            {
                entity.ToTable("PanelistSchedules");
                entity.HasKey(e => new { e.ScheduleId, e.PanelistId });
                entity.Property(e => e.PanelistId)
                      .HasMaxLength(128)
                      .IsRequired();
                entity.Property(e => e.PanelistType)
                      .HasMaxLength(20);
            });

            modelBuilder.Entity<ChatSession>(entity =>
            {
                entity.ToTable("ChatSessions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id)
                      .HasDefaultValueSql("NEWID()");
                entity.Property(e => e.UserId)
                      .HasMaxLength(128)
                      .IsRequired();
                entity.Property(e => e.Title)
                      .HasMaxLength(256);
                entity.Property(e => e.CreatedAt)
                      .HasDefaultValueSql("GETUTCDATE()");
                entity.Property(e => e.LastChatDate)
                      .HasDefaultValueSql("GETUTCDATE()");
            });
        }
    }
}