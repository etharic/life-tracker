/**
 * The app's own names for its ideas, kept in one place so a rename reaches every screen,
 * the yearly book, viewer.html and the README together.
 */
export const NAMES = {
  /** What defined a year (stored as defining_incident). */
  defining: 'Defining moment',
  definingPlural: 'Defining moments',
  /** The challenge committed at a year's review for the following year. */
  misogi: 'Misogi',
  /** The month's one uncomfortable thing. */
  kevin: 'Kevin’s Rule',
  kevinPlural: 'Kevin’s Rules',
} as const;

/** "Misogi 2027" */
export const misogiOf = (year: string | number) => `${NAMES.misogi} ${year}`;
