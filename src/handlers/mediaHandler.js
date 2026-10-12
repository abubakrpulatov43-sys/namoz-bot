const { InputFile } = require("grammy");
const path = require("path");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const mediaDownloader = require("../services/mediaDownloader");
const shazamService = require("../services/shazamService");
const musicSearchService = require("../services/musicSearch");
const config = require("../config");
const downloadRepository = require("../database/downloads");
const userRepository = require("../database/users");
const { escapeHtml } = require("../utils/text");

async function downloadTelegramFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(fileUrl, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function handleDirectVideo(ctx) {
  const isVoice = !!ctx.message.voice;
  const isAudio = !!ctx.message.audio;
  const isVideoNote = !!ctx.message.video_note;
  const isVideo = !!ctx.message.video;

  const fileObj = ctx.message.video || ctx.message.video_note || ctx.message.audio || ctx.message.voice;
  if (!fileObj) return;

  let initialText = "🔍 <b>Videodagi musiqa aniqlanmoqda (Shazam)...</b>";
  if (isVoice) {
    initialText = "🎙 <b>Ovoz eshitilmoqda va qo'shiq aniqlanmoqda (Shazam)...</b>";
  } else if (isAudio) {
    initialText = "🎵 <b>Musiqa aniqlanmoqda (Shazam)...</b>";
  } else if (isVideoNote) {
    initialText = "⭕️ <b>Krujokdagi musiqa aniqlanmoqda (Shazam)...</b>";
  }

  const statusMsg = await ctx.reply(initialText, {
    parse_mode: "HTML",
  });

  let rawFile = null;
  let audioSnippet = null;
  let fullSongPath = null;
  let fullAudioFallback = null;

  try {
    const fileInfo = await ctx.api.getFile(fileObj.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${fileInfo.file_path}`;

    const tempId = crypto.randomBytes(6).toString("hex");
    const ext = path.extname(fileInfo.file_path) || (isVoice ? ".oga" : isAudio ? ".mp3" : ".mp4");
    rawFile = path.join(config.downloadDir, `tg_${tempId}${ext}`);

    // Telegramdan faylni yuklab olish
    await downloadTelegramFile(fileUrl, rawFile);

    // Shazam uchun tezkor 10-12 soniyali mono audio snippet ajratish (0.05 soniya)
    audioSnippet = await mediaDownloader.extractAudioSnippetForShazam(rawFile);

    // Shazam orqali qo'shiqni aniqlash (1-urinish: Snippet)
    let recognized = await shazamService.recognize(audioSnippet);
    
    // Agar snippet orqali topilmasa, to'liq fayldan aniqlash (2-urinish)
    if (!recognized || !recognized.title) {
      recognized = await shazamService.recognize(rawFile);
    }

    if (recognized && recognized.title) {
      const safeTitle = escapeHtml(recognized.title);
      const safeArtist = escapeHtml(recognized.artist);
      const normalizedKey = `shz_${recognized.artist}_${recognized.title}`.toLowerCase().replace(/[^a-z0-9]/g, "");

      // 1. Keshda mavjudligini tekshirish
      const cached = downloadRepository.getCachedFile(normalizedKey, "audio");
      if (cached && cached.file_id) {
        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        await ctx.replyWithAudio(cached.file_id, {
          title: recognized.title,
          performer: recognized.artist,
          caption: `🎵 <b>${safeArtist} — ${safeTitle}</b> (To'liq versiya)\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali topildi`,
          parse_mode: "HTML",
        });
        downloadRepository.log({
          telegramId: ctx.from.id,
          type: isVoice ? "voice_shazam" : "video_shazam",
          sourceUrl: "shazam_cache",
          title: `${recognized.artist} - ${recognized.title}`,
        });
        userRepository.incrementDownloads(ctx.from.id);
        return;
      }

      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `🎵 <b>Topildi: ${safeArtist} — ${safeTitle}</b>\n⚡️ To'liq musiqa yuklab berilmoqda...`,
        { parse_mode: "HTML" }
      ).catch(() => {});

      // YouTube orqali eng sifatli to'liq trekni qidirish
      const searchResults = await musicSearchService.search(`${recognized.artist} - ${recognized.title}`, 1);
      if (searchResults && searchResults.length > 0) {
        const topSong = searchResults[0];

        // YouTube URL bo'yicha keshni tekshirish
        const ytCached = downloadRepository.getCachedFile(topSong.url, "audio");
        if (ytCached && ytCached.file_id) {
          await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
          await ctx.replyWithAudio(ytCached.file_id, {
            title: recognized.title,
            performer: recognized.artist,
            duration: topSong.seconds || undefined,
            caption: `🎵 <b>${safeArtist} — ${safeTitle}</b> (To'liq versiya)\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali topildi`,
            parse_mode: "HTML",
          });
          downloadRepository.saveCachedFile(normalizedKey, ytCached.file_id, "audio", recognized.title, recognized.artist);
          downloadRepository.log({
            telegramId: ctx.from.id,
            type: isVoice ? "voice_shazam" : "video_shazam",
            sourceUrl: topSong.url,
            title: `${recognized.artist} - ${recognized.title}`,
          });
          userRepository.incrementDownloads(ctx.from.id);
          return;
        }

        // To'liq musiqani tezkor oqimli yuklash
        fullSongPath = await mediaDownloader.downloadAudio(topSong.url);

        const sent = await ctx.replyWithAudio(new InputFile(fullSongPath), {
          title: recognized.title,
          performer: recognized.artist,
          duration: topSong.seconds || undefined,
          caption: `🎵 <b>${safeArtist} — ${safeTitle}</b> (To'liq versiya)\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali topildi`,
          parse_mode: "HTML",
        });

        if (sent && sent.audio) {
          downloadRepository.saveCachedFile(normalizedKey, sent.audio.file_id, "audio", recognized.title, recognized.artist);
          downloadRepository.saveCachedFile(topSong.url, sent.audio.file_id, "audio", recognized.title, recognized.artist);
        }

        downloadRepository.log({
          telegramId: ctx.from.id,
          type: isVoice ? "voice_shazam" : "video_shazam",
          sourceUrl: topSong.url,
          title: `${recognized.artist} - ${recognized.title}`,
          duration: topSong.seconds,
        });
        userRepository.incrementDownloads(ctx.from.id);

        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return;
      }
    }

    // Agar Shazam orqali aniqlanmasa:
    if (isVoice) {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      return ctx.reply(
        `😔 <b>Kechirasiz, ushbu ovozdagi qo'shiqni aniqlab bo'lmadi.</b>\n\n💡 <i>Maslahat: Qo'shiq aniqroq eshitiladigan joyidan 5-10 soniya yozib yuboring yoki qo'shiq/ijrochi nomini yozing.</i>`,
        { parse_mode: "HTML" }
      );
    }

    // Videodan audio ajratib berish (agar Shazam topolmasa)
    fullAudioFallback = await mediaDownloader.extractAudioFromLocalFile(rawFile);
    const fallbackTitle = ctx.message.video?.file_name ? ctx.message.video.file_name.replace(/\.[^/.]+$/, "") : "Ajratilgan Musiqa";
    const safeFallbackTitle = escapeHtml(fallbackTitle);

    await ctx.replyWithAudio(new InputFile(fullAudioFallback), {
      title: fallbackTitle,
      performer: "pulatov.music.uz",
      caption: `🎵 <b>${safeFallbackTitle}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali ajratib olindi`,
      parse_mode: "HTML",
    });

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "audio_extract",
      sourceUrl: "telegram_upload",
      title: fallbackTitle,
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Direct media recognition error:", err);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Musiqani aniqlashda xatolik yuz berdi:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (rawFile) mediaDownloader.cleanupFile(rawFile);
    if (audioSnippet) mediaDownloader.cleanupFile(audioSnippet);
    if (fullSongPath) mediaDownloader.cleanupFile(fullSongPath);
    if (fullAudioFallback) mediaDownloader.cleanupFile(fullAudioFallback);
  }
}

module.exports = { handleDirectVideo };
