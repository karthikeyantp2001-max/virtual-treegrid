export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ISO date (YYYY-MM-DD). Cheap and identical in every locale and time zone. */
export function formatDate(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}
