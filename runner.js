const { spawn } = require("child_process");
const path = require("path");

function startBot() {
  console.log("🚀 [Supervisor] Bot ishga tushirilmoqda...");

  const child = spawn("node", ["index.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", (code, signal) => {
    console.warn(`⚠️ [Supervisor] Bot to'xtadi (kod: ${code}, signal: ${signal}). 3 soniyadan so'ng qayta ishga tushiriladi...`);
    setTimeout(startBot, 3000);
  });

  child.on("error", (err) => {
    console.error("❌ [Supervisor] Botda xatolik:", err.message);
    setTimeout(startBot, 3000);
  });
}

// Boshlash
startBot();
