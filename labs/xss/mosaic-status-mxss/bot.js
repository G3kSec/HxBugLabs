const puppeteer = require("puppeteer-core");

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

/**
 * Signs in as the on-call engineer in a real headless browser and opens
 * the reported incident page — the "exploit server + admin bot" mechanic
 * from PortSwigger's Web Security Academy, so a payload has genuine
 * cross-user impact instead of just appearing unescaped in a response.
 *
 * The bot gets no shortcuts: it types into the same login form a human
 * would, and it renders the page under the same CSP everyone else gets.
 * If a comment on that page runs script, it runs inside a session holding
 * the engineer role.
 */
async function visitAsOncall(baseUrl, targetUrl, oncallPassword) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle0" });
    await page.type("#username", "oncall");
    await page.type("#password", oncallPassword);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle0" }),
      page.click('button[type="submit"]'),
    ]);

    await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 15000 });

    // Give anything injected a moment to finish its own requests.
    await new Promise((resolve) => setTimeout(resolve, 2500));
  } finally {
    await browser.close();
  }
}

module.exports = { visitAsOncall };
