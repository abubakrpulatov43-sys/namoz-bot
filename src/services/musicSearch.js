const ytSearch = require("yt-search");

const musicSearchService = {
  async search(query, limit = 6) {
    try {
      const r = await ytSearch(query);
      const videos = r.videos || [];
      return videos.slice(0, limit).map((v) => ({
        id: v.videoId,
        title: v.title,
        url: v.url,
        duration: v.timestamp || "0:00",
        seconds: v.seconds || 0,
        author: v.author ? v.author.name : "Noma'lum",
        views: v.views ? formatViews(v.views) : "",
        thumbnail: v.thumbnail,
      }));
    } catch (err) {
      console.error("Qidiruvda xatolik:", err);
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
