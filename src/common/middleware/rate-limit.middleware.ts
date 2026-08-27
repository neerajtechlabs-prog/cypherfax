// This app intentionally uses @nestjs/throttler in AppModule instead of proxy.ts.
// The in-memory limiter below is kept only as a documented reference: it is still process-local
// and not shared across multiple app instances unless a Redis-backed adapter is added later.

export const rateLimitReference = {
  windowMs: 60 * 1000,
  maxRequests: 10,
  tracker: 'x-forwarded-for',
  note: 'Replace with distributed storage for multi-instance deployments.',
}
