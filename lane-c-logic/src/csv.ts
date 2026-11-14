// csv.ts: CSV export for learning gain tables.
//
// Student display names come from roster imports, so they are untrusted. A cell
// that starts with = + - @ (or tab/CR) can run as a formula when someone opens
// the file in Excel or Sheets. We prefix those with a single quote so they stay
// plain text. Numbers are written by us, so they are never prefixed.

export type CsvCell = string | number | null | undefined;

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV string (CRLF line ends, as spreadsheets expect). */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

export interface GainCsvRow {
  name: string;
  className: string;
  concept: string;
  pre: number | null;
  post: number | null;
  gain: number | null;
  normalizedGain: number | null;
}

/** Incomplete rows export with blank gain cells and status "incomplete". */
export function gainRowsToCsv(rows: GainCsvRow[]): string {
  const r = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
  return toCsv(
    ['student', 'class', 'concept', 'pre_pct', 'post_pct', 'gain_points', 'normalized_gain', 'status'],
    rows.map((x) => [
      x.name,
      x.className,
      x.concept,
      r(x.pre),
      r(x.post),
      r(x.gain),
      r(x.normalizedGain),
      x.gain === null ? 'incomplete' : 'complete',
    ]),
  );
}
