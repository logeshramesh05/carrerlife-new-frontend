export async function timed(label, promise) {
  const start = performance.now();
  try {
    return await promise;
  } finally {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log(`[timing] ${label}: ${Math.round(performance.now() - start)}ms`);
    }
  }
}
