const { InlineKeyboard } = require("grammy");
const requestRepository = require("../database/requests");
const { formatStatus, formatDate } = require("../utils/formatters");

// Mening so'rovlarim ro'yxati
async function handleMyRequests(ctx) {
  if (!ctx.user) return;

  const requests = requestRepository.getByUserId(ctx.user.id);

  if (requests.length === 0) {
    return ctx.reply(
      `📦 *Mening so‘rovlarim*\n\nSizda hali hech qanday so‘rov mavjud emas.\n` +
      `Kerakli xizmatga buyurtma berish uchun "🚗 Xizmatlar" bo‘limidan foydalaning.`,
      { parse_mode: "Markdown" }
    );
  }

  let text = `📦 *Mening so‘rovlarim:*\n\n`;

  const inlineKb = new InlineKeyboard();

  requests.forEach((req) => {
    const statusLabel = formatStatus(req.status);
    text += `*#${req.id}* — ${req.service_icon || "🚗"} *${req.service_name}*\n` +
      `🚗 ${req.car_brand_model || "Avtomobilsiz"}` +
      (req.car_plate_number ? ` (\`${req.car_plate_number}\`)` : "") + `\n` +
      `📌 Holat: *${statusLabel}*\n\n`;

    inlineKb.text(`Batafsil #${req.id}`, `req_detail:${req.id}`).row();
  });

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

// So'rov bo'yicha batafsil ma'lumot
async function handleRequestDetail(ctx, reqId) {
  if (!ctx.user) return;

  const req = requestRepository.getById(reqId);
  if (!req || req.user_id !== ctx.user.id) {
    return ctx.answerCallbackQuery({ text: "So'rov topilmadi" });
  }

  const statusLabel = formatStatus(req.status);
  const timeStr = formatDate(req.created_at);

  const detailText =
    `📋 *So‘rov #${req.id} tafsilotlari:*\n\n` +
    `🚗 *Xizmat:* ${req.service_icon || "🚗"} ${req.service_name}\n` +
    `📌 *Holat:* *${statusLabel}*\n` +
    `🚘 *Avtomobil:* ${req.car_brand_model || "Kiritilmagan"}\n` +
    `🔢 *Davlat raqami:* \`${req.car_plate_number || "-"}\`\n` +
    `💬 *Izoh:* ${req.comment || "Mavjud emas"}\n` +
    `🕐 *Yaratilgan vaqt:* ${timeStr}`;

  const inlineKb = new InlineKeyboard()
    .text("🔙 Ro‘yxatga qaytish", "req_list_back");

  await ctx.editMessageText(detailText, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

module.exports = {
  handleMyRequests,
  handleRequestDetail,
};
