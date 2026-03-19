import { chromium } from "playwright";

const EVENT_URL =
  process.env.EVENT_URL ||
  "https://in.bookmyshow.com/sports/icc-men-s-t20-world-cup-2026-semi-final-2/ET00474271";

const CHECK_INTERVAL = 2000;
const PARALLEL_CONTEXTS = 3; // simulate multiple users
const TICKETS = 2;

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(msg) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;

  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: msg
    })
  }).catch(() => {});
}

// 🔍 smarter seat detection
async function findAdjacentSeats(page) {
  const seats = await page.$$("[class*='seat'][class*='available']");

  if (seats.length < TICKETS) return null;

  const positions = [];

  for (const seat of seats) {
    const box = await seat.boundingBox();
    if (box) positions.push({ seat, x: box.x, y: box.y });
  }

  positions.sort((a, b) => a.y - b.y || a.x - b.x);

  for (let i = 0; i < positions.length - 1; i++) {
    const s1 = positions[i];
    const s2 = positions[i + 1];

    if (
      Math.abs(s1.y - s2.y) < 5 &&
      Math.abs(s1.x - s2.x) < 60
    ) {
      return [s1.seat, s2.seat];
    }
  }

  return null;
}

// 🎯 main sniper loop
async function sniperWorker(id, context) {
  const page = await context.newPage();

  console.log(`🚀 Context ${id} ready`);

  while (true) {
    try {
      await page.goto(EVENT_URL);

      await page.click("text=Book Tickets", { timeout: 3000 }).catch(() => {});

      await page.waitForTimeout(1200);

      for (let attempt = 1; attempt <= 15; attempt++) {
        const seats = await findAdjacentSeats(page);

        if (seats) {
          for (const s of seats) await s.click();

          await page.click("text=Proceed").catch(() => {});
          await page.click("text=Pay").catch(() => {});

          await sendTelegram(
            `🔥 SUCCESS: Context ${id} got seats! Complete payment NOW`
          );

          console.log("🎯 Seats locked!");
          process.exit(0);
        }

        // 🔁 aggressive refresh
        await page.reload({ waitUntil: "domcontentloaded" });
      }

    } catch (err) {
      console.log(`Context ${id} error`, err.message);
    }
  }
}

// 👀 monitor sale
async function monitor(contexts) {
  const page = await contexts[0].newPage();

  console.log("👀 Monitoring started...");

  while (true) {
    try {
      await page.goto(EVENT_URL);

      const html = await page.content();

      if (html.includes("Book Tickets")) {
        console.log("🚨 SALE LIVE");

        await sendTelegram("🚨 Tickets are LIVE. ULTRA SNIPER ACTIVE.");

        contexts.forEach((ctx, i) => {
          sniperWorker(i + 1, ctx);
        });

        break;
      }
    } catch (err) {
      console.log("Monitor error:", err.message);
    }

    await new Promise((r) => setTimeout(r, CHECK_INTERVAL));
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  const contexts = [];

  // 🔥 create multiple independent sessions
  for (let i = 0; i < PARALLEL_CONTEXTS; i++) {
    const ctx = await browser.newContext();
    contexts.push(ctx);
  }

  await monitor(contexts);
})();
