const userRepository = require("../database/users");
const adminRepository = require("../database/admins");

function authMiddleware() {
  return async (ctx, next) => {
    if (!ctx.from) return next();

    const telegramId = ctx.from.id;
    ctx.user = userRepository.getByTelegramId(telegramId);
    ctx.isAdmin = adminRepository.isAdmin(telegramId);

    return next();
  };
}

module.exports = { authMiddleware };
