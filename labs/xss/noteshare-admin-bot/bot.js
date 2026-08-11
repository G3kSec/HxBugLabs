const puppeteer = require("puppeteer-core");

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

/**
 * Logs in as the admin and visits a reported URL — the same "exploit
 * server + admin bot" mechanic PortSwigger's Web Security Academy uses
 * for its XSS labs with real cross-user impact, not just "the payload
 * appears unescaped in the response."
 *
 * If a reported page contains a script that exfiltrates document.cookie
 * to /api/collect, this bot's admin session cookie is what gets stolen —
 * for real, inside a real headless browser, not simulated.
 */
async function visitAsAdmin(baseUrl, targetUrl, adminPassword) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    // Log in exactly like a human would — the bot doesn't get a
    // shortcut, so a bug in the login flow itself would affect it too.
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    await page.type("#username", "admin");
    await page.type("#password", adminPassword);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);

    // Visit whatever URL was reported, as the admin.
    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 10000 });

    // Give any injected script a moment to fire its exfiltration request.
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } finally {
    await browser.close();
  }
}

module.exports = { visitAsAdmin };
