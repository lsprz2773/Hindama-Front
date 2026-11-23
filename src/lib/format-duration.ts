/** Duración `m:ss` entre dos instantes ISO; `null` si falta alguno. */
export function formatDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const seconds = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
