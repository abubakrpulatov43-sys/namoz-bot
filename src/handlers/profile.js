const { InlineKeyboard, Keyboard } = require("grammy");
const userRepository = require("../database/users");
const carRepository = require("../database/cars");
const requestRepository = require("../database/requests");
const { getMainMenuKeyboard, getContactKeyboard } = require("../keyboards/menu");
const { formatPhone } = require("../utils/formatters");

// Profilni ko'rsatish
async function handleProfile(ctx) {
  if (!ctx.user) return;

  const carCount = carRepository.countByUserId(ctx.user.id);
  const requestCount = requestRepository.countByUserId(ctx.user.id);

  const text =
    `👤 *Foydalanuvchi Profili*\n\n` +
    `👤 *Ism:* ${ctx.user.name}\n` +
    `📱 *Telefon:* ${formatPhone(ctx.user.phone)}\n` +
    `🚗 *Avtomobillar soni:* ${carCount} ta\n` +
    `📦 *So‘rovlar soni:* ${requestCount} ta\n\n` +
    `Ma'lumotlaringizni o'zgartirish uchun quyidagi tugmalardan foydalaning:`;

  const inlineKb = new InlineKeyboard()
    .text("✏️ Ismni o‘zgartirish", "prof_edit_name")
    .text("📱 Telefonni o‘zgartirish", "prof_edit_phone");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

// Ismni tahrirlashni boshlash
async function startEditName(ctx) {
  ctx.session.step = "EDIT_NAME";

  const cancelKb = new Keyboard()
    .text("❌ Bekor qilish")
    .resized();

  await ctx.reply("✍️ Yangi ismingizni kiriting:", {
    reply_markup: cancelKb,
  });
}

// Telefonni tahrirlashni boshlash
async function startEditPhone(ctx) {
  ctx.session.step = "EDIT_PHONE";

  await ctx.reply(
    "📱 Yangi telefon raqamingizni yuboring yoki yozing:",
    {
      reply_markup: getContactKeyboard(),
    }
  );
}

// Profil tahrirlash bosqichlari
async function handleProfileStep(ctx) {
  const step = ctx.session.step;
  const text = ctx.message?.text?.trim();

  if (text === "❌ Bekor qilish") {
    ctx.clearSession();
    return ctx.reply("Tahrirlash bekor qilindi.", {
      reply_markup: getMainMenuKeyboard(),
    });
  }

  // Ism o'zgartirish
  if (step === "EDIT_NAME") {
    if (!text || text.length < 2) {
      return ctx.reply("⚠️ Iltimos, to'g'ri ism kiriting (kamida 2 ta harf):");
    }

    userRepository.update(ctx.user.id, { name: text });
    ctx.user.name = text;
    ctx.clearSession();

    await ctx.reply(`✅ Ismingiz *${text}* ga o'zgartirildi!`, {
      parse_mode: "Markdown",
      reply_markup: getMainMenuKeyboard(),
    });

    return handleProfile(ctx);
  }

  // Telefon o'zgartirish
  if (step === "EDIT_PHONE") {
    let phone = "";
    if (ctx.message?.contact) {
      phone = ctx.message.contact.phone_number;
    } else if (text) {
      phone = text;
    }

    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 9) {
      return ctx.reply("⚠️ Telefon raqami noto'g'ri kiritildi. Qaytadan kiriting:", {
        reply_markup: getContactKeyboard(),
      });
    }

    if (!phone.startsWith("+")) phone = "+" + phone;

    userRepository.update(ctx.user.id, { phone });
    ctx.user.phone = phone;
    ctx.clearSession();

    await ctx.reply(`✅ Telefon raqamingiz *${phone}* ga o'zgartirildi!`, {
      parse_mode: "Markdown",
      reply_markup: getMainMenuKeyboard(),
    });

    return handleProfile(ctx);
  }
}

module.exports = {
  handleProfile,
  startEditName,
  startEditPhone,
  handleProfileStep,
};
