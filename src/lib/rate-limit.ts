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
