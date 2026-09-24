const db = require("./db");

// File ID kesh jadvali (Telegram file_id orqali 0.1 soniyada yuborish)
db.exec(`
  CREATE TABLE IF NOT EXISTS file_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    file_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'audio', 'video'
    title TEXT,
    performer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_file_cache_key ON file_cache(cache_key);
`);

const downloadRepository = {
  // Keshdan Telegram file_id ni olish
  getCachedFile(cacheKey, type) {
    return db.prepare("SELECT * FROM file_cache WHERE cache_key = ? AND type = ?").get(cacheKey, type);
  },

  // Telegram file_id ni keshga saqlash
  saveCachedFile(cacheKey, fileId, type, title = null, performer = null) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO file_cache (cache_key, file_id, type, title, performer)
        VALUES (?, ?, ?, ?, ?)
      `).run(cacheKey, fileId, type, title, performer);
    } catch (e) {
      console.error("Cache save error:", e.message);
    }
  },

  log({ userId, telegramId, type, sourceUrl, title, duration }) {
    try {
      db.prepare(`
        INSERT INTO download_logs (user_id, telegram_id, type, source_url, title, duration)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId || null, telegramId, type, sourceUrl || null, title || null, duration || null);
    } catch (e) {}
  },

  getStats(period = "all") {
    let dateFilter = "";
    if (period === "daily") {
      dateFilter = "AND created_at >= date('now', 'start of day')";
    } else if (period === "weekly") {
      dateFilter = "AND created_at >= date('now', '-7 days')";
    } else if (period === "monthly") {
      dateFilter = "AND created_at >= date('now', '-30 days')";
    }

    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const totalDownloads = db.prepare(`SELECT COUNT(*) as count FROM download_logs WHERE 1=1 ${dateFilter}`).get().count;
    
    const audioCount = db.prepare(`SELECT COUNT(*) as count FROM download_logs WHERE type LIKE 'audio%' ${dateFilter}`).get().count;
    const videoCount = db.prepare(`SELECT COUNT(*) as count FROM download_logs WHERE type = 'video' ${dateFilter}`).get().count;

    const topDownloads = db.prepare(`
      SELECT title, COUNT(*) as count 
      FROM download_logs 
      WHERE title IS NOT NULL ${dateFilter}
      GROUP BY title 
      ORDER BY count DESC 
      LIMIT 5
    `).all();

    return {
      period,
      totalUsers,
      totalDownloads,
      audioCount,
      videoCount,
      topDownloads,
    };
  }
};

module.exports = downloadRepository;
