const userRepository = require("../database/users");
const { escapeHtml } = require("../utils/text");

async function handleStart(ctx) {
  if (ctx.from) {
    userRepository.getOrCreate(ctx.from.id, ctx.from.first_name, ctx.from.username);
  }

  const name = escapeHtml(ctx.from?.first_name || "Foydalanuvchi");

  const welcomeText =
    `👋 Assalomu alaykum, <b>${name}</b>!\n\n` +
    `🎵 <b>pulatov.music.uz</b> botiga xush kelibsiz!\n` +
    `👥 <b>185,624+</b> foydalanuvchi tanlovi ✨\n\n` +
    `🚀 <b>Bot imkoniyatlari:</b>\n` +
    `1️⃣ <b>Havola orqali yuklash:</b> Menga <b>Instagram Reels</b>, <b>TikTok</b>, <b>YouTube</b> video havolasini yuboring. Men videoni yoki uning to'liq musiqasini (MP3) yuklab beraman!\n\n` +
    `2️⃣ <b>Musiqa qidirish:</b> Shunchaki qo'shiq yoki ijrochi nomini yozib yuboring (masalan: <code>Miyagi Minor</code>, <code>Konsta</code>).\n\n` +
    `3️⃣ <b>Yumaloq video (Krujok):</b> Videoga reply qilib <code>/yumoloq</code> deb yozing.\n` +
    `4️⃣ <b>Ovozli xabar (Golosovoy):</b> Videoga reply qilib <code>/ovoz</code> deb yozing.\n\n` +
    `👇 <i>Sinab ko'rish uchun hoziroq birorta havola yoki qo'shiq nomini yuboring!</i>`;

  await ctx.reply(welcomeText, {
    parse_mode: "HTML",
  });
}

module.exports = { handleStart };
