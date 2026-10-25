import { CoverConfig, LyricLine, SongInfo } from './types';

export interface TaskStatus<T> {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result: T | null;
  error: string | null;
}

/** Poll a backend background task until it completes or fails. */
export function pollTask<T>(
  taskId: string,
  onProgress: (progress: number, message: string) => void,
  intervalMs = 1500
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const resp = await fetch(`/api/cover/status/${taskId}`);
        const data: TaskStatus<T> = await resp.json();
        if (data.status === 'completed' && data.result) {
          clearInterval(timer);
          resolve(data.result);
        } else if (data.status === 'failed') {
          clearInterval(timer);
          reject(new Error(data.error || 'Task failed'));
        } else {
          onProgress(data.progress || 0, data.message || 'Working...');
        }
      } catch {
        clearInterval(timer);
        reject(new Error('Network error while checking progress'));
      }
    }, intervalMs);
  });
}

export async function readError(resp: Response, fallback: string): Promise<string> {
  try {
    const data = await resp.json();
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

export const PREVIEW_SECONDS = 35;

/** Lines that will actually be sung, with edits applied and preview window enforced. */
export function linesToSing(song: SongInfo, config: CoverConfig): LyricLine[] {
  const chosen = song.lines
    .map((l, i) => ({ ...l, text: (config.lineEdits[i] ?? l.text).trim() }))
    .filter((l, i) => config.lineSelection[i] !== false && l.text);
  if (config.length === 'full' || chosen.length === 0) return chosen;
  const windowEnd = chosen[0].start + PREVIEW_SECONDS;
  return chosen.filter((l) => l.start < windowEnd);
}

/** Output length: through the last sung line plus a short tail, capped for full tracks. */
export function coverDuration(song: SongInfo, lines: LyricLine[]): number {
  if (lines.length === 0) return 30;
  const lastEnd = Math.max(...lines.map((l) => l.end));
  return Math.min(lastEnd + 4, song.duration || lastEnd + 4, 300);
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
