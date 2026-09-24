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
  const fileObj = ctx.message.video || ctx.message.video_note || ctx.message.audio || ctx.message.voice;
  if (!fileObj) return;

  const statusMsg = await ctx.reply("🔍 <b>Videodagi to'liq musiqa aniqlanmoqda (Shazam)...</b>", {
    parse_mode: "HTML",
  });

  let rawFile = null;
  let extractedAudio = null;
  let fullSongPath = null;

  try {
    const fileInfo = await ctx.api.getFile(fileObj.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${fileInfo.file_path}`;

    const tempId = crypto.randomBytes(6).toString("hex");
    const ext = path.extname(fileInfo.file_path) || ".mp4";
    rawFile = path.join(config.downloadDir, `tg_${tempId}${ext}`);

    await downloadTelegramFile(fileUrl, rawFile);

    // Audioni ajratish
    extractedAudio = await mediaDownloader.extractAudioFromLocalFile(rawFile);

    // Shazam orqali to'liq musiqani topish
    const recognized = await shazamService.recognize(extractedAudio);

    if (recognized && recognized.title) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `🎵 <b>Topildi: ${escapeHtml(recognized.artist)} — ${escapeHtml(recognized.title)}</b>\nTo'liq musiqa yuklanmoqda...`,
        { parse_mode: "HTML" }
      ).catch(() => {});

      const searchResults = await musicSearchService.search(`${recognized.artist} - ${recognized.title}`, 1);
      if (searchResults && searchResults.length > 0) {
        fullSongPath = await mediaDownloader.downloadAudio(searchResults[0].url);

        const safeTitle = escapeHtml(recognized.title);
        const safeArtist = escapeHtml(recognized.artist);

        await ctx.replyWithAudio(new InputFile(fullSongPath), {
          title: recognized.title,
          performer: recognized.artist,
          duration: searchResults[0].seconds || undefined,
          caption: `🎵 <b>${safeTitle}</b> (To'liq versiya)\n👤 <b>Ijrochi:</b> ${safeArtist}\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali topildi`,
          parse_mode: "HTML",
        });

        downloadRepository.log({
          telegramId: ctx.from.id,
          type: "audio_full",
          sourceUrl: "telegram_video",
          title: recognized.title,
        });
        userRepository.incrementDownloads(ctx.from.id);

        await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return;
      }
    }

    // Agar to'liq versiyasi topilmasa, ajratilgan qisqa audioni yuboramiz
    const title = ctx.message.video?.file_name ? ctx.message.video.file_name.replace(/\.[^/.]+$/, "") : "Ajratilgan Musiqa";
    const safeTitle = escapeHtml(title);

    await ctx.replyWithAudio(new InputFile(extractedAudio), {
      title: title,
      performer: "pulatov.music.uz",
      caption: `🎵 <b>${safeTitle}</b>\n\n🤖 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali ajratib olindi`,
      parse_mode: "HTML",
    });

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "audio",
      sourceUrl: "telegram_upload",
      title: title,
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Direct video extraction error:", err);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Musiqani aniqlashda xatolik yuz berdi:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (rawFile) mediaDownloader.cleanupFile(rawFile);
    if (extractedAudio) mediaDownloader.cleanupFile(extractedAudio);
    if (fullSongPath) mediaDownloader.cleanupFile(fullSongPath);
  }
}

module.exports = { handleDirectVideo };
