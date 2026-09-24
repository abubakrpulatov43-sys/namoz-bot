const { Shazam } = require("node-shazam");
const fs = require("fs");

const shazam = new Shazam();

const shazamService = {
  async recognize(filePath) {
    if (!fs.existsSync(filePath)) return null;

    try {
      const result = await shazam.fromFilePath(filePath);
      if (result && result.track) {
        return {
          title: result.track.title,
          artist: result.track.subtitle || "Noma'lum ijrochi",
          fullQuery: `${result.track.subtitle || ""} - ${result.track.title}`.trim(),
          coverArt: result.track.images?.coverart || null,
        };
      }
      return null;
    } catch (err) {
      console.error("Shazam recognition error:", err.message);
      return null;
    }
  },
};

module.exports = shazamService;
