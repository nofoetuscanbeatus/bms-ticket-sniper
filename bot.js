const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");

// Environment variables
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = process.env.TICKET_URL?.trim();
const TEST_MODE = process.env.TEST_MODE === "true";

const bot = new TelegramBot(TOKEN, { polling: false });

let notified = false;
const WORKERS = 1;
const CHECK_INTERVAL = 2500;

async function sendTestAlert() {
  console.log("Running in TEST MODE");
  await bot.sendMessage(
    CHAT_ID,
    "✅ Bot is working! This is a test notification."
  );
}

async function checkTickets(workerId) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote"
      ]
    });

    const page = await browser.newPage();
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
        `🚨 BOOKING OPEN!\n\nEvent link:\n${URL}`
      );
      console.log(`🚨 Alert sent by worker ${workerId}`);
    } else {
      console.log(`Worker ${workerId}: still waiting...`);
    }

  } catch (err) {
    console.log(`Worker ${workerId} error:`, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function runWorkers() {
  if (TEST_MODE) {
    await sendTestAlert();
    return;
  }

  console.log(`Starting V2 notifier with ${WORKERS} worker(s)`);

  setInterval(() => {
    for (let i = 1; i <= WORKERS; i++) {
      checkTickets(i);
    }
  }, CHECK_INTERVAL);
}

runWorkers();
