/**
 * Lightweight, zero-dependency sliding window in-memory rate limiter middleware.
 * Tracks requests per client IP and enforces window-based request caps.
 *
 * @param {Object} options
 * @param {number} [options.windowMs=60000] - Window size in milliseconds (default 1 minute)
 * @param {number} [options.max=30] - Maximum requests allowed per window
 * @param {string} [options.message="Too many requests, please try again later."] - Error message on 429
 * @returns {Function} Express middleware
 */
export const rateLimit = ({
  windowMs = 60 * 1000,
  max = 30,
  message = "Too many requests. Please try again later.",
} = {}) => {
  const ipRequests = new Map();

  // Periodic cleanup of stale entries every 5 minutes to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < windowMs);
      if (validTimestamps.length === 0) {
        ipRequests.delete(ip);
      } else {
        ipRequests.set(ip, validTimestamps);
      }
    }
  }, 5 * 60 * 1000);

  // Allow Node process to exit without waiting on interval
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    // Prefer authenticated user ID to prevent IP spoofing; fallback to secure req.ip/remoteAddress
    const clientKey = req.user?._id
      ? `user:${req.user._id}`
      : (req.ip || req.socket?.remoteAddress || "unknown-client");

    const now = Date.now();
    const timestamps = ipRequests.get(clientKey) || [];
    const windowStart = now - windowMs;

    // Keep only timestamps within the current window
    const recentTimestamps = timestamps.filter((t) => t > windowStart);

    if (recentTimestamps.length >= max) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message,
        retryAfterMs: Math.ceil((recentTimestamps[0] + windowMs - now) / 1000) * 1000,
      });
    }

    recentTimestamps.push(now);
    ipRequests.set(clientKey, recentTimestamps);

    next();
  };
};
