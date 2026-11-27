import { useTranslation } from 'react-i18next'
import { type ClubTaskDto, type ClubTaskStatus } from '../lib/api'

export interface KanbanBoardProps {
  tasks: ClubTaskDto[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

// Board column order: To Do → In Progress → Done.
const COLUMNS: ClubTaskStatus[] = ['todo', 'in_progress', 'done']

const COLUMN_ACCENTS: Record<ClubTaskStatus, string> = {
  todo: 'bg-aurora-text-muted',
  in_progress: 'bg-aurora-primary',
  done: 'bg-aurora-secondary',
}

function TaskCard({ task }: { task: ClubTaskDto }) {
  const { t } = useTranslation()
  const assignee = task.assigneeDisplayName?.trim()

  return (
    <li
      data-testid={`kanban-task-${task.id}`}
      className="rounded-xl bg-aurora-elevated p-3 ring-1 ring-aurora-border"
    >
      <h4 data-testid="kanban-task-title" className="text-sm font-semibold text-aurora-text break-words">
        {task.title}
      </h4>
      {task.description && (
        <p
          data-testid="kanban-task-description"
          className="mt-1 text-xs text-aurora-text-secondary leading-relaxed line-clamp-3 break-words"
          title={task.description}
        >
          {task.description}
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-aurora-text-muted">
        <span className="sr-only">{t('tasks.assignee')}:</span>
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span
          data-testid="kanban-task-assignee"
          className={assignee ? 'font-medium text-aurora-text-secondary' : 'italic'}
        >
          {assignee || t('tasks.unassigned')}
        </span>
      </p>
    </li>
  )
}

export default function KanbanBoard({ tasks, isLoading = false, isError = false, onRetry }: KanbanBoardProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div
        data-testid="kanban-loading"
        role="status"
        aria-live="polite"
        className="flex flex-col items-center justify-center gap-3 py-20"
      >
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-aurora-primary border-r-transparent" />
        <span className="text-xs text-aurora-text-secondary">{t('tasks.loading')}</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div data-testid="kanban-error" role="alert" className="rounded-2xl bg-aurora-surface py-12 text-center ring-1 ring-aurora-border">
        <p className="text-sm font-medium text-aurora-danger-bright">{t('tasks.errorMessage')}</p>
        {onRetry && (
          <button
            type="button"
            data-testid="kanban-retry-btn"
            onClick={onRetry}
            className="btn-tactile mt-4 rounded-xl bg-aurora-primary px-4 py-2 text-xs font-semibold text-aurora-on-accent hover:bg-aurora-primary-hover cursor-pointer"
          >
            {t('tasks.retry')}
          </button>
        )}
      </div>
    )
  }

  const isBoardEmpty = tasks.length === 0

  return (
    <div className="space-y-4">
      {isBoardEmpty && (
        <div
          data-testid="kanban-empty-board"
          className="rounded-2xl bg-aurora-surface px-6 py-5 text-center ring-1 ring-aurora-border"
        >
          <p className="text-sm font-semibold text-aurora-text">{t('tasks.emptyBoardTitle')}</p>
          <p className="mt-1 text-xs text-aurora-text-secondary">{t('tasks.emptyBoardDesc')}</p>
        </div>
      )}

      <div
        data-testid="kanban-board"
        aria-label={t('tasks.boardLabel')}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        {COLUMNS.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status)
          return (
            <section
              key={status}
              data-testid={`kanban-column-${status}`}
              aria-labelledby={`kanban-column-heading-${status}`}
              className="flex flex-col rounded-2xl bg-aurora-surface p-4 ring-1 ring-aurora-border"
            >
              <header className="mb-3 flex items-center justify-between">
                <h3
                  id={`kanban-column-heading-${status}`}
                  className="flex items-center gap-2 text-sm font-bold text-aurora-text"
                >
                  <span className={`h-2 w-2 rounded-full ${COLUMN_ACCENTS[status]}`} aria-hidden="true" />
                  {t(`tasks.columns.${status}`)}
                </h3>
                <span
                  data-testid={`kanban-column-count-${status}`}
                  className="rounded-full bg-aurora-elevated px-2 py-0.5 text-[10px] font-semibold text-aurora-text-secondary ring-1 ring-aurora-border"
                >
                  {t('tasks.taskCount', { count: columnTasks.length })}
                </span>
              </header>

              {columnTasks.length === 0 ? (
                <p
                  data-testid={`kanban-column-empty-${status}`}
                  className="rounded-xl border border-dashed border-aurora-border py-6 text-center text-xs text-aurora-text-muted"
                >
                  {t('tasks.emptyColumn')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
