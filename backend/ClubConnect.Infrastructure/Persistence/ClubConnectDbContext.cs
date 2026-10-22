using ClubConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ClubConnect.Infrastructure.Persistence;

/// <summary>
/// EF Core context for ClubConnect. Owns the <see cref="Members"/>, <see cref="Clubs"/>,
/// <see cref="Memberships"/>, and <see cref="ClubInvites"/> tables and enforces relational constraints.
/// </summary>
public class ClubConnectDbContext : DbContext
{
    public ClubConnectDbContext(DbContextOptions<ClubConnectDbContext> options)
        : base(options)
    {
    }

    public DbSet<Member> Members => Set<Member>();

    public DbSet<Club> Clubs => Set<Club>();

    public DbSet<Membership> Memberships => Set<Membership>();

    public DbSet<ClubInvite> ClubInvites => Set<ClubInvite>();

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

        modelBuilder.Entity<Club>(entity =>
        {
            entity.ToTable("Clubs");

            entity.HasKey(c => c.Id);

            entity.Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(c => c.Description)
                .HasMaxLength(500);

            entity.Property(c => c.CreatedAtUtc)
                .IsRequired();

            entity.HasMany(c => c.Memberships)
                .WithOne(m => m.Club)
                .HasForeignKey(m => m.ClubId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(c => c.Invites)
                .WithOne(i => i.Club)
                .HasForeignKey(i => i.ClubId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Membership>(entity =>
        {
            entity.ToTable("Memberships");

            entity.HasKey(m => m.Id);

            entity.Property(m => m.Role)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(m => m.JoinedAtUtc)
                .IsRequired();

            entity.HasOne(m => m.Member)
                .WithMany(mem => mem.Memberships)
                .HasForeignKey(m => m.MemberId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(m => new { m.ClubId, m.MemberId })
                .IsUnique()
                .HasDatabaseName("IX_Memberships_ClubId_MemberId");
        });

        modelBuilder.Entity<ClubInvite>(entity =>
        {
            entity.ToTable("ClubInvites");

            entity.HasKey(i => i.Id);

            entity.Property(i => i.Code)
                .IsRequired()
                .HasMaxLength(6);

            entity.Property(i => i.CreatedAtUtc)
                .IsRequired();

            entity.Property(i => i.IsActive)
                .IsRequired();

            entity.HasIndex(i => i.Code)
                .IsUnique()
                .HasDatabaseName("IX_ClubInvites_Code");

            entity.HasIndex(i => i.ClubId)
                .HasDatabaseName("IX_ClubInvites_ClubId");
        });
    }
}
