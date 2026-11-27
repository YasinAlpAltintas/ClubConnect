import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import KanbanBoard from './KanbanBoard'
import { type ClubTaskDto } from '../lib/api'

const task = (overrides: Partial<ClubTaskDto>): ClubTaskDto => ({
  id: 'task-id',
  clubId: 'club-a',
  title: 'Task',
  description: null,
  status: 'todo',
  assigneeMemberId: null,
  assigneeDisplayName: null,
  createdAtUtc: '2026-11-01T10:00:00Z',
  ...overrides,
})

const sampleTasks: ClubTaskDto[] = [
  task({
    id: 'a-t1',
    title: 'Book the hall',
    description: 'Reserve the main hall for Friday',
    status: 'todo',
    assigneeMemberId: 'm-1',
    assigneeDisplayName: 'Alice Admin',
  }),
  task({ id: 'a-t2', title: 'Order new boards', status: 'in_progress' }),
  task({ id: 'a-t3', title: 'Send newsletter', status: 'done', assigneeMemberId: 'm-2', assigneeDisplayName: 'Bob' }),
]

describe('KanbanBoard', () => {
  it('renders To Do, In Progress and Done columns in that order (TC-27-01)', () => {
    render(<KanbanBoard tasks={sampleTasks} />)

    const headings = within(screen.getByTestId('kanban-board'))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(headings).toEqual(['To Do', 'In Progress', 'Done'])
  })

  it('groups each task in the column matching its saved status (TC-27-02)', () => {
    render(<KanbanBoard tasks={sampleTasks} />)

    expect(within(screen.getByTestId('kanban-column-todo')).getByText('Book the hall')).toBeInTheDocument()
    expect(within(screen.getByTestId('kanban-column-in_progress')).getByText('Order new boards')).toBeInTheDocument()
    expect(within(screen.getByTestId('kanban-column-done')).getByText('Send newsletter')).toBeInTheDocument()
    expect(within(screen.getByTestId('kanban-column-todo')).queryByText('Send newsletter')).not.toBeInTheDocument()
    expect(screen.getByTestId('kanban-column-count-todo')).toHaveTextContent('1 task')
  })

  it('shows title, description and assignee name on a card (TC-27-03)', () => {
    render(<KanbanBoard tasks={sampleTasks} />)

    const card = screen.getByTestId('kanban-task-a-t1')
    expect(within(card).getByTestId('kanban-task-title')).toHaveTextContent('Book the hall')
    expect(within(card).getByTestId('kanban-task-description')).toHaveTextContent('Reserve the main hall for Friday')
    expect(within(card).getByTestId('kanban-task-assignee')).toHaveTextContent('Alice Admin')
  })

  it('shows Unassigned when a task has no assignee (TC-27-04)', () => {
    render(<KanbanBoard tasks={sampleTasks} />)

    const card = screen.getByTestId('kanban-task-a-t2')
    expect(within(card).getByTestId('kanban-task-assignee')).toHaveTextContent('Unassigned')
    expect(within(card).queryByTestId('kanban-task-description')).not.toBeInTheDocument()
  })

  it('keeps an empty column visible with a placeholder (TC-27-05)', () => {
    render(<KanbanBoard tasks={sampleTasks.filter((t) => t.status !== 'done')} />)

    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument()
    expect(screen.getByTestId('kanban-column-empty-done')).toHaveTextContent('No tasks here')
    expect(screen.queryByTestId('kanban-empty-board')).not.toBeInTheDocument()
  })

  it('shows all columns plus an empty-board state when there are no tasks (TC-27-06)', () => {
    render(<KanbanBoard tasks={[]} />)

    expect(screen.getByTestId('kanban-empty-board')).toHaveTextContent('No tasks yet')
    expect(screen.getByTestId('kanban-column-todo')).toBeInTheDocument()
    expect(screen.getByTestId('kanban-column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-error')).not.toBeInTheDocument()
  })

  it('shows a loading state instead of a false empty board (TC-27-07)', () => {
    render(<KanbanBoard tasks={[]} isLoading />)

    expect(screen.getByTestId('kanban-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-empty-board')).not.toBeInTheDocument()
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
  })

  it('shows an error with retry instead of stale or empty content (TC-27-08)', () => {
    const onRetry = vi.fn()
    render(<KanbanBoard tasks={sampleTasks} isError onRetry={onRetry} />)

    expect(screen.getByTestId('kanban-error')).toHaveTextContent('Failed to load the task board')
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
    expect(screen.queryByTestId('kanban-empty-board')).not.toBeInTheDocument()
    expect(screen.queryByText('Book the hall')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('kanban-retry-btn'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
