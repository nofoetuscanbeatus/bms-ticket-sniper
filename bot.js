const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = process.env.TICKET_URL?.trim();
const TEST_MODE = process.env.TEST_MODE === "true";

const bot = new TelegramBot(TOKEN, { polling: false });

let notified = false;
const CHECK_INTERVAL = 4000;

let browser;
let page;

async function startBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  page = await browser.newPage();
}

async function sendTestAlert() {
  await bot.sendMessage(CHAT_ID, "✅ Telegram test works!");
  console.log("Test message sent");
}

async function checkTickets() {
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    const content = await page.content();

    const bookingOpen =
      content.includes("Book tickets") ||
      content.includes("Book Now") ||
      content.includes("Select Seats") ||
      content.includes("Available");

    if (bookingOpen && !notified) {
      notified = true;

      await bot.sendMessage(
        CHAT_ID,
        `🚨 BOOKING OPEN!\n\n${URL}`
      );

      console.log("🚨 Alert sent");
    } else {
      console.log("Still waiting...");
    }

  } catch (err) {
    console.log("Error:", err.message);
  }
}

async function run() {

  if (TEST_MODE) {
    await sendTestAlert();
    return;
  }

  if (!URL) {
    console.log("Missing TICKET_URL");
    return;
  }

  await startBrowser();

  console.log("Bot started monitoring...");

  setInterval(checkTickets, CHECK_INTERVAL);
}

run();
