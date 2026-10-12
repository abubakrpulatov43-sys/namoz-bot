const { InlineKeyboard, InputFile } = require("grammy");
const musicSearchService = require("../services/musicSearch");
const mediaDownloader = require("../services/mediaDownloader");
const urlCache = require("../services/urlCache");
const userRepository = require("../database/users");
const downloadRepository = require("../database/downloads");
const { escapeHtml } = require("../utils/text");

async function handleSearch(ctx, query) {
  const safeQuery = escapeHtml(query);
  const loading = await ctx.reply(`⚡️ <b>"${safeQuery}" qidirilmoqda...</b>`, {
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
    } else if (topSong.title.includes("—")) {
      const parts = topSong.title.split("—");
      artist = parts[0].trim();
      songName = parts.slice(1).join("—").trim();
    }

    // Ro'yxat matnini shakllantirish
    let text = `👤 <b>Исполнитель:</b> ${escapeHtml(artist)}\n` +
               `🎵 <b>Название песни:</b> ${escapeHtml(songName)}\n\n`;

    const inlineKb = new InlineKeyboard();
    const topVideoCacheId = urlCache.store(topSong.url, { title: topSong.title, uploader: artist });
    
    // 1-qator: Video tugmasi
    inlineKb.text("📁 Video", `dl_v:${topVideoCacheId}`);
    inlineKb.row();

    // 2-qator: 1, 2, 3, 4, 5 raqamli tugmalar
    results.forEach((s, idx) => {
      const num = idx + 1;
      text += `${num}. ${escapeHtml(s.title)} ${s.duration ? escapeHtml(s.duration) : ""}\n`;
      
      const cacheId = urlCache.store(s.url, { title: s.title, uploader: s.author, duration: s.seconds });
      inlineKb.text(`${num}`, `dl_search_a:${cacheId}`);
    });

    // Rasm bilan yuborish (Thumbnail)
    const photoUrl = topSong.thumbnail || "https://picsum.photos/600/400";
    
    await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});

    try {
      await ctx.replyWithPhoto(photoUrl, {
        caption: text,
        parse_mode: "HTML",
        reply_markup: inlineKb,
      });
    } catch (photoErr) {
      // Agar rasm yuborishda xatolik bo'lsa, oddiy matn ko'rinishida yuboriladi
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: inlineKb,
      });
    }
  } catch (err) {
    console.error("Auto-search error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Qidiruvda xatolik:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
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
    const safeArtist = escapeHtml(cached.performer || item.meta?.uploader || "pulatov.music.uz");
    await ctx.replyWithAudio(cached.file_id, {
      title: cached.title || item.meta?.title,
      performer: cached.performer || item.meta?.uploader,
      caption: `🎵 <b>${safeArtist} — ${safeTitle}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
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

    let artist = item.meta?.uploader || "pulatov.music.uz";
    let title = item.meta?.title || "Musiqa";
    if (title.includes("-")) {
      const parts = title.split("-");
      artist = parts[0].trim();
      title = parts.slice(1).join("-").trim();
    } else if (title.includes("—")) {
      const parts = title.split("—");
      artist = parts[0].trim();
      title = parts.slice(1).join("—").trim();
    }

    const duration = item.meta?.duration || undefined;
    const safeTitle = escapeHtml(title);
    const safeArtist = escapeHtml(artist);

    const sent = await ctx.replyWithAudio(new InputFile(filePath), {
      title: title,
      performer: artist,
      duration: duration,
      caption: `🎵 <b>${safeArtist} — ${safeTitle}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
      parse_mode: "HTML",
    });

    if (sent && sent.audio) {
      downloadRepository.saveCachedFile(item.url, sent.audio.file_id, "audio", title, artist);
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
