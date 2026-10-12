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

  getUser(telegramId) {
    return db.prepare("SELECT * FROM users WHERE telegram_id = ?").get(telegramId);
  },

  setRegion(telegramId, region, lat = null, lng = null) {
    db.prepare(`
      UPDATE users 
      SET selected_region = ?, latitude = ?, longitude = ? 
      WHERE telegram_id = ?
    `).run(region, lat, lng, telegramId);
  },

  setNotifications(telegramId, enabled) {
    db.prepare(`
      UPDATE users 
      SET notifications_enabled = ? 
      WHERE telegram_id = ?
    `).run(enabled ? 1 : 0, telegramId);
  },

  getUsersForNotifications() {
    return db.prepare("SELECT telegram_id, selected_region, latitude, longitude FROM users WHERE notifications_enabled = 1").all();
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
