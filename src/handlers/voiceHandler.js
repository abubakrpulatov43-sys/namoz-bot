const { InputFile } = require("grammy");
const path = require("path");
const fs = require("fs");
const https = require("https");
const crypto = require("crypto");
const mediaDownloader = require("../services/mediaDownloader");
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

// /ovoz yoki /voice komandasi
async function handleVoiceCommand(ctx) {
  const replyMsg = ctx.message?.reply_to_message;

  if (replyMsg && (replyMsg.video || replyMsg.video_note || replyMsg.audio || replyMsg.voice)) {
    return handleVideoToVoice(ctx, replyMsg.video || replyMsg.video_note || replyMsg.audio || replyMsg.voice);
  }

  const text =
    `🎙 <b>Ovozli xabar (Golosovoy) qilish:</b>\n\n` +
    `Istalgan <b>video</b> yoki <b>audio</b>ga reply qilib <code>/ovoz</code> deb yozing!\n\n` +
    `Bot videodagi ovozni Telegram ovozli xabari (Golos) ko'rinishida yuborib beradi. 🗣✨`;

  await ctx.reply(text, { parse_mode: "HTML" });
}

// Videoni Ovozli xabarga (Golos) aylantirish
async function handleVideoToVoice(ctx, fileObj) {
  const statusMsg = await ctx.reply("⏳ <b>Ovozli xabar (Golosovoy) tayyorlanmoqda...</b>", {
    parse_mode: "HTML",
  });

  let rawFile = null;
  let voiceFile = null;

  try {
    const fileInfo = await ctx.api.getFile(fileObj.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${config.botToken}/${fileInfo.file_path}`;

    const tempId = crypto.randomBytes(6).toString("hex");
    const ext = path.extname(fileInfo.file_path) || ".mp4";
    rawFile = path.join(config.downloadDir, `vraw_${tempId}${ext}`);

    await downloadTelegramFile(fileUrl, rawFile);

    voiceFile = await mediaDownloader.convertToVoiceMessage(rawFile);

    await ctx.replyWithVoice(new InputFile(voiceFile), {
      caption: `🎙 <b>pulatov.music.uz</b> (@${ctx.me.username}) orqali ovozga aylantirildi`,
      parse_mode: "HTML",
    });

    downloadRepository.log({
      telegramId: ctx.from.id,
      type: "voice_message",
      sourceUrl: "telegram_video",
    });
    userRepository.incrementDownloads(ctx.from.id);

    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
  } catch (err) {
    console.error("Voice convert error:", err.message);
    await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ <b>Ovozli xabar yaratishda xatolik:</b> ${escapeHtml(err.message)}`, { parse_mode: "HTML" });
  } finally {
    if (rawFile) mediaDownloader.cleanupFile(rawFile);
    if (voiceFile) mediaDownloader.cleanupFile(voiceFile);
  }
}

module.exports = {
  handleVoiceCommand,
  handleVideoToVoice,
};
