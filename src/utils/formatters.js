const config = require("../config");

function formatStatus(status) {
  const s = config.statuses[status];
  return s ? s.label : status;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function formatPhone(phone) {
  if (!phone) return "-";
  let p = phone.replace(/[^\d+]/g, "");
  if (!p.startsWith("+") && p.length === 12) {
    p = "+" + p;
  }
  return p;
}

module.exports = {
  formatStatus,
  formatDate,
  formatPhone,
};
