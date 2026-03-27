export interface ParsedTimer {
  label: string;
  minutes: number;
  startIndex: number;
  endIndex: number;
}

const TIME_PATTERNS = [
  // "25 minutes", "25 min", "25 mins", "25-30 minutes"
  /(\d+)(?:\s*[-–]\s*\d+)?\s*(?:minutes?|mins?)\b/gi,
  // "1 hour", "2 hours", "1.5 hours"
  /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi,
  // "1 hour and 30 minutes", "1 hour 30 minutes"
  /(\d+)\s*(?:hours?|hrs?)\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?)\b/gi,
  // "30 seconds" (convert to 1 min minimum)
  /(\d+)\s*(?:seconds?|secs?)\b/gi,
];

export function parseTimers(instruction: string): ParsedTimer[] {
  const timers: ParsedTimer[] = [];
  const seen = new Set<string>();

  // "1 hour and 30 minutes" pattern first (most specific)
  const hourMinRe = /(\d+)\s*(?:hours?|hrs?)\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?)/gi;
  let m: RegExpExecArray | null;
  while ((m = hourMinRe.exec(instruction)) !== null) {
    const mins = parseInt(m[1]) * 60 + parseInt(m[2]);
    const key = `${m.index}-${m.index + m[0].length}`;
    if (!seen.has(key) && mins > 0) {
      seen.add(key);
      timers.push({ label: m[0], minutes: mins, startIndex: m.index, endIndex: m.index + m[0].length });
    }
  }

  // "X hours"
  const hourRe = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/gi;
  while ((m = hourRe.exec(instruction)) !== null) {
    if (overlaps(m.index, m.index + m[0].length, timers)) continue;
    const mins = Math.round(parseFloat(m[1]) * 60);
    if (mins > 0) {
      timers.push({ label: m[0], minutes: mins, startIndex: m.index, endIndex: m.index + m[0].length });
    }
  }

  // "X minutes"
  const minRe = /(\d+)(?:\s*[-–]\s*(\d+))?\s*(?:minutes?|mins?)/gi;
  while ((m = minRe.exec(instruction)) !== null) {
    if (overlaps(m.index, m.index + m[0].length, timers)) continue;
    const mins = m[2] ? Math.round((parseInt(m[1]) + parseInt(m[2])) / 2) : parseInt(m[1]);
    if (mins > 0) {
      timers.push({ label: m[0], minutes: mins, startIndex: m.index, endIndex: m.index + m[0].length });
    }
  }

  // "X seconds" (minimum 1 min)
  const secRe = /(\d+)\s*(?:seconds?|secs?)/gi;
  while ((m = secRe.exec(instruction)) !== null) {
    if (overlaps(m.index, m.index + m[0].length, timers)) continue;
    const mins = Math.max(1, Math.round(parseInt(m[1]) / 60));
    timers.push({ label: m[0], minutes: mins, startIndex: m.index, endIndex: m.index + m[0].length });
  }

  return timers.sort((a, b) => a.startIndex - b.startIndex);
}

function overlaps(start: number, end: number, existing: ParsedTimer[]): boolean {
  return existing.some((t) => start < t.endIndex && end > t.startIndex);
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
