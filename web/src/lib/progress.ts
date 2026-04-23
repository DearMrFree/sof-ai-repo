// Progress tracking — stored client-side in localStorage for v1.
// A future version will sync this to the FastAPI backend at SOF_API_URL so
// learners can resume across devices.

const KEY = "sof.ai:progress:v1";

export interface ProgressState {
  // programSlug -> lessonSlug -> { completedAt: ISO string, activityIds: string[] }
  [programSlug: string]: {
    [lessonSlug: string]: {
      completedAt: string;
      activityIds: string[];
    };
  };
}

export function readProgress(): ProgressState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressState;
  } catch {
    return {};
  }
}

export function writeProgress(state: ProgressState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export function markLessonComplete(
  programSlug: string,
  lessonSlug: string,
  activityIds: string[] = [],
) {
  const state = readProgress();
  state[programSlug] ??= {};
  state[programSlug][lessonSlug] = {
    completedAt: new Date().toISOString(),
    activityIds,
  };
  writeProgress(state);
}

export function isLessonComplete(
  state: ProgressState,
  programSlug: string,
  lessonSlug: string,
): boolean {
  return !!state[programSlug]?.[lessonSlug]?.completedAt;
}

export function programCompletionPct(
  state: ProgressState,
  programSlug: string,
  totalLessons: number,
): number {
  if (totalLessons === 0) return 0;
  const completed = Object.keys(state[programSlug] ?? {}).length;
  return Math.round((completed / totalLessons) * 100);
}
