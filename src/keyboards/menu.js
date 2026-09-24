const { Keyboard, InlineKeyboard } = require("grammy");

// Asosiy Reply klaviatura
function getMainMenuKeyboard() {
  return new Keyboard()
    .text("🚗 Xizmatlar")
    .row()
    .text("🚘 Mening avtomobillarim")
    .text("📦 Mening so‘rovlarim")
    .row()
    .text("👤 Profil")
    .text("☎️ Yordam")
    .resized();
}

// Ro'yxatdan o'tishda telefon raqamini yuborish tugmasi
function getContactKeyboard() {
  return new Keyboard()
    .requestContact("📱 Telefon raqamni yuborish")
    .resized()
    .oneTime();
}

// Bekor qilish tugmasi
function getCancelKeyboard(cancelText = "❌ Bekor qilish") {
  return new Keyboard()
    .text(cancelText)
    .resized()
    .oneTime();
}

module.exports = {
  getMainMenuKeyboard,
  getContactKeyboard,
  getCancelKeyboard,
};
