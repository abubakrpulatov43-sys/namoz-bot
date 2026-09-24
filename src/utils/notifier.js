const adminRepository = require("../database/admins");
const { getRequestAdminKeyboard } = require("../keyboards/admin");
const { formatStatus, formatDate, formatPhone } = require("./formatters");

const notifier = {
  // Yangi so'rov kelganda barcha adminlarga yuborish
  async notifyAdminsNewRequest(bot, request) {
    const adminIds = adminRepository.getAllActiveIds();
    if (!adminIds || adminIds.length === 0) return;

    const timeStr = formatDate(request.created_at);
    const phoneStr = formatPhone(request.user_phone);

    const message =
      `🆕 *YANGI SO‘ROV #${request.id}*\n\n` +
      `👤 *Mijoz:* ${request.user_name}\n` +
      `📱 *Telefon:* ${phoneStr}\n\n` +
      `🚗 *Avtomobil:* ${request.car_brand_model || "Kiritilmagan"}\n` +
      `🔢 *Raqam:* ${request.car_plate_number || "-"}\n\n` +
      `📋 *Xizmat:* ${request.service_icon || "🚗"} ${request.service_name}\n\n` +
      `💬 *Izoh:* ${request.comment || "Yo'q"}\n\n` +
      `🕐 *Vaqt:* ${timeStr}`;

    const keyboard = getRequestAdminKeyboard(
      request.id,
      request.user_telegram_id,
      request.user_tg_username
    );

    for (const adminId of adminIds) {
      try {
        await bot.api.sendMessage(adminId, message, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      } catch (err) {
        console.error(`Admin #${adminId} ga xabar yuborishda xatolik:`, err.message);
      }
    }
  },

  // So'rov statusi o'zgarganda mijozga xabar berish
  async notifyUserStatusChange(bot, request, newStatus) {
    if (!request || !request.user_telegram_id) return;

    const statusLabel = formatStatus(newStatus);
    const message =
      `🔄 *So‘rovingiz holati o‘zgardi.*\n\n` +
      `🔢 *So‘rov:* #${request.id}\n` +
      `📋 *Xizmat:* ${request.service_icon || "🚗"} ${request.service_name}\n` +
      `📌 *Holat:* *${statusLabel}*\n\n` +
      `Batafsil ma'lumotni "📦 Mening so‘rovlarim" bo'limidan ko'rishingiz mumkin.`;

    try {
      await bot.api.sendMessage(request.user_telegram_id, message, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error(`Foydalanuvchi #${request.user_telegram_id} ga bildirishnoma yuborishda xatolik:`, err.message);
    }
  },
};

module.exports = notifier;
