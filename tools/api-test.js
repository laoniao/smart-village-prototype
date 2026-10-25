/**
 * 接口与功能自动化测试（演示环境）
 * 运行：node tools/api-test.js
 * 说明：脚本会自动拉起本地服务（随机端口），执行完自动关闭，并生成测试记录。
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 5399;
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];
let server;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('服务启动超时');
}

function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail });
  const icon = cond ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name}${detail ? '  · ' + detail : ''}`);
  if (!cond) process.exitCode = 1;
}

async function req(url, opts = {}) {
  const res = await fetch(BASE + url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

(async function main() {
  console.log('\n=== 智慧乡村原型 · 接口测试 ===\n');
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await waitServer();

  try {
    /* 1. 基础连通 */
    const health = await req('/api/health');
    check('健康检查 /api/health', health.json && health.json.code === 0, 'status=' + (health.json && health.json.data.status));

    const pageWeb = await fetch(BASE + '/web/');
    check('网页端静态页面可访问', pageWeb.ok, 'HTTP ' + pageWeb.status);
    const pageApp = await fetch(BASE + '/app/');
    check('小程序端静态页面可访问', pageApp.ok, 'HTTP ' + pageApp.status);
    const leaflet = await fetch(BASE + '/vendor/leaflet/leaflet.js');
    check('地图组件 Leaflet 本地化加载', leaflet.ok, 'HTTP ' + leaflet.status);

    /* 2. 概览 */
    const ov = await req('/api/overview');
    const d = ov.json.data;
    check('概览接口返回统计指标', d.stats && d.stats.households === 428, `总户数=${d.stats && d.stats.households}`);
    check('概览接口返回村域边界', Array.isArray(d.village.boundary) && d.village.boundary.length > 8, `边界点=${d.village.boundary.length}`);
    check('概览接口返回多村边界', d.villages.length >= 5, `村庄数=${d.villages.length}`);
    const pending = d.alerts.filter((a) => a.status === '待处置').length;
    check('概览接口返回预警列表', d.alerts.length >= 3 && pending === 3, `预警=${d.alerts.length}，待处置=${pending}`);
    check('概览接口返回月度趋势', d.stats.monthly.length === 6, '6 个月');

    /* 3. 农户列表与筛选 */
    const hs = await req('/api/households?size=600');
    check('农户列表返回 428 户', hs.json.data.total === 428, 'total=' + hs.json.data.total);
    check('农户点位均含经纬度', hs.json.data.rows.every((h) => h.lat && h.lng), '逐条校验');
    const masked = hs.json.data.rows.every((h) => /^\d{3}\*{4}\d{4}$/.test(h.phone));
    check('列表手机号脱敏', masked, '格式 138****2468');
    const g1 = await req('/api/households?group=' + encodeURIComponent('一组'));
    check('按组别筛选', g1.json.data.total > 0 && g1.json.data.rows.every((h) => h.group === '一组'), `一组 ${g1.json.data.total} 户`);
    const kw = await req('/api/households?keyword=A-023');
    check('按户号搜索', kw.json.data.total === 1 && kw.json.data.rows[0].houseNo === 'A-023');

    /* 4. 详情与权限 */
    const detail = await req('/api/households/A-023');
    check('农户详情返回脱敏信息', detail.json.data && detail.json.data.phone.includes('****'));
    const denied = await req('/api/households/A-023/full', { headers: { 'x-role': 'grid' } });
    check('网格员访问完整台账被拒绝', denied.json.code === 403, denied.json.message);
    const allowed = await req('/api/households/A-023/full', { headers: { 'x-role': 'admin' } });
    check('管理员可查看完整台账', allowed.json.code === 0 && !!allowed.json.data.idCard, '已写审计日志');

    /* 5. 点位 / 摄像头 / 事件 */
    const pts = await req('/api/service-points');
    check('服务网点接口', pts.json.data.length === 5, '5 个网点');
    const cams = await req('/api/cameras');
    check('摄像头接口', cams.json.data.length === 12, '12 路');
    const evs = await req('/api/events');
    check('事件接口', evs.json.data.length === 6, '含待处置/已处置');
    const evDeny = await req('/api/events/EV-001', { method: 'PATCH', headers: { 'x-role': 'grid' }, body: JSON.stringify({ status: '已处置' }) });
    check('网格员变更事件状态被拒绝', evDeny.json.code === 403);
    const evOk = await req('/api/events/EV-001', { method: 'PATCH', headers: { 'x-role': 'admin' }, body: JSON.stringify({ status: '已处置' }) });
    check('管理员变更事件状态', evOk.json.code === 0 && evOk.json.data.status === '已处置');
    await req('/api/events/EV-001', { method: 'PATCH', headers: { 'x-role': 'admin' }, body: JSON.stringify({ status: '待处置' }) });

    /* 6. 通知 / 服务 */
    const notices = await req('/api/notices');
    check('通知列表', notices.json.data.length >= 6, `${notices.json.data.length} 条`);
    const notice = await req('/api/notices/N-001');
    check('通知详情并累计阅读量', notice.json.code === 0 && notice.json.data.views > 0, 'views=' + notice.json.data.views);
    const services = await req('/api/services');
    check('服务事项列表', services.json.data.length === 16, '16 项');
    const cats = await req('/api/categories');
    check('服务分类', cats.json.data.length === 6, '6 类');

    /* 7. 智能问答 */
    const qa1 = await req('/api/qa/ask', { method: 'POST', body: JSON.stringify({ question: '农机购置补贴怎么申请？' }) });
    check('政策问答命中农机补贴', qa1.json.data.matched && qa1.json.data.answer.policyId === 'P-01', 'policyId=P-01');
    check('答案包含五要素', ['applyTo', 'materials', 'steps', 'place', 'basis'].every((k) => qa1.json.data.answer[k]), '对象/材料/流程/地点/依据');
    check('答案附带相关文件', qa1.json.data.docs.length > 0, `${qa1.json.data.docs.length} 份`);
    const qa2 = await req('/api/qa/ask', { method: 'POST', body: JSON.stringify({ question: '医保报销比例是多少？' }) });
    check('政策问答命中医保报销', qa2.json.data.answer.policyId === 'P-03');
    const qa3 = await req('/api/qa/ask', { method: 'POST', body: JSON.stringify({ question: '今天天气怎么样' }) });
    check('未命中时返回兜底答案', qa3.json.data.matched === false && qa3.json.data.suggestions.length > 0);
    const qa4 = await req('/api/qa/ask', { method: 'POST', body: JSON.stringify({ question: '' }) });
    check('空问题校验', qa4.json.code === 400);

    /* 8. 统一搜索 */
    const search = await req('/api/search?q=' + encodeURIComponent('补贴'));
    check('统一搜索返回多类型结果', search.json.data.policies.length > 0 && search.json.data.services.length > 0, `政策 ${search.json.data.policies.length} · 服务 ${search.json.data.services.length}`);

    /* 9. 收藏 */
    const fav = await req('/api/favorites', { method: 'POST', body: JSON.stringify({ targetType: 'policy', targetId: 'P-02', title: '粮食补贴查询及办理指南', summary: '演示' }) });
    check('新增收藏', fav.json.code === 0 && fav.json.data.id);
    const favList = await req('/api/favorites');
    check('收藏列表包含新增项', favList.json.data.some((f) => f.targetId === 'P-02'), `${favList.json.data.length} 条`);
    const favDel = await req('/api/favorites/' + fav.json.data.id, { method: 'DELETE' });
    check('删除收藏', favDel.json.code === 0);

    /* 10. 反馈 */
    const fbEmpty = await req('/api/feedback', { method: 'POST', body: JSON.stringify({ type: '功能建议', content: '' }) });
    check('反馈内容为空被拦截', fbEmpty.json.code === 400);
    const fb = await req('/api/feedback', { method: 'POST', body: JSON.stringify({ type: '政策有误', content: '希望增加补贴发放进度查询', contact: '13812345678' }) });
    check('提交反馈成功', fb.json.code === 0 && fb.json.data.id, '联系方式脱敏：' + (fb.json.data && fb.json.data.contact));

    /* 11. 后台基础数据维护 */
    const addPoint = await req('/api/points', { method: 'POST', headers: { 'x-role': 'admin' }, body: JSON.stringify({ name: '测试网点', type: '便民服务', address: '演示地址', lat: 30.2352, lng: 120.1157 }) });
    check('管理员新增网点', addPoint.json.code === 0);
    const updPoint = await req('/api/points/' + addPoint.json.data.id, { method: 'PUT', headers: { 'x-role': 'admin' }, body: JSON.stringify({ name: '测试网点（已改名）' }) });
    check('管理员编辑网点', updPoint.json.data.name === '测试网点（已改名）');
    const delDeny = await req('/api/points/' + addPoint.json.data.id, { method: 'DELETE', headers: { 'x-role': 'grid' } });
    check('网格员删除网点被拒绝', delDeny.json.code === 403);
    const delPoint = await req('/api/points/' + addPoint.json.data.id, { method: 'DELETE', headers: { 'x-role': 'admin' } });
    check('管理员删除网点', delPoint.json.code === 0);

    /* 12. 农户维护 */
    const patch = await req('/api/households/A-001', { method: 'PATCH', headers: { 'x-role': 'admin' }, body: JSON.stringify({ houseStatus: '待核查' }) });
    check('管理员维护农户状态', patch.json.data.houseStatus === '待核查');
    await req('/api/households/A-001', { method: 'PATCH', headers: { 'x-role': 'admin' }, body: JSON.stringify({ houseStatus: '正常' }) });
    const patchDeny = await req('/api/households/A-001', { method: 'PATCH', headers: { 'x-role': 'grid' }, body: JSON.stringify({ members: 3 }) });
    check('网格员维护农户被拒绝', patchDeny.json.code === 403);

    /* 13. 地图接入接口 */
    const mapCfg = await req('/api/map/config');
    check('地图服务配置 /api/map/config', mapCfg.json.code === 0 && mapCfg.json.data.providers.length >= 4,
      `${mapCfg.json.data.providers.length} 个底图服务，当前 ${mapCfg.json.data.current}`);
    check('底图坐标系说明', !!mapCfg.json.data.crs && mapCfg.json.data.crs.logical === 'wgs84', '逻辑坐标 WGS84');
    check('未配置 key 的天地图标记为不可用',
      mapCfg.json.data.providers.filter((p) => p.needKey).every((p) => p.available === false));

    /* 14. 摄像头能力接口 */
    const caps = await req('/api/cameras/capabilities');
    check('摄像头能力清单', caps.json.data.protocols.length === 5 && caps.json.data.features.length >= 5);
    const camStats = await req('/api/cameras/stats');
    check('摄像头统计', camStats.json.data.total === 12 && camStats.json.data.onlineRate > 0,
      `在线率 ${camStats.json.data.onlineRate}%`);
    const camOne = await req('/api/cameras/CAM-01', { headers: { 'x-role': 'admin' } });
    check('摄像头详情：管理员可见真实取流地址',
      camOne.json.data.streamUrl === '/api/cameras/CAM-01/stream' && String(camOne.json.data.streamUrlFull).indexOf('rtsp') === 0);
    const camOneGrid = await req('/api/cameras/CAM-01', { headers: { 'x-role': 'grid' } });
    check('摄像头详情：网格员不暴露真实取流地址', camOneGrid.json.data.streamUrlFull === '(管理员可见)');
    const snap = await fetch(`${BASE}/api/cameras/CAM-01/snapshot`);
    check('抓图接口返回图片', snap.ok && /svg/.test(snap.headers.get('content-type') || ''), snap.headers.get('content-type'));
    const offlineId = (await req('/api/cameras?status=offline')).json.data[0].id;
    const snapOffline = await req(`/api/cameras/${offlineId}/snapshot`, { method: 'POST' });
    check('离线设备抓拍被拒绝', snapOffline.json.code === 503, '设备 ' + offlineId + '：' + snapOffline.json.message);
    const ptzDeny = await req('/api/cameras/CAM-01/ptz', { method: 'POST', headers: { 'x-role': 'grid' }, body: JSON.stringify({ action: 'left' }) });
    check('网格员云台控制被拒绝', ptzDeny.json.code === 403);
    const ptzOk = await req('/api/cameras/CAM-01/ptz', { method: 'POST', headers: { 'x-role': 'admin' }, body: JSON.stringify({ action: 'left' }) });
    check('管理员云台控制', ptzOk.json.code === 0 && (ptzOk.json.data || {}).direction != null, '方位 ' + (ptzOk.json.data || {}).direction);
    const ptzBad = await req('/api/cameras/CAM-01/ptz', { method: 'POST', headers: { 'x-role': 'admin' }, body: JSON.stringify({ action: 'fly' }) });
    check('非法云台指令被拒绝', ptzBad.json.code === 400);
    const rec = await req('/api/cameras/CAM-01/record', { method: 'POST', headers: { 'x-role': 'admin' }, body: JSON.stringify({ action: 'start' }) });
    check('录像控制接口', rec.json.code === 0);
    const hb = await req('/api/cameras/heartbeat', { method: 'POST', body: JSON.stringify({ id: 'CAM-01', status: 'online' }) });
    check('设备心跳上报', hb.json.code === 0);

    /* 15. 录入模板与批量导入 */
    const schemaList = await req('/api/schema');
    check('可录入类型清单', schemaList.json.data.length === 5, schemaList.json.data.map((x) => x.label).join('/'));
    const schemaOne = await req('/api/schema/households');
    check('字段定义接口', schemaOne.json.data.fields.length >= 10 && !!schemaOne.json.data.uniqueKey);
    const tpl = await fetch(`${BASE}/api/template/csv/households`);
    const tplText = await tpl.text();
    // fetch.text() 会按规范去掉 BOM，这里校验表头位置 + 下载响应头
    check('CSV 模板下载', tpl.ok && tplText.indexOf('户号') === 0 && tplText.split('\n').length >= 3
      && /attachment/.test(tpl.headers.get('content-disposition') || ''), '表头 + 2 行示例 + 下载响应头');
    const tplMeta = await req('/api/template/cameras');
    check('模板元数据接口', !!tplMeta.json.data.csv && tplMeta.json.data.fields.length > 0);

    for (const e of schemaList.json.data) {
      const meta = await req('/api/template/' + e.entity);
      const v = await req(`/api/import/${e.entity}`, {
        method: 'POST', headers: { 'x-role': 'admin' },
        body: JSON.stringify({ text: meta.json.data.csv, mode: 'validate' }),
      });
      check(`模板示例自校验 · ${e.label}`, v.json.data.valid === v.json.data.total,
        `${v.json.data.valid}/${v.json.data.total} 通过`);
    }

    const bad = await req('/api/import/households', {
      method: 'POST', headers: { 'x-role': 'admin' },
      body: JSON.stringify({ text: '户号,户主姓名,所属组别,门牌地址,家庭成员数,房屋状态\nB-902,,,,,', mode: 'validate' }),
    });
    check('必填项缺失被拦截', bad.json.data.invalid === 1 && bad.json.data.valid === 0,
      ((bad.json.data.results[0].errors || [])[0] || {}).msg);
    const badNum = await req('/api/import/households', {
      method: 'POST', headers: { 'x-role': 'admin' },
      body: JSON.stringify({ text: '户号,户主姓名,所属组别,门牌地址,家庭成员数,房屋状态,纬度\nB-901,王某,一组,示范村一组901号,3,正常,99', mode: 'validate' }),
    });
    check('越界纬度被拦截', badNum.json.data.invalid === 1, ((badNum.json.data.results[0].errors || [])[0] || {}).msg);
    const dup = await req('/api/import/households', {
      method: 'POST', headers: { 'x-role': 'admin' },
      body: JSON.stringify({ text: '户号,户主姓名,所属组别,门牌地址,家庭成员数,房屋状态\nA-001,李某,一组,示范村一组1号,3,正常', mode: 'validate' }),
    });
    check('已存在的户号被拦截', dup.json.data.invalid === 1, ((dup.json.data.results[0].errors || [])[0] || {}).msg);
    const impDeny = await req('/api/import/points', {
      method: 'POST', headers: { 'x-role': 'grid' },
      body: JSON.stringify({ text: '网点名称,网点类型,地址,纬度,经度\n测试点,便民服务,测试地址,30.235,120.115', mode: 'commit' }),
    });
    check('网格员批量导入被拒绝', impDeny.json.code === 403);

    const before = (await req('/api/households?size=1')).json.data.total;
    const commit = await req('/api/import/households', {
      method: 'POST', headers: { 'x-role': 'admin' },
      body: JSON.stringify({ text: '户号,户主姓名,所属组别,门牌地址,家庭成员数,房屋状态,纬度,经度\nZ-901,测试户,一组,示范村一组901号,3,正常,30.2351,120.1157', mode: 'commit' }),
    });
    check('批量导入写入', commit.json.data.imported === 1);
    const after = (await req('/api/households?size=1')).json.data.total;
    check('导入后总数 +1', after === before + 1, `${before} → ${after}`);
    const restore = await req('/api/admin/restore-households', { method: 'POST', headers: { 'x-role': 'admin' } });
    const back = (await req('/api/households?size=1')).json.data.total;
    check('导入数据可一键还原', restore.json.code === 0 && back === before, `${after} → ${back}`);

    /* 16. 测试数据还原 */
    const reset = await req('/api/admin/reset', { method: 'POST' });
    check('清空测试期间产生的运行数据', reset.json.code === 0 && reset.json.data.reset === true);
  } catch (e) {
    check('测试执行异常', false, e.message);
  } finally {
    if (server) server.kill();
  }

  const pass = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`\n=== 测试完成：${pass}/${total} 通过 ===\n`);

  const report = [
    '# 功能与接口测试记录',
    '',
    `- 测试时间：${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
    `- 测试范围：后端接口 12 组、页面可访问性、权限控制、数据脱敏`,
    `- 测试结果：**${pass}/${total} 通过**`,
    '',
    '| 序号 | 测试项 | 结果 | 说明 |',
    '| --- | --- | --- | --- |',
    ...results.map((r, i) => `| ${i + 1} | ${r.name} | ${r.pass ? '通过' : '未通过'} | ${(r.detail || '').replace(/\|/g, '/')} |`),
    '',
    '> 说明：测试脚本会自动拉起独立端口的服务、执行用例，并在结束时清空测试期间产生的收藏、反馈与审计日志；被临时修改的农户状态与网点数据会还原。',
  ].join('\n');
  fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'docs', '测试记录.md'), report, 'utf8');
  console.log('测试记录已写入 docs/测试记录.md');
  setTimeout(() => process.exit(process.exitCode || 0), 300);
})();
