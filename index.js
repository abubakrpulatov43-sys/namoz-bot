require("dotenv").config();
const { Bot } = require("grammy");
const config = require("./src/config");
const { initDatabase } = require("./src/database/schema");
const userRepository = require("./src/database/users");

// Handlers
const { handleStart } = require("./src/handlers/start");
const {
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
} = require("./src/handlers/prayerHandler");
const { startPrayerReminder } = require("./src/services/prayerReminder");
const {
  extractUrls,
  handleLink,
  handleDownloadFullAudio,
  handleDownloadShortAudio,
  handleDownloadVideo,
  handleDownloadBoth,
} = require("./src/handlers/linkHandler");
const { handleSearch, handleSearchDownload } = require("./src/handlers/searchHandler");
const { handleDirectVideo } = require("./src/handlers/mediaHandler");
const { handleAdminPanel } = require("./src/handlers/admin");
const {
  handleYumoloqCommand,
  handleDownloadVideoNote,
} = require("./src/handlers/videoNoteHandler");
const { handleVoiceCommand } = require("./src/handlers/voiceHandler");

// 1. Bazani initsializatsiya qilish
initDatabase();

// 2. Bot yaratish
if (!config.botToken) {
  console.error("❌ Xatolik: .env faylida BOT_TOKEN topilmadi!");
  process.exit(1);
}

const bot = new Bot(config.botToken);

// User tracker middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    userRepository.getOrCreate(ctx.from.id, ctx.from.first_name, ctx.from.username);
  }
  return next();
});

// 3. Buyruqlar (Commands)
bot.command("start", handleStart);
bot.command("help", handleStart);
bot.command("namoz", handleTodayPrayer);
bot.command("hudud", handleChooseRegion);
bot.command("taqvim", handleWeeklyPrayer);
bot.command("tasbeh", handleTasbeh);
bot.command("duo", handleDuolar);
bot.command("eslatma", handleNotificationSettings);
bot.command("yumoloq", handleYumoloqCommand);
bot.command("krujok", handleYumoloqCommand);
bot.command("ovoz", handleVoiceCommand);
bot.command("voice", handleVoiceCommand);
bot.command("golos", handleVoiceCommand);
bot.command("admin", (ctx) => handleAdminPanel(ctx, "all"));

// 4. GPS Lokatsiya yuborilganda
bot.on(":location", handleLocation);

// 5. Inline Callback Router
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Namoz hududi tanlanganda
  if (data.startsWith("reg:")) {
    const regionKey = data.replace("reg:", "");
    return handleRegionCallback(ctx, regionKey);
  }

  // Namoz vaqtini yangilash
  if (data === "refresh_prayer") {
    await ctx.answerCallbackQuery({ text: "🔄 Yangilandi" });
    return handleTodayPrayer(ctx);
  }

  // Hududni o'zgartirish
  if (data === "choose_region") {
    await ctx.answerCallbackQuery();
    return handleChooseRegion(ctx);
  }

  // Tasbeh amallari
  if (data.startsWith("tasbeh_")) {
    const action = data.replace("tasbeh_", "");
    return handleTasbehCallback(ctx, action);
  }

  // Eslatmani yoqish / o'chirish
  if (data === "toggle_notify") {
    return handleToggleNotifyCallback(ctx);
  }

  // To'liq musiqani topish va yuklash (Shazam orqali)
  if (data.startsWith("dl_full_a:")) {
    const cacheId = data.replace("dl_full_a:", "");
    return handleDownloadFullAudio(ctx, cacheId);
  }

  // Qisqa audio yuklash
  if (data.startsWith("dl_a:")) {
    const cacheId = data.replace("dl_a:", "");
    return handleDownloadShortAudio(ctx, cacheId);
  }

  // Video yuklash
  if (data.startsWith("dl_v:")) {
    const cacheId = data.replace("dl_v:", "");
    return handleDownloadVideo(ctx, cacheId);
  }

  // Yumaloq video (Krujok) yuklash
  if (data.startsWith("dl_vnote:")) {
    const cacheId = data.replace("dl_vnote:", "");
    return handleDownloadVideoNote(ctx, cacheId);
  }

  // Ikkalasini ham yuklash
  if (data.startsWith("dl_both:")) {
    const cacheId = data.replace("dl_both:", "");
    return handleDownloadBoth(ctx, cacheId);
  }

  // Qidiruvdan musiqa yuklash
  if (data.startsWith("dl_search_a:")) {
    const cacheId = data.replace("dl_search_a:", "");
    return handleSearchDownload(ctx, cacheId);
  }

  // Admin statistikasi davri
  if (data.startsWith("adm_p:")) {
    const period = data.replace("adm_p:", "");
    await ctx.answerCallbackQuery();
    return handleAdminPanel(ctx, period);
  }
});

// 6. Matnli xabarlar (Menyu tugmalari va qidiruv)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  // Buyruq bo'lsa o'tkazib yuborish
  if (text.startsWith("/")) return;

  // Menyu tugmalari
  if (text === "🕌 Bugungi namoz vaqtlari") {
    return handleTodayPrayer(ctx);
  }
  if (text === "📍 Hududni tanlash") {
    return handleChooseRegion(ctx);
  }
  if (text === "📅 Haftalik taqvim") {
    return handleWeeklyPrayer(ctx);
  }
  if (text === "📿 Tasbeh") {
    return handleTasbeh(ctx);
  }
  if (text === "⏰ Eslatma sozlamasi") {
    return handleNotificationSettings(ctx);
  }
  if (text === "🤲 Duolar") {
    return handleDuolar(ctx);
  }

  // 1. Havola tekshirish (Instagram, TikTok, YouTube, Pinterest, etc.)
  const urls = extractUrls(text);
  if (urls.length > 0) {
    return handleLink(ctx, urls[0]);
  }

  // 2. Oddiy matn bo'lsa — Musiqa nomi bo'yicha qidiruv
  return handleSearch(ctx, text);
});

// 7. Video, audio, krujok yuborilganda
bot.on([":video", ":video_note", ":audio", ":voice"], handleDirectVideo);

// 8. Xatoliklarni boshqarish
bot.catch((err) => {
  console.error("Botda xatolik yuz berdi:", err.message);
});

// 9. Namoz vaqti bildirishnomalarini (Azon eslatmasi) ishga tushirish
startPrayerReminder(bot);

// 10. Botni ishga tushirish
bot.start({
  onStart: (botInfo) => {
    console.log(`🕌 Namoz Vaqtlari Boti (@${botInfo.username}) muvaffaqiyatli ishga tushdi!`);
  },
});

// 11. Render.com bepul Web Service uchun HTTP server (Health Check)
const http = require("http");
const port = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("🕌 Namoz Vaqtlari Boti 24/7 ishlamoqda!\n");
}).listen(port, () => {
  console.log(`🌐 HTTP Server port ${port} da ishga tushdi (Render uchun).`);
});
