const db = require("./db");

const statsRepository = {
  getStats(period = "all") {
    let dateFilter = "";
    if (period === "daily") {
      dateFilter = "AND r.created_at >= date('now', 'start of day')";
    } else if (period === "weekly") {
      dateFilter = "AND r.created_at >= date('now', '-7 days')";
    } else if (period === "monthly") {
      dateFilter = "AND r.created_at >= date('now', '-30 days')";
    }

    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;

    const totalRequests = db.prepare(`
      SELECT COUNT(*) as count FROM requests r WHERE 1=1 ${dateFilter}
    `).get().count;

    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM requests r 
      WHERE 1=1 ${dateFilter}
      GROUP BY status
    `).all().reduce((acc, row) => {
      acc[row.status] = row.count;
      return acc;
    }, {});

    const topServices = db.prepare(`
      SELECT s.name, s.icon, COUNT(r.id) as request_count
      FROM requests r
      JOIN services s ON r.service_id = s.id
      WHERE 1=1 ${dateFilter}
      GROUP BY s.id
      ORDER BY request_count DESC
      LIMIT 5
    `).all();

    return {
      period,
      totalUsers,
      totalRequests,
      statusCounts: {
        new: statusCounts.new || 0,
        reviewing: statusCounts.reviewing || 0,
        contacted: statusCounts.contacted || 0,
        in_progress: statusCounts.in_progress || 0,
        completed: statusCounts.completed || 0,
        cancelled: statusCounts.cancelled || 0,
      },
      topServices,
    };
  },
};

module.exports = statsRepository;
