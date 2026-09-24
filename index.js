require("dotenv").config();
const { Bot } = require("grammy");
const config = require("./src/config");
const { initDatabase } = require("./src/database/schema");
const userRepository = require("./src/database/users");

// Handlers
const { handleStart } = require("./src/handlers/start");
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
bot.command("yumoloq", handleYumoloqCommand);
bot.command("krujok", handleYumoloqCommand);
bot.command("ovoz", handleVoiceCommand);
bot.command("voice", handleVoiceCommand);
bot.command("golos", handleVoiceCommand);
bot.command("admin", (ctx) => handleAdminPanel(ctx, "all"));

// 4. Inline Callback Router
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;

  // To'liq musiqani topish va yuklash (Shazam orqali)
  if (data.startsWith("dl_full_a:")) {
    const cacheId = data.replace("dl_full_a:", "");
    return handleDownloadFullAudio(ctx, cacheId);
  }

  // Qisqa audio yuklash (Videodagi)
  if (data.startsWith("dl_a:")) {
    const cacheId = data.replace("dl_a:", "");
    return handleDownloadShortAudio(ctx, cacheId);
  }

  // Video yuklash (Havoladan)
  if (data.startsWith("dl_v:")) {
    const cacheId = data.replace("dl_v:", "");
    return handleDownloadVideo(ctx, cacheId);
  }

  // Yumaloq video (Krujok) yuklash
  if (data.startsWith("dl_vnote:")) {
    const cacheId = data.replace("dl_vnote:", "");
    return handleDownloadVideoNote(ctx, cacheId);
  }

  // Ikkalasini ham yuklash (Full musiqa + Video)
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

// 5. Video, audio, krujok yuborilganda (Shazam orqali to'liq musiqasini topish)
bot.on([":video", ":video_note", ":audio", ":voice"], handleDirectVideo);

// 6. Matnli xabarlar (Havola yoki Musiqa qidirish)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();

  // Buyruq bo'lsa o'tkazib yuborish
  if (text.startsWith("/")) return;

  // 1. Havola tekshirish (Instagram, TikTok, YouTube, Pinterest, etc.)
  const urls = extractUrls(text);
  if (urls.length > 0) {
    return handleLink(ctx, urls[0]);
  }

  // 2. Oddiy matn bo'lsa — Musiqa nomi bo'yicha qidiruv
  return handleSearch(ctx, text);
});

// Xatoliklarni boshqarish
bot.catch((err) => {
  console.error("Botda xatolik yuz berdi:", err.message);
});

// Botni ishga tushirish
bot.start({
  onStart: (botInfo) => {
    console.log(`🚀 Musiqa & Video Bot (@${botInfo.username}) muvaffaqiyatli ishga tushdi!`);
  },
});
