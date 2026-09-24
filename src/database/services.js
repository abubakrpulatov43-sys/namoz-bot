const db = require("./db");

const serviceRepository = {
  getAllActive() {
    return db.prepare("SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC, id ASC").all();
  },

  getAll() {
    return db.prepare("SELECT * FROM services ORDER BY sort_order ASC, id ASC").all();
  },

  getById(id) {
    return db.prepare("SELECT * FROM services WHERE id = ?").get(id);
  },

  getByName(name) {
    return db.prepare("SELECT * FROM services WHERE name = ? OR icon || ' ' || name = ?").get(name, name);
  },

  create({ name, icon, description, sort_order }) {
    const stmt = db.prepare(`
      INSERT INTO services (name, icon, description, sort_order)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(name, icon || "🚗", description || null, sort_order || 0);
    return this.getById(info.lastInsertRowid);
  },

  update(id, { name, icon, description, sort_order, is_active }) {
    const stmt = db.prepare(`
      UPDATE services
      SET name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          description = COALESCE(?, description),
          sort_order = COALESCE(?, sort_order),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `);
    stmt.run(name, icon, description, sort_order, is_active, id);
    return this.getById(id);
  },

  toggleActive(id) {
    const service = this.getById(id);
    if (!service) return null;
    const newStatus = service.is_active ? 0 : 1;
    db.prepare("UPDATE services SET is_active = ? WHERE id = ?").run(newStatus, id);
    return { ...service, is_active: newStatus };
  },

  delete(id) {
    return db.prepare("DELETE FROM services WHERE id = ?").run(id);
  },
};

module.exports = serviceRepository;
