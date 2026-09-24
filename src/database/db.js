const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const config = require("../config");

// data papkasini yaratish
const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.resolve(config.dbPath));

// Performance va xavfsizlik sozlamalari
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
