const ytSearch = require("yt-search");

const NON_MUSIC_PATTERNS = [
  /\bhow\s+to\b/i,
  /\btutorial\b/i,
  /\blecture\b/i,
  /\bexplained\s+by\b/i,
  /\bdocumentary\b/i,
  /\bunboxing\b/i,
  /\bgameplay\b/i,
  /\bwalkthrough\b/i,
  /\bcourse\b/i,
  /\bnavigation\b/i,
  /\baircraft\b/i,
  /\bcockpit\b/i,
  /\bfunctioning\s+of\b/i,
  /\bnews\b/i,
  /\bpodcast\b/i,
  /\bvlog\b/i,
];

function cleanMusicTitle(rawTitle) {
  let title = rawTitle || "";
  // Remove brackets and noise: [Official Video], (Official Music Video), etc.
  title = title.replace(/\[\s*(official|audio|video|music|hd|hq|4k|lyric|clip|premiere|remix|slowed|reverb)[^\]]*\]/gi, "");
  title = title.replace(/\(\s*(official|audio|video|music|hd|hq|4k|lyric|clip|premiere|slowed|reverb)[^)]*\)/gi, "");
  title = title.replace(/\|?\s*official\s*(music\s*)?(video|audio|clip)/gi, "");
  title = title.replace(/\|?\s*lyric\s*video/gi, "");
  title = title.replace(/\s+/g, " ").trim();
  return title || rawTitle;
}

const musicSearchService = {
  async search(query, limit = 5) {
    try {
      const cleanQ = query.trim();

      // 1. Birinchi musiqiy qidiruv ("music", "audio" qo'shilgan holda)
      let results = [];
      const searchPromises = [
        ytSearch(`${cleanQ} music`),
        ytSearch(`${cleanQ} audio`),
        ytSearch(cleanQ),
      ];

      const searchResponses = await Promise.allSettled(searchPromises);
      
      const allVideos = [];
      const seenIds = new Set();

      for (const res of searchResponses) {
        if (res.status === "fulfilled" && res.value && res.value.videos) {
          for (const v of res.value.videos) {
            if (!seenIds.has(v.videoId)) {
              seenIds.add(v.videoId);
              allVideos.push(v);
            }
          }
        }
      }

      // 2. Faqat haqiqiy musiqalarni saralash
      const musicVideos = allVideos.filter((v) => {
        const title = v.title || "";
        // Darslik, aviatsiya, yangiliklar kabi musiqaga aloqasi yo'q videolarni chiqarib tashlash
        const isNonMusic = NON_MUSIC_PATTERNS.some((pattern) => pattern.test(title));
        if (isNonMusic) return false;

        // Qo'shiqlar odatda 1 daqiqadan 10 daqiqagacha bo'ladi
        const sec = v.seconds || 0;
        if (sec > 660 || (sec < 45 && sec > 0)) {
          return false;
        }

        return true;
      });

      // Agar saralangan musiqalar topilsa ularni olamiz, bo'lmasa oddiy natijalardan olamiz
      const finalVideos = musicVideos.length > 0 ? musicVideos : allVideos;

      return finalVideos.slice(0, limit).map((v) => {
        const cleanedTitle = cleanMusicTitle(v.title);
        return {
          id: v.videoId,
          title: cleanedTitle,
          rawTitle: v.title,
          url: v.url,
          duration: v.timestamp || "0:00",
          seconds: v.seconds || 0,
          author: v.author ? v.author.name : "Noma'lum ijrochi",
          views: v.views ? formatViews(v.views) : "",
          thumbnail: v.thumbnail,
        };
      });
    } catch (err) {
      console.error("Musiqa qidiruvida xatolik:", err);
      return [];
    }
  },
};

function formatViews(views) {
  if (views >= 1_000_000) {
    return (views / 1_000_000).toFixed(1) + "M";
  }
  if (views >= 1_000) {
    return (views / 1_000).toFixed(0) + "K";
  }
  return String(views);
}

module.exports = musicSearchService;
