const db = require("./db");

const userRepository = {
  getOrCreate(telegramId, name, username) {
    let user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);
    if (!user) {
      const stmt = db.prepare(`
        INSERT INTO users (telegram_id, name, username)
        VALUES (?, ?, ?)
      `);
      stmt.run(telegramId, name || null, username || null);
      user = db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);
    } else {
      db.prepare(`
        UPDATE users 
        SET name = COALESCE(?, name), 
            username = COALESCE(?, username), 
            last_active = CURRENT_TIMESTAMP 
        WHERE telegram_id = ?
      `).run(name || null, username || null, telegramId);
    }
    return user;
  },

  incrementDownloads(telegramId) {
    db.prepare("UPDATE users SET downloads_count = downloads_count + 1 WHERE telegram_id = ?").run(telegramId);
  },

  count() {
    return db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  },

  getAll() {
    return db.prepare("SELECT * FROM users ORDER BY downloads_count DESC LIMIT 50").all();
  }
};

module.exports = userRepository;
