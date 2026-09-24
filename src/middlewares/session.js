const db = require("../database/db");

// Sessions jadvali
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const selectStmt = db.prepare("SELECT data FROM sessions WHERE key = ?");
const upsertStmt = db.prepare(`
  INSERT INTO sessions (key, data, updated_at)
  VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET
    data = excluded.data,
    updated_at = CURRENT_TIMESTAMP
`);
const deleteStmt = db.prepare("DELETE FROM sessions WHERE key = ?");

function getSession(key) {
  const row = selectStmt.get(String(key));
  if (!row) return {};
  try {
    return JSON.parse(row.data);
  } catch (e) {
    return {};
  }
}

function saveSession(key, data) {
  upsertStmt.run(String(key), JSON.stringify(data));
}

function clearSession(key) {
  deleteStmt.run(String(key));
}

function sessionMiddleware() {
  return async (ctx, next) => {
    if (!ctx.from) return next();
    const key = String(ctx.from.id);
    ctx.session = getSession(key);

    ctx.clearSession = () => {
      ctx.session = {};
      clearSession(key);
    };

    await next();

    // Agar session mavjud bo'lsa yoki bo'sh bo'lmasa saqlash
    if (ctx.session && Object.keys(ctx.session).length > 0) {
      saveSession(key, ctx.session);
    } else {
      clearSession(key);
    }
  };
}

module.exports = {
  sessionMiddleware,
  getSession,
  clearSession,
};
