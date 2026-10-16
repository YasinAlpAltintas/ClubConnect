using ClubConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClubConnect.Infrastructure.Persistence;

/// <summary>
/// EF Core context for ClubConnect. Owns the <see cref="Members"/> table and
/// enforces the unique index on canonical e-mail at the schema level.
/// </summary>
public class ClubConnectDbContext : DbContext
{
    public ClubConnectDbContext(DbContextOptions<ClubConnectDbContext> options)
        : base(options)
    {
    }

    public DbSet<Member> Members => Set<Member>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // The Application layer canonicalizes e-mail (lower-cased, trimmed)
        // before persistence, so a plain unique index is sufficient and avoids
        // a hard dependency on the Postgres citext extension.
        modelBuilder.Entity<Member>(entity =>
        {
            entity.ToTable("Members");

            entity.HasKey(m => m.Id);

            entity.Property(m => m.Email)
                .IsRequired()
                .HasMaxLength(320);

            entity.Property(m => m.PasswordHash)
                .IsRequired()
                .HasMaxLength(512);

            entity.Property(m => m.DisplayName)
                .IsRequired()
                .HasMaxLength(120);

            entity.Property(m => m.CreatedAtUtc)
                .IsRequired();

            entity.HasIndex(m => m.Email)
                .IsUnique()
                .HasDatabaseName("IX_Members_Email");
        });
    }
}
