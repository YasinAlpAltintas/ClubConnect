namespace ClubConnect.Domain.Entities;

/// <summary>
/// Workflow status of a <see cref="ClubTask"/> on the club's Kanban board (INC-27).
/// The declaration order is the board's column order: To Do → In Progress → Done.
/// </summary>
public enum ClubTaskStatus
{
    ToDo = 0,
    InProgress = 1,
    Done = 2
}
