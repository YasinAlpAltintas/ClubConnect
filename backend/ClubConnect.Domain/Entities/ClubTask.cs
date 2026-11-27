namespace ClubConnect.Domain.Entities;

/// <summary>
/// A unit of work tracked on a club's Kanban board (INC-27).
/// </summary>
public class ClubTask
{
    public Guid Id { get; init; } = Guid.NewGuid();

    /// <summary>ID of the owning club workspace.</summary>
    public Guid ClubId { get; set; }

    /// <summary>Owning club entity.</summary>
    public Club? Club { get; set; }

    /// <summary>Short title of the task (e.g. "Book the sports hall").</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Optional details about the task.</summary>
    public string? Description { get; set; }

    /// <summary>Current workflow status, which decides the board column.</summary>
    public ClubTaskStatus Status { get; set; } = ClubTaskStatus.ToDo;

    /// <summary>ID of the club member the task is assigned to, or null when unassigned.</summary>
    public Guid? AssigneeMemberId { get; set; }

    /// <summary>Member the task is assigned to, or null when unassigned.</summary>
    public Member? Assignee { get; set; }

    /// <summary>ID of the club member who created the task.</summary>
    public Guid CreatedByMemberId { get; set; }

    /// <summary>Member who created the task.</summary>
    public Member? CreatedByMember { get; set; }

    /// <summary>Creation timestamp in UTC.</summary>
    public DateTimeOffset CreatedAtUtc { get; init; } = DateTimeOffset.UtcNow;
}
