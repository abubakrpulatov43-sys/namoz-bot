const userRepository = require("../database/users");
const prayerService = require("./prayerService");

let lastSentMinute = "";
let lastMorningDate = "";

function startPrayerReminder(bot) {
  // Har 30 soniyada vaqtni tekshirib turadi
  setInterval(async () => {
    try {
      const now = new Date();
      // O'zbekiston vaqti (Toshkent vaqti, UTC+5)
      const uzDate = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60000);
      const hours = String(uzDate.getHours()).padStart(2, "0");
      const minutes = String(uzDate.getMinutes()).padStart(2, "0");
      const currentHM = `${hours}:${minutes}`;
      const todayDateStr = uzDate.toISOString().split("T")[0];

      if (currentHM === lastSentMinute) return;
      lastSentMinute = currentHM;

      const users = userRepository.getUsersForNotifications();
      if (!users || users.length === 0) return;

      // Hududlar bo'yicha guruhlash
      const regionGroups = new Map();
      for (const u of users) {
        const key = u.selected_region || "Toshkent";
        if (!regionGroups.has(key)) {
          regionGroups.set(key, []);
        }
        regionGroups.get(key).push({
          telegramId: u.telegram_id,
          lat: u.latitude,
          lng: u.longitude,
        });
      }

      // ========================================================
      // 1. ERTALABKI SOAT 05:00 DA AVTOMATIK BUGUNGI MA'LUMOTNI YUBORISH
      // ========================================================
      if (currentHM === "05:00" && lastMorningDate !== todayDateStr) {
        lastMorningDate = todayDateStr;
        console.log(`🌅 05:00 Ertalabki namoz jadvali yuborilmoqda (${todayDateStr})...`);

        for (const [regionKey, userList] of regionGroups.entries()) {
          const sample = userList[0];
          const data = await prayerService.getPrayerTimes(regionKey, sample.lat, sample.lng);
          const regionInfo = prayerService.REGIONS[regionKey] || { name: regionKey };

          const morningMessage =
            `🌅 <b>Assalomu alaykum va rahmatullohi va barakotuh!</b>\n\n` +
            `🗓 <b>Bugungi namoz vaqtlari (${regionInfo.name}):</b>\n\n` +
            prayerService.formatPrayerMessage(regionInfo.name, data) +
            `\n\n🤲 <i>Kuningiz xayrli, tinch va barakotli o'tsin!</i>`;

          for (const u of userList) {
            try {
              await bot.api.sendMessage(u.telegramId, morningMessage, { parse_mode: "HTML" });
            } catch (err) {
              // Foydalanuvchi botni bloklagan bo'lishi mumkin
            }
          }
        }
      }

      // ========================================================
      // 2. HAR BIR NAMOZ VAQTI KIRGANDA BILDIRISHNOMA (AZON ESLATMASI)
      // ========================================================
      for (const [regionKey, userList] of regionGroups.entries()) {
        const sample = userList[0];
        const data = await prayerService.getPrayerTimes(regionKey, sample.lat, sample.lng);
        const timings = data.timings;

        let prayerName = null;
        if (timings.fajr === currentHM) prayerName = "Bomdod";
        else if (timings.dhuhr === currentHM) prayerName = "Peshin";
        else if (timings.asr === currentHM) prayerName = "Asr";
        else if (timings.maghrib === currentHM) prayerName = "Shom";
        else if (timings.isha === currentHM) prayerName = "Xufton";

        if (prayerName) {
          const regionInfo = prayerService.REGIONS[regionKey] || { name: regionKey };
          const alertMessage =
            `📢 <b>Namoz vaqti kirdi!</b>\n\n` +
            `🕌 <b>${regionInfo.name}</b>\n` +
            `🕋 <b>${prayerName}</b> namozi vaqti bo'ldi (<code>${currentHM}</code>).\n\n` +
            `«Albatta, namoz mo‘minlarga vaqtida farz qilingandir» <i>(Niso surasi, 103-oyat)</i>`;

          for (const u of userList) {
            try {
              await bot.api.sendMessage(u.telegramId, alertMessage, { parse_mode: "HTML" });
            } catch (err) {}
          }
        }
      }
    } catch (e) {
      console.error("Prayer reminder error:", e.message);
    }
  }, 30000);
}

module.exports = { startPrayerReminder };
