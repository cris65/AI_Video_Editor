const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => console.log(`[BROWSER ERROR] ${error.message}\n${error.stack}`));
  await page.goto('http://localhost:5175', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
