const { InlineKeyboard, InputFile } = require("grammy");
const mediaDownloader = require("../services/mediaDownloader");
const musicSearchService = require("../services/musicSearch");
const shazamService = require("../services/shazamService");
const urlCache = require("../services/urlCache");
const userRepository = require("../database/users");
const downloadRepository = require("../database/downloads");
const { escapeHtml } = require("../utils/text");

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches || [];
}

// Havola kelganda darhol (0.1 soniyada) tugmalarni chiqarish
async function handleLink(ctx, url) {
  const cacheId = urlCache.store(url, { url });

  let platformName = "Video";
  if (url.includes("instagram.com")) platformName = "Instagram";
  else if (url.includes("tiktok.com")) platformName = "TikTok";
  else if (url.includes("youtube.com") || url.includes("youtu.be")) platformName = "YouTube";
  else if (url.includes("pinterest.com")) platformName = "Pinterest";

  const caption =
    `🎬 <b>${platformName} havolasi qabul qilindi!</b>\n\n` +
    `Nimani yuklab olmoqchisiz?`;

  const inlineKb = new InlineKeyboard()
    .text("🎵 Musiqa (MP3)", `dl_full_a:${cacheId}`)
    .text("🎬 Video (MP4)", `dl_v:${cacheId}`);

  await ctx.reply(caption, {
    parse_mode: "HTML",
    reply_markup: inlineKb,
  });
}

// TO'LIQ ORIGINAL MUSIQANI TOPISH VA YUKLASH (Shazam + Kesh)
async function handleDownloadFullAudio(ctx, cacheId) {
  const item = urlCache.get(cacheId);
  if (!item) {
    return ctx.answerCallbackQuery({ text: "Havola eskirgan. Qaytadan yuboring." });
  }

  // 1. KESH TEKSHIRISH (Agar oldin yuklangan bo'lsa 0.1 soniyada yuboriladi)
  const cached = downloadRepository.getCachedFile(item.url, "audio");
  if (cached && cached.file_id) {
    await ctx.answerCallbackQuery({ text: "⚡️ Musiqa yuborilmoqda..." });
    const safeTitle = escapeHtml(cached.title || "Musiqa");
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

  let tempAudioPath = null;
  let fullSongPath = null;

  try {
    tempAudioPath = await mediaDownloader.downloadAudio(item.url);

    // Shazam orqali tekshirish
    const recognized = await shazamService.recognize(tempAudioPath);

    let searchQuery = null;
    let foundTitle = null;
    let foundArtist = null;

    if (recognized && recognized.title) {
      searchQuery = `${recognized.artist} - ${recognized.title}`;
      foundTitle = recognized.title;
      foundArtist = recognized.artist;
    }

    if (searchQuery) {
      const searchResults = await musicSearchService.search(searchQuery, 1);
      if (searchResults && searchResults.length > 0) {
        const bestMatch = searchResults[0];
        fullSongPath = await mediaDownloader.downloadAudio(bestMatch.url);

        const title = foundTitle || bestMatch.title;
        const artist = foundArtist || bestMatch.author;
        const safeTitle = escapeHtml(title);

        const sent = await ctx.replyWithAudio(new InputFile(fullSongPath), {
          title: title,
          performer: artist,
          duration: bestMatch.seconds || undefined,
          caption: `🎵 <b>${safeTitle}</b> (To'liq versiya)\n👤 <b>Ijrochi:</b> ${escapeHtml(artist)}\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
          parse_mode: "HTML",
        });

        if (sent && sent.audio) {
          downloadRepository.saveCachedFile(item.url, sent.audio.file_id, "audio", title, artist);
        }

        downloadRepository.log({
          telegramId: ctx.from.id,
          type: "audio_full",
          sourceUrl: item.url,
          title: title,
        });
        userRepository.incrementDownloads(ctx.from.id);

        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return;
      }
    }

    // Shazam topolmasa audioni o'zini beramiz
    const sent = await ctx.replyWithAudio(new InputFile(tempAudioPath), {
      title: "Musiqa",
      performer: "pulatov.music.uz",
      caption: `🎵 <b>Musiqa</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
      parse_mode: "HTML",
    });

    if (sent && sent.audio) {
      downloadRepository.saveCachedFile(item.url, sent.audio.file_id, "audio", "Musiqa", "pulatov.music.uz");
    }

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Full audio error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Musiqani yuklab bo'lmadi:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (tempAudioPath) mediaDownloader.cleanupFile(tempAudioPath);
    if (fullSongPath) mediaDownloader.cleanupFile(fullSongPath);
  }
}

// TEZKOR VIDEO YUKLASH (Kesh + Fast Stream)
async function handleDownloadVideo(ctx, cacheId) {
  const item = urlCache.get(cacheId);
  if (!item) {
    return ctx.answerCallbackQuery({ text: "Havola eskirgan. Qaytadan yuboring." });
  }

  // 1. KESH TEKSHIRISH (0.1 soniyada yuborish)
  const cached = downloadRepository.getCachedFile(item.url, "video");
  if (cached && cached.file_id) {
    await ctx.answerCallbackQuery({ text: "⚡️ Video yuborilmoqda..." });
    await ctx.replyWithVideo(cached.file_id, {
      caption: `🎬 <b>Video</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
      parse_mode: "HTML",
      supports_streaming: true,
    });
    userRepository.incrementDownloads(ctx.from.id);
    return;
  }

  await ctx.answerCallbackQuery({ text: "⚡️ Video yuklanmoqda..." });

  const statusMsg = await ctx.reply("⚡️ <b>Video yuklanmoqda, kuting...</b>", {
    parse_mode: "HTML",
  });

  let filePath = null;
  try {
    filePath = await mediaDownloader.downloadVideo(item.url);

    const sent = await ctx.replyWithVideo(new InputFile(filePath), {
      caption: `🎬 <b>Video</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali yuklandi`,
      parse_mode: "HTML",
      supports_streaming: true,
    });

    if (sent && sent.video) {
      downloadRepository.saveCachedFile(item.url, sent.video.file_id, "video");
    }

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "video",
      sourceUrl: item.url,
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Video yuklash xatosi:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Videoni yuklab bo'lmadi:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (filePath) mediaDownloader.cleanupFile(filePath);
  }
}

module.exports = {
  extractUrls,
  handleLink,
  handleDownloadFullAudio,
  handleDownloadVideo,
};
