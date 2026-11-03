// Best effort only. Never serialize foreign values or route diagnostics through
// execution logging. Bound output per process, including recursive reporters.
let remaining = 10;
let reporting = false;

export function reportLoggingFailure(): void {
  if (reporting || remaining === 0) return;
  remaining -= 1;
  reporting = true;
  try {
    void Promise.resolve(console.error(
      '[veil] Internal logging failure; execution continues. Further diagnostics are limited.'
    )).catch(() => {});
  } catch {
    // A broken diagnostic destination must not become an execution failure.
  } finally {
    reporting = false;
  }
}
