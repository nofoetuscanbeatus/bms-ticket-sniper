const puppeteer = require("puppeteer");
const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = process.env.TICKET_URL;

const bot = new TelegramBot(TOKEN, { polling: false });

let notified = false;
const WORKERS = 1; // Number of parallel watchers

async function checkTickets(workerId) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
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
  console.log(`Starting V2 notifier with ${WORKERS} workers`);
  setInterval(() => {
    for (let i = 1; i <= WORKERS; i++) {
      checkTickets(i);
    }
  }, 5000); // check every 8 seconds
}

runWorkers();
if (!URL || !URL.startsWith("http")) {
  console.error("Error: TICKET_URL is missing or invalid:", URL);
  process.exit(1);
}
const WORKERS = 1; // instead of 3
