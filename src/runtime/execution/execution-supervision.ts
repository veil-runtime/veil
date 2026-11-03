// Internal observation of actual work, independently of interruptible waits.
export type TrackExecutionWork = <T>(operation: () => T | PromiseLike<T>) => Promise<T>;

// Internal per-submission supervision. It governs scheduling, not external effects.
export class ExecutionSupervision {
  private readonly controller = new AbortController();
  private readonly expiresAt?: number;
  private timer?: ReturnType<typeof setTimeout>;
  private failure?: Error;
  private readonly cancel = () => this.stop('Execution cancelled');

  constructor(private readonly hostSignal?: AbortSignal, timeoutMs?: number) {
    if (timeoutMs !== undefined) {
      if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 2_147_483_647) {
        throw new Error('timeoutMs must be an integer between 0 and 2147483647');
      }
      this.expiresAt = performance.now() + timeoutMs;
      this.timer = setTimeout(() => this.stop('Execution deadline exceeded'), timeoutMs);
    }
    hostSignal?.addEventListener('abort', this.cancel, { once: true });
    if (hostSignal?.aborted) this.cancel();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  checkpoint(): void {
    if (this.expiresAt !== undefined && performance.now() >= this.expiresAt) {
      this.stop('Execution deadline exceeded');
    }
    if (this.failure) throw this.failure;
  }

  wait<T>(operation: () => T | PromiseLike<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        this.signal.removeEventListener('abort', onAbort);
        reject(this.failure);
      };
      try {
        this.checkpoint();
        this.signal.addEventListener('abort', onAbort, { once: true });
        // Both settlement handlers remain attached even after logical termination.
        Promise.resolve(operation()).then(value => {
          this.signal.removeEventListener('abort', onAbort);
          try {
            this.checkpoint();
            resolve(value);
          } catch (error) {
            reject(error);
          }
        }, error => {
          this.signal.removeEventListener('abort', onAbort);
          try {
            this.checkpoint();
            reject(error);
          } catch (termination) {
            reject(termination);
          }
        });
      } catch (error) {
        this.signal.removeEventListener('abort', onAbort);
        reject(this.failure ?? error);
      }
    });
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.hostSignal?.removeEventListener('abort', this.cancel);
  }

  private stop(message: string): void {
    if (this.failure) return;
    this.failure = new Error(message);
    clearTimeout(this.timer);
    this.controller.abort(this.failure);
  }
}
