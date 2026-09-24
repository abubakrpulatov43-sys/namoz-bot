const { InlineKeyboard, Keyboard } = require("grammy");
const serviceRepository = require("../database/services");
const carRepository = require("../database/cars");
const requestRepository = require("../database/requests");
const { getMainMenuKeyboard } = require("../keyboards/menu");
const notifier = require("../utils/notifier");
const { formatPhone } = require("../utils/formatters");

// Xizmatlar ro'yxati menyusi
async function handleServicesList(ctx) {
  const services = serviceRepository.getAllActive();

  if (services.length === 0) {
    return ctx.reply("Hozirda faol xizmatlar mavjud emas.");
  }

  let text = `🚗 *Xizmatlar bo'limi*\n\nKerakli xizmatni tanlang:`;

  const inlineKb = new InlineKeyboard();
  services.forEach((s) => {
    inlineKb.text(`${s.icon || "🚗"} ${s.name}`, `srv_select:${s.id}`).row();
  });

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

// Xizmat tanlanganda: Avtomobilni tanlash
async function handleSelectService(ctx, serviceId) {
  if (!ctx.user) return;

  const service = serviceRepository.getById(serviceId);
  if (!service) {
    return ctx.answerCallbackQuery({ text: "Xizmat topilmadi" });
  }

  const cars = carRepository.getByUserId(ctx.user.id);

  const inlineKb = new InlineKeyboard();

  if (cars.length > 0) {
    cars.forEach((car) => {
      inlineKb.text(`🚘 ${car.brand_model} (${car.plate_number})`, `order_car:${service.id}:${car.id}`).row();
    });
  }

  inlineKb.text("➕ Yangi avtomobil qo‘shish", `order_add_car:${service.id}`).row();
  inlineKb.text("❌ Bekor qilish", "order_cancel");

  const messageText =
    `Siz *${service.icon || "🚗"} ${service.name}* xizmatiga so‘rov yubormoqchisiz.\n\n` +
    (service.description ? `ℹ️ _${service.description}_\n\n` : "") +
    `Avtomobilni tanlang:`;

  await ctx.editMessageText(messageText, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

// Yangi avtomobil qo'shib buyurtmaga qaytish
async function handleOrderAddCar(ctx, serviceId) {
  ctx.session.orderingServiceId = serviceId;
  const { startAddCar } = require("./cars");
  return startAddCar(ctx);
}

// Avtomobil tanlanganda: Izoh so'rash
async function startOrderWithCar(ctx, serviceId, carId) {
  ctx.session.step = "ORDER_COMMENT";
  ctx.session.orderServiceId = serviceId;
  ctx.session.orderCarId = carId;

  const skipKb = new Keyboard()
    .text("Izohsiz davom etish")
    .row()
    .text("❌ Bekor qilish")
    .resized();

  await ctx.reply(
    `💬 Xizmat bo'yicha qo'shimcha izohingiz yoki talablaringiz bormi?\n\n` +
    `_(Yozib yuboring yoki "Izohsiz davom etish" tugmasini bosing)_`,
    {
      parse_mode: "Markdown",
      reply_markup: skipKb,
    }
  );
}

// Izohni qabul qilish va tasdiqlash xulosasini ko'rsatish
async function handleOrderCommentStep(ctx) {
  const text = ctx.message?.text?.trim();

  if (text === "❌ Bekor qilish") {
    ctx.clearSession();
    return ctx.reply("So'rov bekor qilindi.", {
      reply_markup: getMainMenuKeyboard(),
    });
  }

  let comment = null;
  if (text && text !== "Izohsiz davom etish") {
    comment = text;
  }
  ctx.session.orderComment = comment;

  const service = serviceRepository.getById(ctx.session.orderServiceId);
  const car = carRepository.getById(ctx.session.orderCarId);

  ctx.session.step = "ORDER_CONFIRM";

  const confirmKb = new Keyboard()
    .text("✅ So‘rov yuborish")
    .row()
    .text("❌ Bekor qilish")
    .resized();

  const summaryText =
    `📋 *So‘rovingiz:*\n\n` +
    `Xizmat: *${service ? service.icon + " " + service.name : "Xizmat"}*\n` +
    `Avtomobil: *${car ? car.brand_model : "-"}*\n` +
    `Davlat raqami: \`${car ? car.plate_number : "-"}\`\n` +
    `Telefon: *${formatPhone(ctx.user.phone)}*\n` +
    `Izoh: _${comment || "Yo'q"}_\n\n` +
    `So‘rovni yuborishni tasdiqlaysizmi?`;

  return ctx.reply(summaryText, {
    parse_mode: "Markdown",
    reply_markup: confirmKb,
  });
}

// So'rovni tasdiqlash va saqlash
async function handleOrderConfirmStep(ctx) {
  const text = ctx.message?.text?.trim();

  if (text === "❌ Bekor qilish") {
    ctx.clearSession();
    return ctx.reply("So'rov bekor qilindi.", {
      reply_markup: getMainMenuKeyboard(),
    });
  }

  if (text === "✅ So‘rov yuborish") {
    const serviceId = ctx.session.orderServiceId;
    const carId = ctx.session.orderCarId;
    const comment = ctx.session.orderComment;

    const newRequest = requestRepository.create({
      user_id: ctx.user.id,
      car_id: carId,
      service_id: serviceId,
      comment: comment,
    });

    ctx.clearSession();

    // Foydalanuvchiga muvaffaqiyatli xabar
    const successMsg =
      `✅ *So‘rovingiz qabul qilindi!*\n\n` +
      `🔢 So‘rov raqami: *#${newRequest.id}*\n\n` +
      `Operatorimiz tez orada siz bilan bog‘lanadi.`;

    await ctx.reply(successMsg, {
      parse_mode: "Markdown",
      reply_markup: getMainMenuKeyboard(),
    });

    // Adminlarga bildirishnoma yuborish
    return notifier.notifyAdminsNewRequest(ctx.api ? { api: ctx.api } : ctx, newRequest);
  }
}

module.exports = {
  handleServicesList,
  handleSelectService,
  handleOrderAddCar,
  startOrderWithCar,
  handleOrderCommentStep,
  handleOrderConfirmStep,
};
