// Runs in GitHub Actions with isolated Playwright, without modifying package lock.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const modulePath = process.env.RODEX_PLAYWRIGHT_PATH ||
  '/tmp/rodex-browser-tools/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(modulePath).href);
const base = process.env.RODEX_BASE_URL || 'http://127.0.0.1:42687';
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.rodex-human-presence[data-renderer="webgl3d"]').first()
    .waitFor({ timeout: 25000 });
  const canvas = page.locator('.rodex3d-canvas').first();
  await canvas.waitFor();

  async function inspect(label) {
    // Test actual rendered GPU pixels, not merely a DOM canvas placeholder.
    await page.waitForTimeout(850);
    const stats = await canvas.evaluate((el) => new Promise(resolve => {
      // Read before browser composition resets the default WebGL drawing buffer.
      requestAnimationFrame(() => {
      const gl = el.getContext('webgl2');
      if (!gl) { resolve({ webgl: false }); return; }
      const w = el.width, h = el.height;
      const sample = new Uint8Array(4);
      let nonEmpty = 0;
      for (let yi = 1; yi <= 8; yi++) {
        for (let xi = 1; xi <= 8; xi++) {
          gl.readPixels(Math.floor(w * xi / 9), Math.floor(h * yi / 9),
            1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
          if (sample[3] > 12) nonEmpty++;
        }
      }
      const bounds = el.getBoundingClientRect();
      resolve({
        webgl: true, width: w, height: h,
        boxWidth: Math.round(bounds.width), boxHeight: Math.round(bounds.height),
        nonEmpty, error: gl.getError(),
      });
      });
    }));
    assert.equal(stats.webgl, true, label + ': WebGL2 context missing');
    assert.ok(stats.width > 200 && stats.height > 120, label + ': invalid canvas size');
    assert.ok(stats.nonEmpty >= 3, label + ': 3D framebuffer is blank: ' + JSON.stringify(stats));
    assert.equal(stats.error, 0, label + ': GPU error code ' + stats.error);
    console.info('PASS', label, stats);
    return stats;
  }

  await page.screenshot({ path: '/tmp/rodex-3d-desktop.png' });
  await inspect('desktop 1440x900');
  await page.setViewportSize({ width: 390, height: 844 });
  await inspect('phone 390x844');
  await page.screenshot({ path: '/tmp/rodex-3d-phone.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await inspect('phone landscape 844x390');
  await page.setViewportSize({ width: 820, height: 1180 });
  await inspect('tablet 820x1180');

  await page.locator('#rodex-header-workspace-btn').click();
  await page.locator('.rodex-workspace-companion .rodex3d-canvas').waitFor({ timeout: 10000 });
  const compactRendered = await page.locator('.rodex-workspace-companion .rodex3d-canvas')
    .evaluate((el) => {
      const gl = el.getContext('webgl2');
      return Boolean(gl && !gl.isContextLost() && el.width > 40 && el.height > 40);
    });
  assert.ok(compactRendered, '3D workspace companion not active');
  await page.screenshot({ path: '/tmp/rodex-3d-workspace.png' });
  console.info('PASS 3D workspace companion');
  assert.deepEqual(errors.filter(message => /WebGL|shader|cannot read|undefined is not/i.test(message)),
    [], 'Critical browser runtime errors');
  console.info('RODEX 3D rendered browser checks passed');
} finally {
  await browser.close();
}
