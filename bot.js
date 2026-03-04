const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TEST_MODE = process.env.TEST_MODE === "true";

if (!TOKEN || !CHAT_ID) {
  console.error("❌ TELEGRAM_BOT_TOKEN or CHAT_ID missing");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: false });

async function sendTestAlert() {
  try {
    await bot.sendMessage(CHAT_ID, "✅ Telegram test works!");
    console.log("Test notification sent successfully");
  } catch (err) {
    console.error("Error sending Telegram message:", err.message);
  }
}

if (TEST_MODE) {
  sendTestAlert();
} else {
  console.log("TEST_MODE is off — no test notification sent");
}
