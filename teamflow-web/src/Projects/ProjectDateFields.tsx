import { dueDateError, formatDateKey, todayKey } from "./ProjectDates";

interface ProjectDateFieldsProps {
  readonly startDate: string | null;
  readonly dueDate: string;
  readonly onDueChange: (value: string) => void;
  readonly isNew?: boolean;
  readonly disabled?: boolean;
}

/** Start date is read-only. Due date is optional and can be cleared. */
export default function ProjectDateFields({
  startDate,
  dueDate,
  onDueChange,
  isNew = false,
  disabled = false,
}: ProjectDateFieldsProps) {
  const start = startDate ? startDate.slice(0, 10) : todayKey();
  const min = isNew ? todayKey() : start;
  const error = dueDateError(dueDate, start);

  return (
    <>
      <div className="dlg-row">
        <div className="dlg-field">
          <span>Start date</span>
          <output className="pd-static">{formatDateKey(start)}</output>
          <small className="dlg-hint">
            {isNew ? "Set automatically when the project is created." : "Set when the project was created."}
          </small>
        </div>

        <label className="dlg-field">
          <span>Due date</span>
          <input
            type="date"
            min={min}
            value={dueDate}
            onChange={(e) => onDueChange(e.target.value)}
            disabled={disabled}
          />
          <div className="pd-hint-row">
            <small className="dlg-hint">Optional</small>
            <button
              type="button"
              className="pd-clear"
              onClick={() => onDueChange("")}
              disabled={disabled || !dueDate}
            >
              Clear
            </button>
          </div>
        </label>
      </div>

      {error && (
        <p className="dlg-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}