/**
 * Quick browser test: verify quick note → arrangement creation flow.
 * Usage: node scripts/test-arrange-from-quicknote.mjs
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:5173/";

async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  console.log("[OK] Page loaded");

  // Type quick note: "明天晚上 7 点和教员吃饭"
  const input = page.locator('textarea, input[type="text"]').first();
  await input.waitFor({ timeout: 5000 });
  await input.fill("明天晚上 7 点和教员吃饭");
  console.log("[OK] Filled quick note 1");

  // Submit – look for the send button
  const sendBtn = page.locator('button[aria-label*="发送"], button[aria-label*="send"], button[type="submit"]').first();
  await sendBtn.click();
  console.log("[OK] Submitted quick note 1");

  // Wait for toast
  await page.waitForTimeout(1000);
  const toastText = await page.locator("text=已识别为安排").textContent().catch(() => null);
  console.log("[TOAST]", toastText || "NOT FOUND");

  // Navigate to Arrange tab
  const arrangeTab = page.locator('text=安排').first();
  await arrangeTab.click();
  await page.waitForTimeout(500);
  console.log("[OK] Navigated to Arrange tab");

  // Check if the item appears
  const item1 = await page.locator("text=和教员吃饭").count();
  console.log(`[CHECK] "和教员吃饭" found: ${item1 > 0 ? "YES" : "NO"} (count: ${item1})`);

  // Go back to records
  const recordsTab = page.locator('text=快记').first();
  await recordsTab.click();
  await page.waitForTimeout(500);

  // Second test: "明天下午 3 点去医院"
  const input2 = page.locator('textarea, input[type="text"]').first();
  await input2.fill("明天下午 3 点去医院");
  console.log("[OK] Filled quick note 2");
  await sendBtn.click();
  console.log("[OK] Submitted quick note 2");
  await page.waitForTimeout(1000);

  const toastText2 = await page.locator("text=已识别为安排").textContent().catch(() => null);
  console.log("[TOAST2]", toastText2 || "NOT FOUND");

  // Navigate back to Arrange
  await arrangeTab.click();
  await page.waitForTimeout(500);

  const item2 = await page.locator("text=去医院").count();
  console.log(`[CHECK] "去医院" found: ${item2 > 0 ? "YES" : "NO"} (count: ${item2})`);

  // Take screenshot for verification
  await page.screenshot({ path: "scripts/test-arrange-result.png", fullPage: true });
  console.log("[OK] Screenshot saved to scripts/test-arrange-result.png");

  console.log("\n=== RESULTS ===");
  console.log(`Test 1 ("明天晚上 7 点和教员吃饭"): ${item1 > 0 ? "PASS" : "FAIL"}`);
  console.log(`Test 2 ("明天下午 3 点去医院"): ${item2 > 0 ? "PASS" : "FAIL"}`);

  await browser.close();
}

run().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
