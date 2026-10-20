/**
 * Escape one value for a CSV cell.
 *
 * Besides RFC 4180 quoting, cells that start with `=`, `+`, `-`, `@`, tab
 * or carriage return are prefixed with a single quote: spreadsheets treat
 * such cells as formulas, so a user-chosen name like `=HYPERLINK(...)`
 * would otherwise run when an admin opens the export in Excel or Sheets.
 */
export function csvEscape(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}
