require("dotenv").config();
const path = require("path");
const fs = require("fs");

const isWindows = process.platform === "win32";

const localYtDlp = path.resolve("./bin/yt-dlp.exe");
const localFfmpeg = path.resolve("./bin/ffmpeg.exe");

const ytDlpPath = isWindows && fs.existsSync(localYtDlp) ? localYtDlp : "yt-dlp";
const ffmpegPath = isWindows && fs.existsSync(localFfmpeg) ? localFfmpeg : "ffmpeg";

const config = {
  botToken: process.env.BOT_TOKEN || "8960898115:AAEq6e5O7_shJW6adHPcOAiM7qj533kCzJw",
  adminIds: (process.env.ADMIN_IDS || "2099496881")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => Number(id)),
  dbPath: process.env.DB_PATH || "./data/musicbot.db",
  downloadDir: path.resolve("./downloads"),
  ytDlpPath: ytDlpPath,
  ffmpegPath: ffmpegPath,
  maxFileSizeMB: 50,
};

module.exports = config;
