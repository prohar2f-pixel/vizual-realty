type Window = { count: number; startedAt: number };
const windows = new Map<string, Window>();

export function consumeLoginAttempt(key: string, now = Date.now()) {
  const duration = 15 * 60_000, limit = 5;
  let state = windows.get(key);
  if (!state || now - state.startedAt >= duration || now < state.startedAt) { state = { count: 0, startedAt: now }; windows.set(key, state); }
  if (state.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((state.startedAt + duration - now) / 1000)) };
  state.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
