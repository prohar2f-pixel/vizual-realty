export class RateLimiter {
  private last = 0;
  constructor(private intervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const waitMs = this.last + this.intervalMs - now;
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    this.last = Date.now();
  }
}

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type WindowState = {
  count: number;
  startedAt: number;
};

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new TypeError("maxAttempts must be a positive integer");
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new TypeError("windowMs must be positive");
    }
  }

  consume(key: string, now = Date.now()): RateLimitDecision {
    let state = this.windows.get(key);
    if (!state || now - state.startedAt >= this.windowMs || now < state.startedAt) {
      this.makeRoom(now);
      state = { count: 0, startedAt: now };
      this.windows.set(key, state);
    }

    if (state.count >= this.maxAttempts) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((state.startedAt + this.windowMs - now) / 1_000),
        ),
      };
    }

    state.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private makeRoom(now: number) {
    if (this.windows.size < this.maxKeys) return;

    for (const [key, state] of this.windows) {
      if (now - state.startedAt >= this.windowMs || now < state.startedAt) {
        this.windows.delete(key);
      }
    }

    if (this.windows.size >= this.maxKeys) {
      const oldestKey = this.windows.keys().next().value;
      if (oldestKey !== undefined) this.windows.delete(oldestKey);
    }
  }
}
