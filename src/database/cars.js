const db = require("./db");

const carRepository = {
  getByUserId(userId) {
    return db.prepare("SELECT * FROM cars WHERE user_id = ? ORDER BY created_at DESC").all(userId);
  },

  getById(id) {
    return db.prepare("SELECT * FROM cars WHERE id = ?").get(id);
  },

  create({ user_id, brand_model, plate_number, note }) {
    const stmt = db.prepare(`
      INSERT INTO cars (user_id, brand_model, plate_number, note)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(user_id, brand_model, plate_number, note || null);
    return this.getById(info.lastInsertRowid);
  },

  delete(id, userId) {
    const stmt = db.prepare("DELETE FROM cars WHERE id = ? AND user_id = ?");
    return stmt.run(id, userId);
  },

  countByUserId(userId) {
    return db.prepare("SELECT COUNT(*) as count FROM cars WHERE user_id = ?").get(userId).count;
  },
};

module.exports = carRepository;
