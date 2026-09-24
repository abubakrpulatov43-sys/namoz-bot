const { InputFile } = require("grammy");
const path = require("path");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const mediaDownloader = require("../services/mediaDownloader");
const urlCache = require("../services/urlCache");
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

// /yumoloq komandasi
async function handleYumoloqCommand(ctx) {
  // Agar foydalanuvchi biror videoga reply qilib /yumoloq yozgan bo'lsa
  const replyMsg = ctx.message?.reply_to_message;
  if (replyMsg && (replyMsg.video || replyMsg.video_note || replyMsg.animation)) {
    return handleVideoToNote(ctx, replyMsg.video || replyMsg.video_note || replyMsg.animation);
  }

  const text =
    `🔘 <b>Yumaloq Video (Krujok) Yasash:</b>\n\n` +
    `1. Menga istalgan <b>video</b> yuboring (yoki videoga reply qilib <code>/yumoloq</code> deb yozing).\n` +
    `2. Yoki <b>Instagram, TikTok, YouTube</b> video havolasini yuboring va <b>"🔘 Yumaloq video"</b> tugmasini bosing!\n\n` +
    `Bot uni Telegram uchun 1:1 yumaloq video xabarga (Video Note) aylantirib beradi.`;

  await ctx.reply(text, { parse_mode: "HTML" });
}

// Telegramdagi videoni yumaloq xabarga aylantirish
async function handleVideoToNote(ctx, fileObj) {
  const statusMsg = await ctx.reply("⏳ <b>Video yumaloq shaklga (Krujok) keltirilmoqda...</b>", {
    parse_mode: "HTML",
  });

  let rawFile = null;
  let noteFile = null;

  try {
    const fileInfo = await ctx.api.getFile(fileObj.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${fileInfo.file_path}`;

    const tempId = crypto.randomBytes(6).toString("hex");
    const ext = path.extname(fileInfo.file_path) || ".mp4";
    rawFile = path.join(config.downloadDir, `vraw_${tempId}${ext}`);

    await downloadTelegramFile(fileUrl, rawFile);

    noteFile = await mediaDownloader.convertToVideoNote(rawFile);

    await ctx.replyWithVideoNote(new InputFile(noteFile), {
      length: 480,
    });

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "video_note",
      sourceUrl: "telegram_video",
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Video note error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Yumaloq video yasashda xatolik:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (rawFile) mediaDownloader.cleanupFile(rawFile);
    if (noteFile) mediaDownloader.cleanupFile(noteFile);
  }
}

// Havoladagi videoni yuklab, yumaloq xabar qilib berish
async function handleDownloadVideoNote(ctx, cacheId) {
  const item = urlCache.get(cacheId);
  if (!item) {
    return ctx.answerCallbackQuery({ text: "Havola eskirgan. Qaytadan yuboring." });
  }

  await ctx.answerCallbackQuery({ text: "🔘 Yumaloq video tayyorlanmoqda..." });

  const statusMsg = await ctx.reply("⏳ <b>Video yuklanib, yumaloq shaklga (Krujok) aylantirilmoqda...</b>", {
    parse_mode: "HTML",
  });

  let rawVideo = null;
  let noteFile = null;

  try {
    rawVideo = await mediaDownloader.downloadVideo(item.url);
    noteFile = await mediaDownloader.convertToVideoNote(rawVideo);

    await ctx.replyWithVideoNote(new InputFile(noteFile), {
      length: 480,
    });

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "video_note",
      sourceUrl: item.url,
      title: item.meta?.title,
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Link to video note error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Yumaloq video yasashda xatolik:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (rawVideo) mediaDownloader.cleanupFile(rawVideo);
    if (noteFile) mediaDownloader.cleanupFile(noteFile);
  }
}

module.exports = {
  handleYumoloqCommand,
  handleVideoToNote,
  handleDownloadVideoNote,
};
