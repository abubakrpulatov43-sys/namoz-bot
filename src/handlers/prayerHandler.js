const { InlineKeyboard, Keyboard } = require("grammy");
const prayerService = require("../services/prayerService");
const userRepository = require("../database/users");
const { escapeHtml } = require("../utils/text");

// Asosiy pastki klaviatura (Reply Keyboard)
function getMainKeyboard() {
  return new Keyboard()
    .text("🕌 Bugungi namoz vaqtlari").row()
    .text("📍 Hududni tanlash").requestLocation("📍 Lokatsiya yuborish").row()
    .text("📅 Haftalik taqvim").text("📿 Tasbeh").row()
    .text("⏰ Eslatma sozlamasi").text("🤲 Duolar")
    .resized();
}

// Hududlar inline klaviaturasi
function getRegionsInlineKeyboard() {
  const kb = new InlineKeyboard();
  const regions = Object.entries(prayerService.REGIONS);

  for (let i = 0; i < regions.length; i += 2) {
    const [k1, r1] = regions[i];
    kb.text(r1.name.replace(" viloyati", "").replace(" shahri", ""), `reg:${k1}`);
    if (i + 1 < regions.length) {
      const [k2, r2] = regions[i + 1];
      kb.text(r2.name.replace(" viloyati", "").replace(" shahri", ""), `reg:${k2}`);
    }
    kb.row();
  }
  return kb;
}

// 1. Bugungi namoz vaqtlari
async function handleTodayPrayer(ctx) {
  const user = userRepository.getUser(ctx.from.id);
  const regionKey = user?.selected_region || "Toshkent";
  const lat = user?.latitude || null;
  const lng = user?.longitude || null;

  const data = await prayerService.getPrayerTimes(regionKey, lat, lng);
  const text = prayerService.formatPrayerMessage(data.regionName, data);

  const inlineKb = new InlineKeyboard()
    .text("🔄 Yangilash", `refresh_prayer`)
    .text("📍 Hududni o'zgartirish", `choose_region`);

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: inlineKb,
  });
}

// 2. Hududni tanlash menyusi
async function handleChooseRegion(ctx) {
  const text =
    `📍 <b>O'zingizga qulay hududni tanlang:</b>\n\n` +
    `Quyidagi ro'yxatdan viloyat/shahringizni tanlang yoki <b>«📍 Lokatsiya yuborish»</b> tugmasi orqali joylashuvingizni yuboring.`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: getRegionsInlineKeyboard(),
  });
}

// 3. Hudud tanlanganda (Callback)
async function handleRegionCallback(ctx, regionKey) {
  const regionInfo = prayerService.REGIONS[regionKey];
  if (!regionInfo) {
    return ctx.answerCallbackQuery({ text: "Hudud topilmadi" });
  }

  userRepository.setRegion(ctx.from.id, regionKey, null, null);
  await ctx.answerCallbackQuery({ text: `✅ Hudud tanlandi: ${regionInfo.name}` });

  const data = await prayerService.getPrayerTimes(regionKey);
  const text =
    `✅ <b>Hududingiz muvaffaqiyatli saqlandi: ${escapeHtml(regionInfo.name)}</b>\n\n` +
    prayerService.formatPrayerMessage(regionInfo.name, data);

  const inlineKb = new InlineKeyboard()
    .text("🔄 Yangilash", `refresh_prayer`)
    .text("📍 Boshqa hudud", `choose_region`);

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: inlineKb,
    });
  } catch (e) {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: inlineKb,
    });
  }
}

// 4. GPS Lokatsiya yuborilganda
async function handleLocation(ctx) {
  if (!ctx.message?.location) return;

  const { latitude, longitude } = ctx.message.location;
  const nearestKey = prayerService.findNearestRegion(latitude, longitude);
  const regionInfo = prayerService.REGIONS[nearestKey];

  userRepository.setRegion(ctx.from.id, nearestKey, latitude, longitude);

  const data = await prayerService.getPrayerTimes(nearestKey, latitude, longitude);
  const text =
    `📍 <b>Sizning joylashuvingiz qabul qilindi!</b>\n` +
    `📌 Eng yaqin hudud: <b>${escapeHtml(regionInfo.name)}</b> (aniq koordinatalar bo'yicha hisoblandi)\n\n` +
    prayerService.formatPrayerMessage(regionInfo.name, data);

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: getMainKeyboard(),
  });
}

// 5. Haftalik taqvim
async function handleWeeklyPrayer(ctx) {
  const user = userRepository.getUser(ctx.from.id);
  const regionKey = user?.selected_region || "Toshkent";
  const regionInfo = prayerService.REGIONS[regionKey] || prayerService.REGIONS["Toshkent"];

  const waitMsg = await ctx.reply("⏳ <b>Haftalik taqvim hisoblanmoqda...</b>", { parse_mode: "HTML" });

  let text = `📅 <b>${regionInfo.name} uchun 7 kunlik namoz taqvimi:</b>\n\n`;

  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const data = await prayerService.getPrayerTimes(regionKey, null, null, dateStr);

    const [y, m, day] = dateStr.split("-");
    text += `🔹 <b>${day}.${m}.${y}:</b>\n`;
    text += `Bomdod: <code>${data.timings.fajr}</code> | Peshin: <code>${data.timings.dhuhr}</code> | Asr: <code>${data.timings.asr}</code> | Shom: <code>${data.timings.maghrib}</code> | Xufton: <code>${data.timings.isha}</code>\n\n`;
  }

  await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id).catch(() => {});
  await ctx.reply(text, { parse_mode: "HTML" });
}

// 6. Elektron Tasbeh
const userTasbehState = new Map();

async function handleTasbeh(ctx) {
  const userId = ctx.from.id;
  const zikrs = [
    { text: "Subhanalloh (سُبْحَانَ اللَّهِ)", target: 33 },
    { text: "Alhamdulillah (الْحَمْدُ لِلَّهِ)", target: 33 },
    { text: "Allohu Akbar (اللَّهُ أَكْبَرُ)", target: 33 },
    { text: "La ilaha illalloh (لَا إِلٰهَ إِلَّا اللهُ)", target: 33 },
    { text: "Astag'firulloh (أَسْتَغْفِرُ اللَّهَ)", target: 33 },
  ];

  if (!userTasbehState.has(userId)) {
    userTasbehState.set(userId, { zikrIndex: 0, count: 0 });
  }

  const state = userTasbehState.get(userId);
  const currentZikr = zikrs[state.zikrIndex];

  const inlineKb = new InlineKeyboard()
    .text(`➕ Sanash (${state.count}/${currentZikr.target})`, `tasbeh_inc`).row()
    .text("🔄 Qayta boshlash", `tasbeh_reset`)
    .text("➡️ Keyingi zikr", `tasbeh_next`);

  await ctx.reply(
    `📿 <b>Elektron Tasbeh</b>\n\n` +
    `Zikr: <b>${currentZikr.text}</b>\n` +
    `Sanoq: <b>${state.count}</b> / ${currentZikr.target}\n\n` +
    `Sanash uchun pastdagi tugmani bosing:`,
    {
      parse_mode: "HTML",
      reply_markup: inlineKb,
    }
  );
}

async function handleTasbehCallback(ctx, action) {
  const userId = ctx.from.id;
  const zikrs = [
    { text: "Subhanalloh (سُبْحَانَ اللَّهِ)", target: 33 },
    { text: "Alhamdulillah (الْحَمْدُ لِلَّهِ)", target: 33 },
    { text: "Allohu Akbar (اللَّهُ أَكْبَرُ)", target: 33 },
    { text: "La ilaha illalloh (لَا إِلٰهَ إِلَّا اللهُ)", target: 33 },
    { text: "Astag'firulloh (أَسْتَغْفِرُ اللَّهَ)", target: 33 },
  ];

  if (!userTasbehState.has(userId)) {
    userTasbehState.set(userId, { zikrIndex: 0, count: 0 });
  }

  const state = userTasbehState.get(userId);

  if (action === "inc") {
    state.count++;
    if (state.count >= zikrs[state.zikrIndex].target) {
      await ctx.answerCallbackQuery({ text: `🎉 ${zikrs[state.zikrIndex].text.split(" ")[0]} 33 martaga yetdi!` });
      state.count = 0;
      state.zikrIndex = (state.zikrIndex + 1) % zikrs.length;
    } else {
      await ctx.answerCallbackQuery({ text: `${state.count}` });
    }
  } else if (action === "reset") {
    state.count = 0;
    await ctx.answerCallbackQuery({ text: "Sanoq nollashtirildi" });
  } else if (action === "next") {
    state.count = 0;
    state.zikrIndex = (state.zikrIndex + 1) % zikrs.length;
    await ctx.answerCallbackQuery({ text: "Keyingi zikrga o'tildi" });
  }

  const currentZikr = zikrs[state.zikrIndex];
  const inlineKb = new InlineKeyboard()
    .text(`➕ Sanash (${state.count}/${currentZikr.target})`, `tasbeh_inc`).row()
    .text("🔄 Qayta boshlash", `tasbeh_reset`)
    .text("➡️ Keyingi zikr", `tasbeh_next`);

  try {
    await ctx.editMessageText(
      `📿 <b>Elektron Tasbeh</b>\n\n` +
      `Zikr: <b>${currentZikr.text}</b>\n` +
      `Sanoq: <b>${state.count}</b> / ${currentZikr.target}\n\n` +
      `Sanash uchun pastdagi tugmani bosing:`,
      {
        parse_mode: "HTML",
        reply_markup: inlineKb,
      }
    );
  } catch (e) {}
}

// 7. Duolar
async function handleDuolar(ctx) {
  const text =
    `🤲 <b>Kundalik va Namoz Duolari:</b>\n\n` +
    `1️⃣ <b>Tonggi duo:</b>\n` +
    `<i>«Alhamdulillahillaziy ahyana ba'da ma amatana va ilayhin nushur»</i>\n` +
    `(Bizni o'ldirib, qayta tiriltirgan Allohga hamd bo'lsin. Qaytish Uning O'zigadir)\n\n` +
    `2️⃣ <b>Azon duosi:</b>\n` +
    `<i>«Allohumma robba hazihid da'vatit tammah, vas solatil qo'imah, ati Muhammadanil vasilata val faziylah, vab'ashu maqomam mahmudanillaziy va'adtah»</i>\n\n` +
    `3️⃣ <b>Masjidga kirish duosi:</b>\n` +
    `<i>«Allohummaftah liy abvaba rohmatik»</i>\n` +
    `(Allohim, menga rahmat eshiklaringni ochgin)\n\n` +
    `4️⃣ <b>Masjiddan chiqish duosi:</b>\n` +
    `<i>«Allohumma inniy as'aluka min fazlik»</i>\n` +
    `(Allohim, Sendan fazlingni so'rayman)`;

  await ctx.reply(text, { parse_mode: "HTML" });
}

// 8. Eslatmalar sozlamasi
async function handleNotificationSettings(ctx) {
  const user = userRepository.getUser(ctx.from.id);
  const isEnabled = user?.notifications_enabled === 1;

  const inlineKb = new InlineKeyboard().text(
    isEnabled ? "🔔 O'chirish" : "🔕 Yoqish",
    "toggle_notify"
  );

  const text =
    `⏰ <b>Namoz vaqtlari eslatmasi (Azon xabarnomasi)</b>\n\n` +
    `Holat: <b>${isEnabled ? "✅ Yoqilgan (Har namoz vaqtida eslatma yuboriladi)" : "❌ O'chirilgan"}</b>\n\n` +
    `Holatni o'zgartirish uchun quyidagi tugmani bosing:`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: inlineKb,
  });
}

async function handleToggleNotifyCallback(ctx) {
  const user = userRepository.getUser(ctx.from.id);
  const newStatus = !(user?.notifications_enabled === 1);
  userRepository.setNotifications(ctx.from.id, newStatus);

  await ctx.answerCallbackQuery({ text: newStatus ? "Eslatmalar yoqildi" : "Eslatmalar o'chirildi" });

  const inlineKb = new InlineKeyboard().text(
    newStatus ? "🔔 O'chirish" : "🔕 Yoqish",
    "toggle_notify"
  );

  const text =
    `⏰ <b>Namoz vaqtlari eslatmasi (Azon xabarnomasi)</b>\n\n` +
    `Holat: <b>${newStatus ? "✅ Yoqilgan (Har namoz vaqtida eslatma yuboriladi)" : "❌ O'chirilgan"}</b>\n\n` +
    `Holatni o'zgartirish uchun quyidagi tugmani bosing:`;

  try {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: inlineKb,
    });
  } catch (e) {}
}

module.exports = {
  getMainKeyboard,
  handleTodayPrayer,
  handleChooseRegion,
  handleRegionCallback,
  handleLocation,
  handleWeeklyPrayer,
  handleTasbeh,
  handleTasbehCallback,
  handleDuolar,
  handleNotificationSettings,
  handleToggleNotifyCallback,
};
