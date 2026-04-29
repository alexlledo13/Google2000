export async function register() {
  // Only warm up the index in Node.js (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getStats } = await import('@/lib/crawler')
    await getStats()
  }
}
