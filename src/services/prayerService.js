const db = require("../database/db");

const UZBEKISTAN_REGIONS = {
  Toshkent: { name: "Toshkent shahri", city: "Tashkent", lat: 41.2995, lng: 69.2401 },
  Samarqand: { name: "Samarqand viloyati", city: "Samarkand", lat: 39.6542, lng: 66.9597 },
  Buxoro: { name: "Buxoro viloyati", city: "Bukhara", lat: 39.7747, lng: 64.4286 },
  Andijon: { name: "Andijon viloyati", city: "Andijan", lat: 40.7821, lng: 72.3442 },
  Fargona: { name: "Farg'ona viloyati", city: "Fergana", lat: 40.3842, lng: 71.7843 },
  Namangan: { name: "Namangan viloyati", city: "Namangan", lat: 40.9983, lng: 71.6726 },
  Qarshi: { name: "Qashqadaryo (Qarshi)", city: "Qarshi", lat: 38.8606, lng: 65.7891 },
  Termiz: { name: "Surxondaryo (Termiz)", city: "Termez", lat: 37.2242, lng: 67.2783 },
  Urganch: { name: "Xorazm (Urganch)", city: "Urganch", lat: 41.5504, lng: 60.6315 },
  Nukus: { name: "Qoraqalpog'iston (Nukus)", city: "Nukus", lat: 42.4602, lng: 59.6166 },
  Navoiy: { name: "Navoiy viloyati", city: "Navoiy", lat: 40.0844, lng: 65.3792 },
  Jizzax: { name: "Jizzax viloyati", city: "Jizzakh", lat: 40.1158, lng: 67.8422 },
  Guliston: { name: "Sirdaryo (Guliston)", city: "Guliston", lat: 40.4897, lng: 68.7842 },
  Xiva: { name: "Xiva shahri", city: "Khiva", lat: 41.3783, lng: 60.3639 },
};

function getTodayDateString(offsetDays = 0) {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  // YYYY-MM-DD
  return d.toISOString().split("T")[0];
}

const prayerService = {
  REGIONS: UZBEKISTAN_REGIONS,

  findNearestRegion(lat, lng) {
    let nearestKey = "Toshkent";
    let minDistance = Infinity;

    for (const [key, reg] of Object.entries(UZBEKISTAN_REGIONS)) {
      const d = Math.hypot(reg.lat - lat, reg.lng - lng);
      if (d < minDistance) {
        minDistance = d;
        nearestKey = key;
      }
    }
    return nearestKey;
  },

  async getPrayerTimes(regionKey = "Toshkent", lat = null, lng = null, dateStr = null) {
    const today = dateStr || getTodayDateString();
    const regionInfo = UZBEKISTAN_REGIONS[regionKey] || UZBEKISTAN_REGIONS["Toshkent"];
    const targetLat = lat !== null ? lat : regionInfo.lat;
    const targetLng = lng !== null ? lng : regionInfo.lng;
    const cacheKey = lat !== null && lng !== null ? `loc_${targetLat.toFixed(2)}_${targetLng.toFixed(2)}` : regionKey;

    // 1. Keshni tekshirish
    try {
      const cached = db.prepare("SELECT * FROM prayer_cache WHERE region_key = ? AND date_str = ?").get(cacheKey, today);
      if (cached) {
        return {
          regionName: regionInfo.name,
          dateStr: today,
          hijriDate: cached.hijri_date,
          timings: {
            fajr: cached.fajr,
            sunrise: cached.sunrise,
            dhuhr: cached.dhuhr,
            asr: cached.asr,
            maghrib: cached.maghrib,
            isha: cached.isha,
          },
        };
      }
    } catch (e) {
      console.error("Prayer cache read error:", e.message);
    }

    // 2. Aladhan API dan olish (Hanafi, Method 3 = Muslim World League)
    try {
      const url = `https://api.aladhan.com/v1/timings/${today}?latitude=${targetLat}&longitude=${targetLng}&method=3&school=1`;
      const res = await fetch(url, { headers: { "User-Agent": "TelegramPrayerBot/1.0" } });
      const data = await res.json();

      if (data && data.code === 200 && data.data) {
        const timings = data.data.timings;
        const hijri = data.data.date?.hijri;
        const hijriStr = hijri ? `${hijri.day}-${hijri.month?.en || ""} ${hijri.year}` : "";

        const cleanTimings = {
          fajr: timings.Fajr.slice(0, 5),
          sunrise: timings.Sunrise.slice(0, 5),
          dhuhr: timings.Dhuhr.slice(0, 5),
          asr: timings.Asr.slice(0, 5),
          maghrib: timings.Maghrib.slice(0, 5),
          isha: timings.Isha.slice(0, 5),
        };

        // Keshga saqlash
        try {
          db.prepare(`
            INSERT OR REPLACE INTO prayer_cache (region_key, date_str, fajr, sunrise, dhuhr, asr, maghrib, isha, hijri_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(cacheKey, today, cleanTimings.fajr, cleanTimings.sunrise, cleanTimings.dhuhr, cleanTimings.asr, cleanTimings.maghrib, cleanTimings.isha, hijriStr);
        } catch (e) {}

        return {
          regionName: regionInfo.name,
          dateStr: today,
          hijriDate: hijriStr,
          timings: cleanTimings,
        };
      }
    } catch (err) {
      console.error("Prayer fetch error:", err.message);
    }

    // Zaxira: Toshkent taxminiy vaqtlari
    return {
      regionName: regionInfo.name,
      dateStr: today,
      hijriDate: "1448",
      timings: {
        fajr: "05:00",
        sunrise: "06:30",
        dhuhr: "12:10",
        asr: "16:05",
        maghrib: "17:45",
        isha: "19:15",
      },
    };
  },

  getNextPrayer(timings) {
    const now = new Date();
    // O'zbekiston vaqti (UTC+5)
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 300;
    const currentMinutes = utcMinutes % 1440;

    const parseMinutes = (timeStr) => {
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const prayerOrder = [
      { key: "fajr", name: "Bomdod", minutes: parseMinutes(timings.fajr) },
      { key: "sunrise", name: "Quyosh", minutes: parseMinutes(timings.sunrise) },
      { key: "dhuhr", name: "Peshin", minutes: parseMinutes(timings.dhuhr) },
      { key: "asr", name: "Asr", minutes: parseMinutes(timings.asr) },
      { key: "maghrib", name: "Shom", minutes: parseMinutes(timings.maghrib) },
      { key: "isha", name: "Xufton", minutes: parseMinutes(timings.isha) },
    ];

    for (const prayer of prayerOrder) {
      if (prayer.minutes > currentMinutes) {
        const diff = prayer.minutes - currentMinutes;
        const diffHours = Math.floor(diff / 60);
        const diffMins = diff % 60;
        let diffStr = "";
        if (diffHours > 0) diffStr += `${diffHours} soat `;
        diffStr += `${diffMins} daqiqa`;
        return { name: prayer.name, time: timings[prayer.key], remaining: diffStr };
      }
    }

    // Agar Xuftondan keyin bo'lsa, keyingi namoz ertangi Bomdod
    const bomdodMinutes = parseMinutes(timings.fajr) + 1440;
    const diff = bomdodMinutes - currentMinutes;
    const diffHours = Math.floor(diff / 60);
    const diffMins = diff % 60;
    let diffStr = "";
    if (diffHours > 0) diffStr += `${diffHours} soat `;
    diffStr += `${diffMins} daqiqa`;
    return { name: "Bomdod (ertaga)", time: timings.fajr, remaining: diffStr };
  },

  formatPrayerMessage(regionName, prayerData) {
    const { timings, dateStr, hijriDate } = prayerData;
    const nextPrayer = this.getNextPrayer(timings);

    // O'zbekcha sana
    const [y, m, d] = dateStr.split("-");
    const monthsUz = [
      "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
      "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"
    ];
    const monthName = monthsUz[parseInt(m, 10) - 1];

    return (
      `🕌 <b>${regionName} uchun namoz vaqtlari</b>\n` +
      `📅 <b>${d}-${monthName}, ${y}</b> | <i>${hijriDate}</i>\n` +
      `────────────────────\n` +
      `🌄 <b>Bomdod:</b>   <code>${timings.fajr}</code>\n` +
      `🌅 <b>Quyosh:</b>   <code>${timings.sunrise}</code>\n` +
      `☀️ <b>Peshin:</b>   <code>${timings.dhuhr}</code>\n` +
      `🌤 <b>Asr:</b>      <code>${timings.asr}</code>\n` +
      `🌇 <b>Shom:</b>     <code>${timings.maghrib}</code>\n` +
      `🌌 <b>Xufton:</b>   <code>${timings.isha}</code>\n` +
      `────────────────────\n` +
      `⏳ <b>Keyingi namoz:</b> <b>${nextPrayer.name}</b> (<code>${nextPrayer.time}</code>)\n` +
      `⏱ Qoldi: <i>${nextPrayer.remaining}</i>\n\n` +
      `«Albatta, namoz mo‘minlarga vaqtida farz qilingandir» <i>(Niso, 103)</i>`
    );
  },
};

module.exports = prayerService;
