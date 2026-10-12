const userRepository = require("../database/users");
const { getMainKeyboard } = require("./prayerHandler");
const prayerService = require("../services/prayerService");
const { escapeHtml } = require("../utils/text");

async function handleStart(ctx) {
  if (ctx.from) {
    userRepository.getOrCreate(ctx.from.id, ctx.from.first_name, ctx.from.username);
  }

  const name = escapeHtml(ctx.from?.first_name || "Birodar");
  const user = userRepository.getUser(ctx.from.id);
  const regionKey = user?.selected_region || "Toshkent";
  const lat = user?.latitude || null;
  const lng = user?.longitude || null;

  const data = await prayerService.getPrayerTimes(regionKey, lat, lng);
  const prayerText = prayerService.formatPrayerMessage(data.regionName, data);

  const welcomeText =
    `Assalomu alaykum va rahmatullohi va barakotuh, <b>${name}</b>!\n\n` +
    `🕌 <b>Namoz Vaqtlari</b> botiga xush kelibsiz!\n\n` +
    `Ushbu bot orqali O'zbekistonning barcha hududlari hamda GPS lokatsiyangiz bo'yicha aniq namoz vaqtlarini bilib borishingiz va avtomatik eslatmalar (azon xabarnomasi) olishingiz mumkin.\n\n` +
    `──────────────\n` +
    prayerText;

  await ctx.reply(welcomeText, {
    parse_mode: "HTML",
    reply_markup: getMainKeyboard(),
  });
}

module.exports = { handleStart };
