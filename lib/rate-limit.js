function createRateLimiter({ windowMs = 60_000, max = 100, now = () => Date.now() }) {
  const hits = new Map();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const currentTime = now();

    let record = hits.get(ip);
    if (!record || currentTime > record.resetTime) {
      record = { count: 0, resetTime: currentTime + windowMs };
      hits.set(ip, record);
    }

    record.count++;

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - currentTime) / 1000);
      if (typeof res.setHeader === "function") {
        res.setHeader("Retry-After", String(retryAfterSeconds));
      } else if (typeof res.set === "function") {
        res.set("Retry-After", String(retryAfterSeconds));
      }
      return res.status(429).json({
        error: "Too many requests, please try again later.",
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };
}

module.exports = { createRateLimiter };
