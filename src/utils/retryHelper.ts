/**
 * Exponential backoff retry helper. Attempts the asyncFn up to maxAttempts.
 * Delay between attempts: baseDelay * 2^(attempt - 1) ms.
 */
export async function retryWithExponentialBackoff<T>(
  asyncFn: () => Promise<T>,
  maxAttempts: number,
  baseDelayMs: number = 1000
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await asyncFn();
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
