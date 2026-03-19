import { chromium } from "playwright";

const EVENT_URL =
  process.env.EVENT_URL ||
  "https://in.bookmyshow.com/sports/icc-men-s-t20-world-cup-2026-semi-final-2/ET00474271";

const CHECK_INTERVAL = 2000; // faster
const PARALLEL = Number(process.env.PARALLEL_SESSIONS || 3);
const TICKETS = Number(process.env.TICKETS || 2);

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

// 🔍 Find 2 adjacent seats
async function findSeats(page) {
  const seats = await page.$$("[class*='seat'][class*='available']");

  if (seats.length < TICKETS) return null;

  const positions = [];

  for (const seat of seats) {
    const box = await seat.boundingBox();
    if (box) {
      positions.push({ seat, x: box.x, y: box.y });
    }
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

async function bookingWorker(id, context) {
  const page = await context.newPage();

  console.log(`🚀 Worker ${id} ready`);

  while (true) {
    try {
      await page.goto(EVENT_URL);

      await page.click("text=Book Tickets", { timeout: 3000 }).catch(() => {});

      await page.waitForTimeout(1500);

      // 🔁 retry seat selection loop
      for (let attempt = 1; attempt <= 10; attempt++) {
        const seats = await findSeats(page);

        if (seats) {
          for (const s of seats) await s.click();

          await page.click("text=Proceed").catch(() => {});
          await page.click("text=Pay").catch(() => {});

          await sendTelegram(
            `🔥 SUCCESS: Worker ${id} got 2 seats! Complete payment NOW`
          );

          console.log("🎯 Seats locked!");
          process.exit(0);
        }

        // refresh seat map
        await page.reload({ waitUntil: "domcontentloaded" });
      }

      console.log(`Worker ${id} retrying...`);
    } catch (err) {
      console.log(`Worker ${id} error`, err.message);
    }
  }
}

async function monitor(context) {
  const page = await context.newPage();

  console.log("👀 Monitoring started...");

  while (true) {
    try {
      await page.goto(EVENT_URL);

      const html = await page.content();

      if (html.includes("Book Tickets")) {
        console.log("🚨 SALE LIVE");

        await sendTelegram("🚨 Tickets are LIVE. Sniping started!");

        for (let i = 1; i <= PARALLEL; i++) {
          bookingWorker(i, context);
        }

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

  // 🔥 shared context = faster sessions
  const context = await browser.newContext();

  await monitor(context);
})();
