export async function retryWithExponentialBackoff(asyncFn, maxAttempts, baseDelayMs = 1000) {
    let attempt = 1;
    while (true) {
        try {
            return await asyncFn();
        }
        catch (err) {
            if (attempt >= maxAttempts) {
                throw err;
            }
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            attempt++;
        }
    }
}
