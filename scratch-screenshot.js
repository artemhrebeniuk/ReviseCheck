const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000); // wait for initial render
  
  // Take screenshot of the initial hero view
  await page.screenshot({ path: 'public/screenshots/hero.png' });
  console.log('Saved hero.png');
  
  // Click the first benchmark preset
  await page.click('text=Benchmark Suites');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Standard Revision")');
  await page.waitForTimeout(500);
  
  // Click Run Evaluation Suite
  await page.click('button:has-text("Run Assessment")');
  
  // Wait for the audit to finish rendering
  await page.waitForSelector('text=REJECT', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000); // give it time to render graphs and PDFs
  
  // Scroll down slightly to show the diff matrix
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1000);
  
  // Take screenshot of the dashboard
  await page.screenshot({ path: 'public/screenshots/dashboard.png' });
  console.log('Saved dashboard.png');

  await browser.close();
})();
