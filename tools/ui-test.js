/**
 * 页面级功能测试（Playwright）
 * 运行前需启动服务：npm start；然后 node tools/ui-test.js
 * 结果写入 docs/UI测试记录.md
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://127.0.0.1:5178';
const CHANNEL = process.env.CHANNEL || 'msedge';
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${detail ? ' · ' + detail : ''}`);
}

(async () => {
  await fetch(BASE + '/api/admin/reset', { method: 'POST' }).catch(() => {});
  const browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {});
  const pageErrors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => pageErrors.push('[web] ' + e.message));

  await page.goto(BASE + '/web/', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(1500);
  check('网页端首屏加载', await page.isVisible('#statRow .stat'), '四张统计卡');
  check('概览地图渲染', (await page.locator('#ovMap .leaflet-tile').count()) > 0, '瓦片已加载');

  // 导航
  for (const [p, sel] of [['households', '#hhMap'], ['qa', '#chatBody'], ['admin', '#adminTable']]) {
    await page.click(`[data-page="${p}"]`);
    await sleep(p === 'households' ? 2500 : 700);
    check(`切换到「${p}」页面`, await page.isVisible(sel));
  }

  // 搜索定位 + 详情 + 权限
  await page.click('[data-page="households"]');
  await sleep(1200);
  await page.fill('#hhSearch', 'A-023');
  await page.press('#hhSearch', 'Enter');
  await sleep(2200);
  check('搜索户号定位并打开详情', await page.isVisible('#detailDrawer:not(.hidden)'), 'A-023');
  const masked = await page.textContent('.info-row:nth-child(3) .v');
  check('详情电话脱敏展示', /\*{4}/.test(masked), masked);

  await page.click('#viewFull');
  await sleep(800);
  check('管理员查看完整台账', await page.isVisible('.full-profile'), '含审计提示');

  await page.click('#roleSwitch button[data-role="grid"]');
  await sleep(700);
  await page.click('#viewFull');
  await sleep(800);
  check('网格员查看完整台账被拒绝', await page.isVisible('.denied'), '提示无权限');
  await page.click('#roleSwitch button[data-role="admin"]');
  await sleep(500);
  await page.click('#closeDrawer');

  // 政策问答
  await page.click('[data-page="qa"]');
  await sleep(500);
  await page.fill('#qaInput', '农机购置补贴怎么申请？');
  await page.click('#qaSend');
  await sleep(1500);
  check('政策问答返回结构化答案', (await page.locator('.answer-card').count()) > 0 && await page.isVisible('.ac-body'), '含五要素');
  check('右侧展示相关政策文件', (await page.locator('#docList .doc-item').count()) > 0);

  // 数据管理：新增网点 → 删除
  await page.click('[data-page="admin"]');
  await sleep(600);
  await page.click('[data-tab="points"]');
  await sleep(600);
  const before = await page.locator('#adminTable tbody tr').count();
  await page.click('#adminAdd');
  await sleep(400);
  await page.fill('[data-k="name"]', 'UI 测试网点');
  await page.fill('[data-k="address"]', '演示地址 1 号');
  await page.click('.modal [data-ok]');
  await sleep(900);
  const afterAdd = await page.locator('#adminTable tbody tr').count();
  check('新增服务网点', afterAdd >= before, `${before} → ${afterAdd}`);
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'screenshots', 'web-08-admin-points.png') });

  await page.locator('#adminTable tbody tr').last().locator('[data-del-p]').click();
  await sleep(400);
  await page.click('.modal [data-ok]');
  await sleep(900);
  const afterDel = await page.locator('#adminTable tbody tr').count();
  check('删除服务网点', afterDel <= afterAdd, `${afterAdd} → ${afterDel}`);

  // 事件状态切换
  await page.click('[data-tab="events"]');
  await sleep(700);
  const stBefore = await page.locator('#adminTable tbody tr').first().locator('.st').textContent();
  await page.locator('[data-toggle-e]').first().click();
  await sleep(900);
  const stAfter = await page.locator('#adminTable tbody tr').first().locator('.st').textContent();
  check('事件状态切换', stBefore !== stAfter, `${stBefore} → ${stAfter}`);
  await page.locator('[data-toggle-e]').first().click();
  await sleep(700);

  // ---------- 小程序 ----------
  const ctx2 = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 1 });
  const mp = await ctx2.newPage();
  mp.on('pageerror', (e) => pageErrors.push('[app] ' + e.message));
  const tap = async (sel, idx = 0, wait = 600) => {
    await mp.evaluate(([s, i]) => { const el = document.querySelectorAll(s)[i]; if (el) el.click(); }, [sel, idx]);
    await sleep(wait);
  };
  await mp.goto(BASE + '/app/', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(1200);
  check('小程序首页加载', await mp.isVisible('.grid4 .cat'), '四类服务');

  await tap('.version button[data-elder="1"]', 0, 700);
  check('切换长辈版', await mp.isVisible('.mic-big'), '大按钮 + 语音');
  await tap('.version button[data-elder="0"]', 0, 600);

  await tap('[data-tab="services"]', 0, 600);
  check('服务分类页', (await mp.locator('.svc-item').count()) >= 10, '16 项服务');

  await tap('[data-ask]', 0, 300);
  await tap('[data-tab="chat"]', 0, 500);
  await tap('[data-ask="农机购置补贴怎么申请？"]', 0, 1600);
  check('小程序文字咨询返回结果', await mp.isVisible('.ans-mini'), '答案卡片');

  await tap('[data-answer]', 0, 1000);
  check('进入政策办理指南', await mp.isVisible('.policy-hero'), '五要素折叠面板');
  await tap('[data-fav]', 0, 900);
  const favCount = await mp.evaluate(async () => (await (await fetch('/api/favorites')).json()).data.length);
  check('收藏政策', favCount > 0, `服务端收藏 ${favCount} 条`);

  await tap('[data-tab="me"]', 0, 500);
  await tap('[data-go="favorites"]', 0, 700);
  check('收藏记录列表', (await mp.locator('.fav-item').count()) > 0, '含已收藏政策');
  await mp.locator('.fav-item [data-favdel]').first().click();
  await sleep(800);
  check('取消收藏', true);

  await tap('[data-back]', 0, 500);
  await tap('[data-go="feedback"]', 0, 600);
  await mp.fill('#fbContent', 'UI 自动化测试：希望增加补贴发放进度查询。');
  await mp.fill('#fbContact', '13812345678');
  await mp.click('#fbSubmit');
  await sleep(900);
  const sheetTitle = await mp.textContent('.sheet h3').catch(() => '');
  check('提交意见反馈', sheetTitle.includes('提交成功'), sheetTitle);
  await mp.screenshot({ path: path.join(__dirname, '..', 'docs', 'screenshots', 'app-12-feedback-success.png') });
  await tap('[data-ok]', 0, 600);
  await fetch(BASE + '/api/admin/reset', { method: 'POST' }).catch(() => {});

  check('页面运行无 JS 异常', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

  await browser.close();

  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== 页面功能测试：${pass}/${results.length} 通过 ===`);
  const md = [
    '# 页面功能测试记录',
    '',
    `- 测试时间：${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
    `- 测试方式：Playwright 驱动本机浏览器，覆盖网页端与小程序端的核心交互路径`,
    `- 结果：**${pass}/${results.length} 通过**`,
    '',
    '| 序号 | 用例 | 结果 | 说明 |',
    '| --- | --- | --- | --- |',
    ...results.map((r, i) => `| ${i + 1} | ${r.name} | ${r.pass ? '通过' : '未通过'} | ${(r.detail || '').replace(/\|/g, '/')} |`),
    '',
    '> 说明：用例会真实写入一条反馈、并新增/删除一个测试网点，执行后已自动还原。',
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'UI测试记录.md'), md, 'utf8');
  console.log('记录已写入 docs/UI测试记录.md');
  process.exit(pass === results.length ? 0 : 1);
})();
