/**
 * 页面视觉与运行状态检查（截图存 docs/screenshots）
 * 运行前需先启动服务：npm start
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:5178';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[web console] ' + m.text()); });
  page.on('pageerror', (e) => errors.push('[web error] ' + e.message));

  await page.goto(BASE + '/web/', { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push('[goto] ' + e.message));
  await sleep(3500);
  await page.screenshot({ path: path.join(OUT, 'web-01-overview.png') });

  // 村户一张图
  await page.click('[data-page="households"]');
  await sleep(1500);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#hhMap img.leaflet-tile')];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 25000 }).catch(() => {});
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, 'web-02-households.png') });

  // 搜索并打开详情
  await page.fill('#hhSearch', 'A-023');
  await page.press('#hhSearch', 'Enter');
  await sleep(2500);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('#hhMap img.leaflet-tile')];
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 25000 }).catch(() => {});
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'web-03-household-detail.png') });

  // 完整台账（管理员）
  await page.click('#viewFull');
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, 'web-04-full-profile.png') });

  // 切换网格员再看
  await page.click('#roleSwitch button[data-role="grid"]');
  await sleep(600);
  await page.click('#viewFull').catch(() => {});
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'web-05-permission-denied.png') });
  await page.click('#roleSwitch button[data-role="admin"]');
  await sleep(400);

  // 政策问答
  await page.click('[data-page="qa"]');
  await sleep(600);
  await page.fill('#qaInput', '农机购置补贴怎么申请？');
  await page.click('#qaSend');
  await sleep(1400);
  await page.screenshot({ path: path.join(OUT, 'web-06-qa.png') });

  // 数据管理
  await page.click('[data-page="admin"]');
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'web-07-admin.png') });

  // 小程序
  const mctx = await browser.newContext({ viewport: { width: 520, height: 1000 }, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  mp.on('console', (m) => { if (m.type() === 'error') errors.push('[app console] ' + m.text()); });
  mp.on('pageerror', (e) => errors.push('[app error] ' + e.message));
  const tap = async (sel, idx = 0) => {
    await mp.evaluate(([s, i]) => {
      const el = document.querySelectorAll(s)[i];
      if (el) el.click();
    }, [sel, idx]);
    await sleep(650);
  };
  await mp.goto(BASE + '/app/', { waitUntil: 'networkidle', timeout: 60000 }).catch((e) => errors.push('[goto app] ' + e.message));
  await sleep(1500);
  await mp.screenshot({ path: path.join(OUT, 'app-01-home.png') });

  await tap('[data-elder="1"]');
  await sleep(500);
  await mp.screenshot({ path: path.join(OUT, 'app-02-elder.png') });

  await tap('[data-elder="0"]');
  await tap('[data-tab="services"]');
  await sleep(400);
  await mp.screenshot({ path: path.join(OUT, 'app-03-services.png') });

  await tap('[data-go="notices"]');
  await mp.screenshot({ path: path.join(OUT, 'app-08-notices.png') });

  await tap('[data-back]');
  await tap('[data-tab="home"]');
  await tap('[data-go="points"]');
  await sleep(2200);
  await mp.screenshot({ path: path.join(OUT, 'app-04-points.png') });

  await tap('[data-tab="chat"]');
  await tap('[data-ask="农机购置补贴怎么申请？"]');
  await sleep(1600);
  await mp.screenshot({ path: path.join(OUT, 'app-05-chat.png') });

  await tap('[data-answer]');
  await sleep(1200);
  await mp.screenshot({ path: path.join(OUT, 'app-06-answer.png') });

  await tap('[data-fav]');
  await sleep(500);
  await mp.screenshot({ path: path.join(OUT, 'app-07-favorited.png') });

  await tap('[data-tab="me"]');
  await sleep(400);
  await mp.screenshot({ path: path.join(OUT, 'app-09-me.png') });

  await tap('[data-go="favorites"]');
  await sleep(700);
  await mp.screenshot({ path: path.join(OUT, 'app-10-favorites.png') });

  await tap('[data-back]');
  await tap('[data-go="feedback"]');
  await sleep(500);
  await mp.screenshot({ path: path.join(OUT, 'app-11-feedback.png') });

  fs.writeFileSync(path.join(OUT, 'console-errors.log'), errors.join('\n') || 'no console errors', 'utf8');
  console.log('screenshots done, errors:', errors.length);
  if (errors.length) console.log(errors.slice(0, 20).join('\n'));
  await browser.close();
})();
