const { InlineKeyboard, Keyboard } = require("grammy");
const carRepository = require("../database/cars");
const { getMainMenuKeyboard } = require("../keyboards/menu");

// Mening avtomobillarim bo'limi
async function handleMyCars(ctx) {
  if (!ctx.user) return;

  const cars = carRepository.getByUserId(ctx.user.id);

  let message = `🚘 *Mening avtomobillarim*\n\n`;

  if (cars.length === 0) {
    message += `Sizda hali saqlangan avtomobillar mavjud emas.\n` +
      `Quyidagi tugma orqali avtomobilingizni qo'shishingiz mumkin:`;
  } else {
    cars.forEach((car, index) => {
      message += `${index + 1}. *${car.brand_model}*\n` +
        `   🔢 Davlat raqami: \`${car.plate_number}\`\n`;
      if (car.note) {
        message += `   📝 Izoh: ${car.note}\n`;
      }
      message += `\n`;
    });
  }

  const inlineKb = new InlineKeyboard()
    .text("➕ Avtomobil qo‘shish", "car_add");

  if (cars.length > 0) {
    inlineKb.row().text("🗑 Avtomobilni o‘chirish", "car_delete_list");
  }

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: inlineKb,
  });
}

// Avtomobil qo'shish jarayonini boshlash
async function startAddCar(ctx) {
  ctx.session.step = "CAR_ADD_MODEL";

  const cancelKb = new Keyboard()
    .text("❌ Bekor qilish")
    .resized();

  await ctx.reply(
    `🚘 *Yangi avtomobil qo'shish*\n\n` +
    `Avtomobilingiz marka va modelini kiriting:\n` +
    `_(Masalan: Chevrolet Cobalt, Tracker, BYD Song Plus)_`,
    {
      parse_mode: "Markdown",
      reply_markup: cancelKb,
    }
  );
}

// Avtomobil qo'shish bosqichlari
async function handleCarStep(ctx) {
  const step = ctx.session.step;
  const text = ctx.message?.text?.trim();

  if (text === "❌ Bekor qilish") {
    ctx.clearSession();
    return ctx.reply("Avtomobil qo'shish bekor qilindi.", {
      reply_markup: getMainMenuKeyboard(),
    });
  }

  // 1-qadam: Model
  if (step === "CAR_ADD_MODEL") {
    if (!text || text.length < 2) {
      return ctx.reply("⚠️ Iltimos, avtomobil modelini to'g'ri kiriting:");
    }

    ctx.session.carModel = text;
    ctx.session.step = "CAR_ADD_PLATE";

    return ctx.reply(
      `Marka/Model: *${text}*\n\n` +
      `🔢 Endi avtomobilning davlat raqamini kiriting:\n` +
      `_(Masalan: \`01 A 123 BC\` yoki \`10 777 AAA\`)_`,
      { parse_mode: "Markdown" }
    );
  }

  // 2-qadam: Davlat raqami
  if (step === "CAR_ADD_PLATE") {
    if (!text || text.length < 4) {
      return ctx.reply("⚠️ Iltimos, davlat raqamini to'g'ri kiriting (masalan: `01 A 123 BC`):", {
        parse_mode: "Markdown",
      });
    }

    const cleanPlate = text.toUpperCase();
    ctx.session.carPlate = cleanPlate;
    ctx.session.step = "CAR_ADD_NOTE";

    const skipKb = new Keyboard()
      .text("O'tkazib yuborish")
      .row()
      .text("❌ Bekor qilish")
      .resized();

    return ctx.reply(
      `Davlat raqami: *${cleanPlate}*\n\n` +
      `📝 Qo'shimcha izoh kiriting (masalan: rangi, yili yoki bo'sh qoldirish uchun "O'tkazib yuborish" tugmasini bosing):`,
      {
        parse_mode: "Markdown",
        reply_markup: skipKb,
      }
    );
  }

  // 3-qadam: Qo'shimcha izoh va bazaga saqlash
  if (step === "CAR_ADD_NOTE") {
    let note = null;
    if (text !== "O'tkazib yuborish") {
      note = text;
    }

    const newCar = carRepository.create({
      user_id: ctx.user.id,
      brand_model: ctx.session.carModel,
      plate_number: ctx.session.carPlate,
      note: note,
    });

    const isInsideOrder = ctx.session.orderingServiceId;
    const serviceId = ctx.session.orderingServiceId;

    ctx.clearSession();

    await ctx.reply(
      `✅ *Avtomobil muvaffaqiyatli saqlandi!*\n\n` +
      `🚘 *Model:* ${newCar.brand_model}\n` +
      `🔢 *Raqam:* ${newCar.plate_number}` +
      (newCar.note ? `\n📝 *Izoh:* ${newCar.note}` : ""),
      {
        parse_mode: "Markdown",
        reply_markup: getMainMenuKeyboard(),
      }
    );

    // Agar foydalanuvchi buyurtma berish jarayonida avtomobil qo'shgan bo'lsa, buyurtmaga qaytarish
    if (isInsideOrder) {
      const { startOrderWithCar } = require("./services");
      return startOrderWithCar(ctx, serviceId, newCar.id);
    }
  }
}

// Avtomobilni o'chirish menyusi (Inline tugmalar)
async function handleCarDeleteList(ctx) {
  if (!ctx.user) return;

  const cars = carRepository.getByUserId(ctx.user.id);
  if (cars.length === 0) {
    return ctx.reply("Sizda o'chirish uchun avtomobil yo'q.");
  }

  const inlineKb = new InlineKeyboard();
  cars.forEach((car) => {
    inlineKb.text(`🗑 ${car.brand_model} (${car.plate_number})`, `car_del_${car.id}`).row();
  });
  inlineKb.text("🔙 Orqaga", "car_back");

  await ctx.editMessageText("O'chirmoqchi bo'lgan avtomobilingizni tanlang:", {
    reply_markup: inlineKb,
  });
}

// Avtomobilni o'chirish harakati
async function handleCarDelete(ctx, carId) {
  if (!ctx.user) return;

  carRepository.delete(carId, ctx.user.id);
  await ctx.answerCallbackQuery({ text: "Avtomobil o'chirildi" });

  const cars = carRepository.getByUserId(ctx.user.id);
  if (cars.length === 0) {
    return ctx.editMessageText("Barcha avtomobillar o'chirildi.", {
      reply_markup: new InlineKeyboard().text("➕ Avtomobil qo‘shish", "car_add"),
    });
  }

  // Ro'yxatni yangilash
  return handleCarDeleteList(ctx);
}

module.exports = {
  handleMyCars,
  startAddCar,
  handleCarStep,
  handleCarDeleteList,
  handleCarDelete,
};
