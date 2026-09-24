const userRepository = require("../database/users");
const { getMainMenuKeyboard, getContactKeyboard } = require("../keyboards/menu");

async function startRegistration(ctx) {
  ctx.session.step = "REG_NAME";

  await ctx.reply(
    `🚗 *AvtoRaqam.uz'ga xush kelibsiz!*\n\n` +
    `Botdan to'liq foydalanish uchun, iltimos, ro'yxatdan o'ting.\n\n` +
    `✍️ *Ismingizni kiriting:*`,
    {
      parse_mode: "Markdown",
      reply_markup: { remove_keyboard: true },
    }
  );
}

async function handleRegistrationStep(ctx) {
  const step = ctx.session.step;

  // 1-qadam: Ismni qabul qilish
  if (step === "REG_NAME") {
    const text = ctx.message?.text?.trim();
    if (!text || text.length < 2) {
      return ctx.reply("⚠️ Iltimos, to'g'ri ism kiriting (kamida 2 ta harf):");
    }

    ctx.session.regName = text;
    ctx.session.step = "REG_PHONE";

    return ctx.reply(
      `Rahmat, *${text}*!\n\n` +
      `📱 Endi telefon raqamingizni yuboring.\n` +
      `Quyidagi tugmani bosing yoki raqamingizni yozib yuboring (masalan: \`+998901234567\`):`,
      {
        parse_mode: "Markdown",
        reply_markup: getContactKeyboard(),
      }
    );
  }

  // 2-qadam: Telefon raqamni qabul qilish
  if (step === "REG_PHONE") {
    let phone = "";

    if (ctx.message?.contact) {
      phone = ctx.message.contact.phone_number;
    } else if (ctx.message?.text) {
      phone = ctx.message.text.trim();
    }

    // Raqamni tekshirish
    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 9) {
      return ctx.reply(
        "⚠️ Telefon raqami noto'g'ri kiritildi.\nIltimos, pastdagi tugmani bosing yoki to'g'ri raqam kiriting:",
        { reply_markup: getContactKeyboard() }
      );
    }

    if (!phone.startsWith("+")) {
      phone = "+" + phone;
    }

    // Foydalanuvchini bazaga saqlash
    const newUser = userRepository.create({
      telegram_id: ctx.from.id,
      name: ctx.session.regName,
      phone: phone,
      username: ctx.from.username || null,
    });

    ctx.user = newUser;
    ctx.clearSession();

    const welcomeMsg =
      `🎉 *Tabriklaymiz, siz muvaffaqiyatli ro'yxatdan o'tdingiz!*\n\n` +
      `Avtomobilingiz uchun kerakli xizmatlarni tanlashingiz yoki mashinangizni qo'shishingiz mumkin.`;

    return ctx.reply(welcomeMsg, {
      parse_mode: "Markdown",
      reply_markup: getMainMenuKeyboard(),
    });
  }
}

module.exports = {
  startRegistration,
  handleRegistrationStep,
};
