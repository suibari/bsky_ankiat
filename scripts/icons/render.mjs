import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [dir, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const size of [32, 180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  const svg = readFileSync(`${dir}/favicon.svg`, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.waitForTimeout(100);
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  await page.screenshot({ path: `${out}/${name}`, omitBackground: true });
}
// OGP 画像（og.html は同じディレクトリの favicon.svg を参照する）
await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(`file://${dir}/og.html`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/og.png` });
await browser.close();
