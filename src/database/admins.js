const db = require("./db");
const config = require("../config");

const adminRepository = {
  isAdmin(telegramId) {
    if (config.adminIds.includes(Number(telegramId))) return true;
    const admin = db.prepare("SELECT * FROM admins WHERE telegram_id = ? AND is_active = 1").get(telegramId);
    return !!admin;
  },

  getAll() {
    return db.prepare("SELECT * FROM admins ORDER BY created_at DESC").all();
  },

  getAllActiveIds() {
    const fromDb = db.prepare("SELECT telegram_id FROM admins WHERE is_active = 1").all().map((r) => r.telegram_id);
    const combined = new Set([...config.adminIds, ...fromDb]);
    return Array.from(combined);
  },

  add({ telegram_id, name, role = "operator" }) {
    const stmt = db.prepare(`
      INSERT INTO admins (telegram_id, name, role)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(telegram_id, name, role);
    return db.prepare("SELECT * FROM admins WHERE id = ?").get(info.lastInsertRowid);
  },

  remove(telegramId) {
    return db.prepare("DELETE FROM admins WHERE telegram_id = ?").run(telegramId);
  },
};

module.exports = adminRepository;
