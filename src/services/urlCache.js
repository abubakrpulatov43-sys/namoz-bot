const crypto = require("crypto");

// URL cache in-memory for callback queries
const cache = new Map();

const urlCache = {
  store(url, meta = {}) {
    const id = crypto.randomBytes(4).toString("hex");
    cache.set(id, { url, meta, timestamp: Date.now() });

    // Clean old entries (older than 24h)
    if (cache.size > 2000) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (now - v.timestamp > 24 * 60 * 60 * 1000) {
          cache.delete(k);
        }
      }
    }

    return id;
  },

  get(id) {
    return cache.get(id);
  }
};

module.exports = urlCache;
