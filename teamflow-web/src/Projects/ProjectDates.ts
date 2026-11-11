const pad = (n: number) => String(n).padStart(2, "0");

/** Today's local date as yyyy-mm-dd. */
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Shows a yyyy-mm-dd value as a readable date. */
export function formatDateKey(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Returns an error message, or null when the due date is valid. Empty means no due date. */
export function dueDateError(due: string, start: string): string | null {
  if (!due) return null;
  if (due < start) return "Due date can't be before the start date.";
  return null;
}