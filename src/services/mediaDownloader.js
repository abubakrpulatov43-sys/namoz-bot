const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const config = require("../config");

if (!fs.existsSync(config.downloadDir)) {
  fs.mkdirSync(config.downloadDir, { recursive: true });
}

// In-progress downloads promise cache to prevent duplicate simultaneous downloads
const downloadQueue = new Map();

const mediaDownloader = {
  // Tezkor Audio yuklash (Direct Stream 140/251/ba)
  async downloadAudio(url) {
    if (downloadQueue.has(url)) {
      return downloadQueue.get(url);
    }

    const downloadPromise = (async () => {
      const fileId = crypto.randomBytes(6).toString("hex");
      const outputTemplate = path.join(config.downloadDir, `a_${fileId}.%(ext)s`);

      return new Promise((resolve, reject) => {
        const args = [
          "--ffmpeg-location", config.ffmpegPath,
          "-f", "140/251/ba[filesize<20M]/ba",
          "--no-playlist",
          "--no-check-certificates",
          "--buffer-size", "64K",
          "--max-filesize", `${config.maxFileSizeMB}M`,
          "-o", outputTemplate,
          "--no-warnings",
          url
        ];

        execFile(config.ytDlpPath, args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            console.error("yt-dlp audio download error:", stderr || err.message);
            // Fallback to ffmpeg audio extraction
            const fallbackArgs = [
              "--ffmpeg-location", config.ffmpegPath,
              "-x", "--audio-format", "mp3",
              "--no-playlist", "--no-check-certificates",
              "-o", outputTemplate,
              url
            ];
            return execFile(config.ytDlpPath, fallbackArgs, (fbErr) => {
              if (fbErr) return reject(new Error("Audio yuklab bo'lmadi."));
              const files = fs.readdirSync(config.downloadDir).filter(f => f.startsWith(`a_${fileId}`));
              if (files.length > 0) resolve(path.join(config.downloadDir, files[0]));
              else reject(new Error("Fayl topilmadi."));
            });
          }

          const files = fs.readdirSync(config.downloadDir).filter(f => f.startsWith(`a_${fileId}`));
          if (files.length > 0) {
            resolve(path.join(config.downloadDir, files[0]));
          } else {
            reject(new Error("Audio fayli topilmadi."));
          }
        });
      });
    })();

    downloadQueue.set(url, downloadPromise);
    try {
      const result = await downloadPromise;
      return result;
    } finally {
      downloadQueue.delete(url);
    }
  },

  // Tezkor Video yuklash (MP4)
  async downloadVideo(url) {
    if (downloadQueue.has("v_" + url)) {
      return downloadQueue.get("v_" + url);
    }

    const downloadPromise = (async () => {
      const fileId = crypto.randomBytes(6).toString("hex");
      const outputTemplate = path.join(config.downloadDir, `v_${fileId}.%(ext)s`);

      return new Promise((resolve, reject) => {
        const args = [
          "--ffmpeg-location", config.ffmpegPath,
          "-f", "best[ext=mp4][height<=720]/18/bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4]/best",
          "--merge-output-format", "mp4",
          "--no-playlist",
          "--no-check-certificates",
          "--buffer-size", "64K",
          "--max-filesize", `${config.maxFileSizeMB}M`,
          "-o", outputTemplate,
          "--no-warnings",
          url
        ];

        execFile(config.ytDlpPath, args, { maxBuffer: 15 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            console.error("yt-dlp video error:", stderr || err.message);
            return reject(new Error("Video yuklab olishda xatolik yuz berdi."));
          }

          const files = fs.readdirSync(config.downloadDir).filter(f => f.startsWith(`v_${fileId}`));
          if (files.length > 0) {
            resolve(path.join(config.downloadDir, files[0]));
          } else {
            reject(new Error("Video fayli topilmadi."));
          }
        });
      });
    })();

    downloadQueue.set("v_" + url, downloadPromise);
    try {
      const result = await downloadPromise;
      return result;
    } finally {
      downloadQueue.delete("v_" + url);
    }
  },

  // Ultrafast Yumaloq video (Krujok) aylantirish
  async convertToVideoNote(inputPath) {
    const fileId = crypto.randomBytes(6).toString("hex");
    const outputPath = path.join(config.downloadDir, `vn_${fileId}.mp4`);

    return new Promise((resolve, reject) => {
      const args = [
        "-i", inputPath,
        "-t", "60",
        "-vf", "crop=min(iw\\,ih):min(iw\\,ih),scale=480:480",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-threads", "0",
        "-crf", "26",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ar", "44100",
        "-y",
        outputPath
      ];

      execFile(config.ffmpegPath, args, (err) => {
        if (err) return reject(new Error("Yumaloq videoga aylantirishda xatolik."));
        resolve(outputPath);
      });
    });
  },

  // Ultrafast Ovoz ajratish
  async extractAudioFromLocalFile(inputPath) {
    const fileId = crypto.randomBytes(6).toString("hex");
    const outputPath = path.join(config.downloadDir, `ext_${fileId}.mp3`);

    return new Promise((resolve, reject) => {
      const args = [
        "-i", inputPath,
        "-vn",
        "-ar", "44100",
        "-ac", "2",
        "-b:a", "128k",
        "-threads", "0",
        "-y",
        outputPath
      ];

      execFile(config.ffmpegPath, args, (err) => {
        if (err) return reject(new Error("Videodan musiqani ajratib olishda xatolik."));
        resolve(outputPath);
      });
    });
  },

  // Telegram Ovozli xabar (Golosovoy - OGG Opus)
  async convertToVoiceMessage(inputPath) {
    const fileId = crypto.randomBytes(6).toString("hex");
    const outputPath = path.join(config.downloadDir, `voice_${fileId}.ogg`);

    return new Promise((resolve, reject) => {
      const args = [
        "-i", inputPath,
        "-vn",
        "-c:a", "libopus",
        "-b:a", "64k",
        "-vbr", "on",
        "-threads", "0",
        "-y",
        outputPath
      ];

      execFile(config.ffmpegPath, args, (err) => {
        if (err) return reject(new Error("Ovozli xabarga aylantirishda xatolik."));
        resolve(outputPath);
      });
    });
  },

  cleanupFile(filePath) {
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {}
  }
};

module.exports = mediaDownloader;
