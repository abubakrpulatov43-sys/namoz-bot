const { InlineKeyboard } = require("grammy");
const downloadRepository = require("../database/downloads");
const userRepository = require("../database/users");
const config = require("../config");
const { escapeHtml } = require("../utils/text");

function isAdmin(telegramId) {
  return config.adminIds.includes(Number(telegramId));
}

async function handleAdminPanel(ctx, period = "all") {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply("⛔️ Sizda admin huquqlari mavjud emas.");
  }

  const stats = downloadRepository.getStats(period);

  let periodName = "Barcha davr uchun";
  if (period === "daily") periodName = "Bugungi";
  if (period === "weekly") periodName = "Oxirgi 7 kunlik";
  if (period === "monthly") periodName = "Oxirgi 30 kunlik";

  let text =
    `📊 <b>pulatov.music.uz STATISTIKASI (${periodName})</b>\n\n` +
    `👥 <b>Foydalanuvchilar soni:</b> ${stats.totalUsers}\n` +
    `📥 <b>Jami yuklab olishlar:</b> ${stats.totalDownloads}\n\n` +
    `🎵 <b>Yuklangan musiqalar:</b> ${stats.audioCount}\n` +
    `🎬 <b>Yuklangan videolar:</b> ${stats.videoCount}\n\n`;

  if (stats.topDownloads.length > 0) {
    text += `<b>Eng ko'p yuklanganlar:</b>\n`;
    stats.topDownloads.forEach((t, i) => {
      text += `${i + 1}. <b>${escapeHtml(t.title)}</b> — ${t.count} marta\n`;
    });
  }

  const inlineKb = new InlineKeyboard()
    .text("Bugungi", "adm_p:daily")
    .text("Haftalik", "adm_p:weekly")
    .text("Oylik", "adm_p:monthly")
    .row()
    .text("Barchasi", "adm_p:all");

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: inlineKb,
    });
  } else {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: inlineKb,
    });
  }
}

module.exports = {
  isAdmin,
  handleAdminPanel,
};
