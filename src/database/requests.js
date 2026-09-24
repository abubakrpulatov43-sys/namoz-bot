const db = require("./db");

const requestRepository = {
  getById(id) {
    return db.prepare(`
      SELECT r.*, 
             u.name as user_name, u.phone as user_phone, u.telegram_id as user_telegram_id, u.username as user_tg_username,
             c.brand_model as car_brand_model, c.plate_number as car_plate_number, c.note as car_note,
             s.name as service_name, s.icon as service_icon
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN cars c ON r.car_id = c.id
      JOIN services s ON r.service_id = s.id
      WHERE r.id = ?
    `).get(id);
  },

  getByUserId(userId) {
    return db.prepare(`
      SELECT r.*, 
             c.brand_model as car_brand_model, c.plate_number as car_plate_number,
             s.name as service_name, s.icon as service_icon
      FROM requests r
      LEFT JOIN cars c ON r.car_id = c.id
      JOIN services s ON r.service_id = s.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);
  },

  create({ user_id, car_id, service_id, comment }) {
    const stmt = db.prepare(`
      INSERT INTO requests (user_id, car_id, service_id, comment, status)
      VALUES (?, ?, ?, ?, 'new')
    `);
    const info = stmt.run(user_id, car_id || null, service_id, comment || null);
    const newId = info.lastInsertRowid;

    // Tarixga yozish
    db.prepare(`
      INSERT INTO request_status_history (request_id, old_status, new_status, note)
      VALUES (?, NULL, 'new', 'So''rov yaratildi')
    `).run(newId);

    return this.getById(newId);
  },

  updateStatus(id, newStatus, adminId = null, note = null) {
    const current = this.getById(id);
    if (!current) return null;

    db.prepare(`
      UPDATE requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, id);

    db.prepare(`
      INSERT INTO request_status_history (request_id, old_status, new_status, changed_by_admin_id, note)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, current.status, newStatus, adminId, note);

    return this.getById(id);
  },

  countByUserId(userId) {
    return db.prepare("SELECT COUNT(*) as count FROM requests WHERE user_id = ?").get(userId).count;
  },

  getAll({ status = null, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT r.*, 
             u.name as user_name, u.phone as user_phone, u.telegram_id as user_telegram_id,
             c.brand_model as car_brand_model, c.plate_number as car_plate_number,
             s.name as service_name, s.icon as service_icon
      FROM requests r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN cars c ON r.car_id = c.id
      JOIN services s ON r.service_id = s.id
    `;
    const params = [];

    if (status) {
      sql += " WHERE r.status = ?";
      params.push(status);
    }

    sql += " ORDER BY r.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  },
};

module.exports = requestRepository;
