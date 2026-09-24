const { InlineKeyboard, InputFile } = require("grammy");
const musicSearchService = require("../services/musicSearch");
const mediaDownloader = require("../services/mediaDownloader");
const urlCache = require("../services/urlCache");
const userRepository = require("../database/users");
const downloadRepository = require("../database/downloads");
const { escapeHtml } = require("../utils/text");

async function handleSearch(ctx, query) {
  const safeQuery = escapeHtml(query);
  const loading = await ctx.reply(`⚡️ <b>"${safeQuery}" topilmoqda...</b>`, {
    parse_mode: "HTML",
  });

  try {
    // 1. Eng mos 5 ta natijani olish
    const results = await musicSearchService.search(query, 5);

    if (!results || results.length === 0) {
      await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      return ctx.reply(`❌ <b>"${safeQuery}"</b> bo'yicha musiqa topilmadi.`, {
        parse_mode: "HTML",
      });
    }

    const topSong = results[0];

    // Ijrochi va qo'shiq nomini ajratish
    let artist = topSong.author || "pulatov.music.uz";
    let songName = topSong.title;

    if (topSong.title.includes("-")) {
      const parts = topSong.title.split("-");
      artist = parts[0].trim();
      songName = parts.slice(1).join("-").trim();
    }

    // 2. KESHDA BORLIGINI TEKSHIRISH (0.1 soniyada yuborish)
    const cached = downloadRepository.getCachedFile(topSong.url, "audio");
    if (cached && cached.file_id) {
      await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
      await ctx.replyWithAudio(cached.file_id, {
        caption: `🎵 <b>${escapeHtml(songName)}</b>\n👤 <b>${escapeHtml(artist)}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali topildi`,
        parse_mode: "HTML",
      });
      userRepository.incrementDownloads(ctx.from.id);
      return;
    }

    // 3. TO'G'RIDAN-TO'G'RI YUKLAB YUBORISH (Hech qanday tugma bosish talab qilinmaydi!)
    const filePath = await mediaDownloader.downloadAudio(topSong.url);

    const safeTitle = escapeHtml(songName);
    const safeArtist = escapeHtml(artist);

    // Qo'shimcha variantlar tugmalari (ixtiyoriy)
    const inlineKb = new InlineKeyboard();
    const topVideoCacheId = urlCache.store(topSong.url, { title: topSong.title, uploader: artist });
    inlineKb.text("🗂 Videoni yuklash", `dl_v:${topVideoCacheId}`);

    if (results.length > 1) {
      inlineKb.row();
      results.slice(1).forEach((s, idx) => {
        const cacheId = urlCache.store(s.url, { title: s.title, uploader: s.author });
        inlineKb.text(`🎵 Variant ${idx + 2}`, `dl_search_a:${cacheId}`);
      });
    }

    const sent = await ctx.replyWithAudio(new InputFile(filePath), {
      title: songName,
      performer: artist,
      duration: topSong.seconds || undefined,
      caption: `🎵 <b>${safeTitle}</b>\n👤 <b>${safeArtist}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali topildi`,
      parse_mode: "HTML",
      reply_markup: inlineKb,
    });

    if (sent && sent.audio) {
      downloadRepository.saveCachedFile(topSong.url, sent.audio.file_id, "audio", songName, artist);
    }

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "audio",
      sourceUrl: topSong.url,
      title: songName,
      duration: topSong.seconds,
    });
    userRepository.incrementDownloads(ctx.from.id);

    mediaDownloader.cleanupFile(filePath);
    await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
  } catch (err) {
    console.error("Auto-search error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Musiqani yuklashda xatolik:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  }
}

// Qo'shimcha variant bosilganda
async function handleSearchDownload(ctx, cacheId) {
  const item = urlCache.get(cacheId);
  if (!item) {
    return ctx.answerCallbackQuery({ text: "Havola eskirgan. Qaytadan qidiring." });
  }

  const cached = downloadRepository.getCachedFile(item.url, "audio");
  if (cached && cached.file_id) {
    await ctx.answerCallbackQuery({ text: "⚡️ Musiqa yuborilmoqda..." });
    const safeTitle = escapeHtml(cached.title || item.meta?.title || "Musiqa");
    await ctx.replyWithAudio(cached.file_id, {
      caption: `🎵 <b>${safeTitle}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
      parse_mode: "HTML",
    });
    userRepository.incrementDownloads(ctx.from.id);
    return;
  }

  await ctx.answerCallbackQuery({ text: "⚡️ Musiqa yuklanmoqda..." });

  const statusMsg = await ctx.reply("⚡️ <b>Musiqa yuklanmoqda, kuting...</b>", {
    parse_mode: "HTML",
  });

  let filePath = null;
  try {
    filePath = await mediaDownloader.downloadAudio(item.url);

    const title = item.meta?.title || "Musiqa";
    const performer = item.meta?.uploader || "pulatov.music.uz";
    const duration = item.meta?.duration || undefined;
    const safeTitle = escapeHtml(title);

    const sent = await ctx.replyWithAudio(new InputFile(filePath), {
      title: title,
      performer: performer,
      duration: duration,
      caption: `🎵 <b>${safeTitle}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
      parse_mode: "HTML",
    });

    if (sent && sent.audio) {
      downloadRepository.saveCachedFile(item.url, sent.audio.file_id, "audio", title, performer);
    }

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "audio",
      sourceUrl: item.url,
      title: title,
      duration: duration,
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Search download error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Musiqani yuklab bo'lmadi:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (filePath) mediaDownloader.cleanupFile(filePath);
  }
}

module.exports = {
  handleSearch,
  handleSearchDownload,
};
