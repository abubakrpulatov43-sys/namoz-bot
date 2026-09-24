const { InlineKeyboard, Keyboard } = require("grammy");

// Admin bosh menyusi
function getAdminMenuKeyboard() {
  return new Keyboard()
    .text("📊 Statistika")
    .text("📥 Yangi so‘rovlar")
    .row()
    .text("🛠 Xizmatlarni boshqarish")
    .text("👥 Foydalanuvchilar")
    .row()
    .text("🔙 Asosiy menyuga qaytish")
    .resized();
}

// Yangi tushgan so'rov uchun inline tugmalar (Requirement 7)
function getRequestAdminKeyboard(reqId, userTelegramId, userUsername) {
  const kb = new InlineKeyboard();

  // Telegram profiliga to'g'ridan-to'g'ri havola yoki profil link
  if (userUsername) {
    kb.url("📞 Mijozga yozish", `https://t.me/${userUsername}`).row();
  } else {
    kb.url("📞 Mijozga yozish", `tg://user?id=${userTelegramId}`).row();
  }

  kb.text("👀 Ko‘rib chiqilmoqda", `adm_st:${reqId}:reviewing`)
    .text("🔄 Jarayonda", `adm_st:${reqId}:in_progress`)
    .row()
    .text("✅ Yakunlandi", `adm_st:${reqId}:completed`)
    .text("❌ Bekor qilish", `adm_st:${reqId}:cancelled`);

  return kb;
}

// Statistika davrlarini tanlash
function getStatsPeriodKeyboard() {
  return new InlineKeyboard()
    .text("Bugungi", "stats_p:daily")
    .text("Haftalik", "stats_p:weekly")
    .text("Oylik", "stats_p:monthly")
    .row()
    .text("Barchasi", "stats_p:all");
}

module.exports = {
  getAdminMenuKeyboard,
  getRequestAdminKeyboard,
  getStatsPeriodKeyboard,
};
