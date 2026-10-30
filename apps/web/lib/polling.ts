export function startPolling(
  task: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  onError: (error: unknown) => void,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController;
  let failures = 0;
  async function run() {
    controller = new AbortController();
    const timeout = setTimeout(
      () =>
        controller.abort(
          new DOMException("La consulta ha tardado demasiado.", "TimeoutError"),
        ),
      15000,
    );
    try {
      await task(controller.signal);
      failures = 0;
    } catch (error) {
      failures = Math.min(failures + 1, 4);
      if (!stopped) onError(error);
    } finally {
      clearTimeout(timeout);
      controller.abort();
      if (!stopped)
        timer = setTimeout(run, Math.min(intervalMs * 2 ** failures, 30000));
    }
  }
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
  };
}

// Cancel only this caller's wait, never a refresh shared by other requests.
export function waitForSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
