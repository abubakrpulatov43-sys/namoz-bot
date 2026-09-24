const db = require("./db");
const config = require("../config");

function initDatabase() {
  // Users jadvali
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      name TEXT,
      username TEXT,
      downloads_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
  `);

  // Downloads / Requests log jadvali
  db.exec(`
    CREATE TABLE IF NOT EXISTS download_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      telegram_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'audio', 'video', 'search'
      source_url TEXT,
      title TEXT,
      duration INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON download_logs(created_at);
  `);

  // Admins jadvali
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (config.adminIds && config.adminIds.length > 0) {
    const insertAdmin = db.prepare(`
      INSERT OR IGNORE INTO admins (telegram_id, name, role)
      VALUES (?, 'Admin', 'superadmin')
    `);
    for (const adminId of config.adminIds) {
      insertAdmin.run(adminId);
    }
  }

  console.log("✅ Musiqa & Video Baza sxemasi tayyor.");
}

module.exports = { initDatabase };
