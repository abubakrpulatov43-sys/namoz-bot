const { InlineKeyboard } = require("grammy");
const config = require("../config");

async function handleHelp(ctx) {
  const text =
    `☎️ *Yordam va Qo‘llab-quvvatlash*\n\n` +
    `*AvtoRaqam.uz* — avtomobil egalari uchun qulay xizmatlar platformasi.\n\n` +
    `📌 *Botdan qanday foydalaniladi?*\n` +
    `1. "🚘 Mening avtomobillarim" bo'limida mashinangizni qo'shing.\n` +
    `2. "🚗 Xizmatlar" bo'limidan kerakli xizmatni tanlang.\n` +
    `3. So'rov yuboring va operatorimiz siz bilan bog'lanishini kuting.\n` +
    `4. "📦 Mening so‘rovlarim" orqali so'rovlaringiz holatini kuzatib boring.\n\n` +
    `Savollar yoki takliflar bo'yicha operator bilan bog'lanishingiz mumkin:`;

  const inlineKb = new InlineKeyboard()
    .url("💬 Operator bilan bog‘lanish", `https://t.me/${config.supportContact.replace("@", "")}`)
    .row()
    .url("🌐 Rasmiy sayt", "https://avtoraqam.uzex.uz");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

module.exports = { handleHelp };
