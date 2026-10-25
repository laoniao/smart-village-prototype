/**
 * 智慧乡村地图与便民助手 —— 原型后端（演示用）
 * 纯本地 JSON 数据 + 内存状态，不连接任何真实业务系统。
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const S = require('./schemas');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const RUNTIME = path.join(DATA, 'runtime');
fs.mkdirSync(RUNTIME, { recursive: true });

const readJson = (p, def) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; }
};
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');

const db = {
  villages: readJson(path.join(DATA, 'villages.json'), []),
  households: readJson(path.join(DATA, 'households.json'), []),
  points: readJson(path.join(DATA, 'service-points.json'), []),
  cameras: readJson(path.join(DATA, 'cameras.json'), []),
  events: readJson(path.join(DATA, 'events.json'), []),
  notices: readJson(path.join(DATA, 'notices.json'), []),
  policies: readJson(path.join(DATA, 'policies.json'), []),
  services: readJson(path.join(DATA, 'services.json'), []),
  categories: readJson(path.join(DATA, 'categories.json'), []),
  stats: readJson(path.join(DATA, 'stats.json'), {}),
  feedback: readJson(path.join(RUNTIME, 'feedback.json'), []),
  favorites: readJson(path.join(RUNTIME, 'favorites.json'), []),
  accessLog: readJson(path.join(RUNTIME, 'access-log.json'), []),
};

const persist = {
  feedback: () => writeJson(path.join(RUNTIME, 'feedback.json'), db.feedback),
  favorites: () => writeJson(path.join(RUNTIME, 'favorites.json'), db.favorites),
  accessLog: () => writeJson(path.join(RUNTIME, 'access-log.json'), db.accessLog),
  events: () => writeJson(path.join(DATA, 'events.json'), db.events),
  points: () => writeJson(path.join(DATA, 'service-points.json'), db.points),
  notices: () => writeJson(path.join(DATA, 'notices.json'), db.notices),
  cameras: () => writeJson(path.join(DATA, 'cameras.json'), db.cameras),
  households: () => writeJson(path.join(DATA, 'households.json'), db.households),
};

/** 实体 -> 内存数据集，用于导入查重 */
const ENTITY_STORE = {
  households: db.households,
  points: db.points,
  cameras: db.cameras,
  notices: db.notices,
  events: db.events,
};

/** 首次录入农户前备份原始台账，便于演示后一键还原 */
function backupHouseholds() {
  const bak = path.join(RUNTIME, 'households.backup.json');
  if (!fs.existsSync(bak)) {
    fs.copyFileSync(path.join(DATA, 'households.json'), bak);
  }
}

/** 覆盖导入前把当前数据归档一份（带时间戳），出问题可人工回溯 */
function archiveEntity(entity) {
  const arr = db[entity] || [];
  if (!arr.length) return null;
  if (!fs.existsSync(RUNTIME)) fs.mkdirSync(RUNTIME, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(RUNTIME, `${entity}.replaced-${stamp}.json`);
  writeJson(file, arr);
  return file;
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/* ------------------------- 工具 ------------------------- */
const maskPhone = (p) => (p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '');
const roleOf = (req) => (req.get('x-role') || 'grid').toLowerCase();
const publicHousehold = (h) => ({
  id: h.id, houseNo: h.houseNo, owner: h.owner, phone: h.phone, group: h.group,
  address: h.address, lat: h.lat, lng: h.lng, members: h.members,
  houseStatus: h.houseStatus, care: h.care, builtYear: h.builtYear, area: h.area,
  tags: h.tags, updatedAt: h.updatedAt,
});
const ok = (res, data, extra = {}) => res.json({ code: 0, message: 'ok', data, ...extra });
const fail = (res, code, message) => res.status(code === 401 ? 401 : 200).json({ code, message, data: null });

/* ------------------------- 概览 ------------------------- */
app.get('/api/health', (req, res) => ok(res, { status: 'up', time: new Date().toISOString(), mode: 'prototype' }));

app.get('/api/overview', (req, res) => {
  const main = db.villages.find((v) => v.isMain) || {};
  ok(res, {
    stats: db.stats,
    village: { name: main.name, center: main.center, boundary: main.boundary },
    villages: db.villages.map((v) => ({ id: v.id, name: v.name, center: v.center, boundary: v.boundary, isMain: !!v.isMain, households: v.households })),
    alerts: db.events.filter((e) => e.status !== '已作废').sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt))).slice(0, 5),
    eventCount: {
      pending: db.events.filter((e) => e.status === '待处置').length,
      done: db.events.filter((e) => e.status === '已处置').length,
      voided: db.events.filter((e) => e.status === '已作废').length,
    },
    cameraOnline: db.cameras.filter((c) => c.status === 'online').length,
    cameraTotal: db.cameras.length,
  });
});

app.get('/api/villages', (req, res) => ok(res, db.villages));

/* ------------------------- 农户 ------------------------- */
app.get('/api/households', (req, res) => {
  const { keyword = '', group = '', status = '', care = '', page = '1', size = '500' } = req.query;
  const kw = String(keyword).trim();
  let list = db.households;
  if (kw) list = list.filter((h) => h.houseNo.includes(kw) || h.owner.includes(kw) || h.address.includes(kw) || h.group.includes(kw));
  if (group) list = list.filter((h) => h.group === group);
  if (status) list = list.filter((h) => h.houseStatus === status);
  if (care === '1') list = list.filter((h) => h.care !== '无');
  const total = list.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const s = Math.min(1000, Math.max(1, parseInt(size, 10) || 500));
  const rows = list.slice((p - 1) * s, p * s).map(publicHousehold);
  ok(res, { total, page: p, size: s, rows });
});

app.get('/api/households/stats', (req, res) => {
  const by = (k) => db.households.reduce((m, h) => ((m[h[k]] = (m[h[k]] || 0) + 1), m), {});
  const retired = db.households.filter((h) => S.RETIRED_STATUSES.indexOf(h.houseStatus) >= 0);
  ok(res, {
    total: db.households.length,
    resident: db.households.length - retired.length,
    retired: retired.length,
    groups: by('group'),
    status: by('houseStatus'),
    careCount: db.households.filter((h) => h.care !== '无').length,
    members: db.households.reduce((s, h) => s + h.members, 0),
  });
});

app.get('/api/households/:id', (req, res) => {
  const h = db.households.find((x) => x.id === req.params.id || x.houseNo === req.params.id);
  if (!h) return fail(res, 404, '未找到该农户');
  ok(res, publicHousehold(h));
});

/** 完整台账：仅管理员角色可见，写入访问日志 */
app.get('/api/households/:id/full', (req, res) => {
  const h = db.households.find((x) => x.id === req.params.id);
  if (!h) return fail(res, 404, '未找到该农户');
  const role = roleOf(req);
  if (role !== 'admin') {
    return fail(res, 403, '当前账号为网格员角色，仅可查看脱敏信息，如需完整台账请申请权限');
  }
  db.accessLog.unshift({
    at: new Date().toISOString(), role, householdId: h.id,
    action: 'view_full_profile', ip: req.ip,
  });
  db.accessLog = db.accessLog.slice(0, 200);
  persist.accessLog();
  ok(res, {
    id: h.id, houseNo: h.houseNo, owner: h.owner, phoneFull: '1381234' + h.id.slice(-4).padStart(4, '0'),
    idCard: '3305**********' + h.id.slice(-4), group: h.group, address: h.address,
    members: h.members, houseStatus: h.houseStatus, care: h.care, area: h.area,
    builtYear: h.builtYear, landArea: Math.round(h.area * 0.6), updatedAt: h.updatedAt,
    memberList: Array.from({ length: Math.min(3, h.members) }, (_, i) => ({
      name: h.owner.charAt(0) + (i === 0 ? '某' : '某某'),
      relation: ['户主', '配偶', '子女'][i],
      ageBand: ['50-59', '45-54', '20-29'][i],
    })),
    note: '演示数据，不含真实个人信息',
  });
});

app.get('/api/households/:id/access-log', (req, res) => {
  ok(res, db.accessLog.filter((l) => l.householdId === req.params.id).slice(0, 10));
});

/* ------------------------- 点位 / 摄像头 / 事件 ------------------------- */
app.get('/api/service-points', (req, res) => ok(res, db.points));

/* ------------------------- 视频监控（设备接入能力） ------------------------- */
const cameraPublic = (c) => ({
  id: c.id, name: c.name, deviceId: c.deviceId, channel: c.channel, vendor: c.vendor,
  kind: c.kind, protocol: c.protocol, resolution: c.resolution, ptz: !!c.ptz,
  direction: c.direction, fov: c.fov, radius: c.radius, aiTags: c.aiTags || [],
  installAt: c.installAt, storageDays: c.storageDays, status: c.status,
  lat: c.lat, lng: c.lng, note: c.note || '',
  // 真实取流地址不直接下发给非管理员，避免演示环境暴露内网地址
  streamUrl: c.streamUrl ? '/api/cameras/' + c.id + '/stream' : '',
  snapUrl: c.snapUrl || ('/api/cameras/' + c.id + '/snapshot'),
});

/** 设备能力清单（前端据此渲染接入面板） */
app.get('/api/cameras/capabilities', (req, res) => {
  ok(res, {
    protocols: [
      { id: 'gb28181', name: 'GB/T 28181', desc: '公安/政务视频联网标准，支持 SIP 注册、目录订阅、云台控制', stream: 'sip', ptz: true },
      { id: 'rtsp', name: 'RTSP / ONVIF', desc: '设备直连取流，需内网可达或经流媒体网关转发', stream: 'rtsp', ptz: true },
      { id: 'hls', name: 'HLS', desc: '切片拉流，浏览器可直接播放，延迟约 5-15 秒', stream: 'http', ptz: false },
      { id: 'rtmp', name: 'RTMP / HTTP-FLV', desc: '低延迟直播流，需 flv.js 播放', stream: 'http', ptz: true },
      { id: 'webrtc', name: 'WebRTC', desc: '亚秒级低延迟，需流媒体服务器支持 WHEP/WHIP', stream: 'webrtc', ptz: true },
    ],
    features: ['实时预览', '云台控制', '抓拍', '录像与回放', 'AI 事件推送', '设备心跳巡检'],
    aiAlgorithms: ['人员聚集', '车辆识别', '烟火检测', '越界检测', '跌倒检测', '水位识别'],
    note: '演示环境不接入真实视频流，预览画面为占位示意；接入时只需把 streamUrl 换成真实地址并实现 /api/cameras/:id/stream。',
  });
});

app.get('/api/cameras/stats', (req, res) => {
  const total = db.cameras.length;
  const online = db.cameras.filter((c) => c.status === 'online').length;
  const fault = db.cameras.filter((c) => c.status === 'fault').length;
  ok(res, {
    total, online, offline: total - online - fault, fault,
    onlineRate: total ? Math.round((online / total) * 1000) / 10 : 0,
    ptzCount: db.cameras.filter((c) => c.ptz).length,
    aiCount: db.cameras.filter((c) => (c.aiTags || []).length).length,
    byProtocol: db.cameras.reduce((m, c) => ((m[c.protocol] = (m[c.protocol] || 0) + 1), m), {}),
    byVendor: db.cameras.reduce((m, c) => ((m[c.vendor] = (m[c.vendor] || 0) + 1), m), {}),
    storageDays: 30,
  });
});

app.get('/api/cameras', (req, res) => {
  const { status = '', protocol = '' } = req.query;
  let list = db.cameras;
  if (status) list = list.filter((c) => c.status === status);
  if (protocol) list = list.filter((c) => c.protocol === protocol);
  ok(res, list.map(cameraPublic));
});

app.get('/api/cameras/:id', (req, res) => {
  const c = db.cameras.find((x) => x.id === req.params.id || x.deviceId === req.params.id);
  if (!c) return fail(res, 404, '设备不存在');
  ok(res, Object.assign(cameraPublic(c), {
    streamUrlFull: roleOf(req) === 'admin' ? c.streamUrl : '(管理员可见)',
    lastHeartbeat: c.status === 'offline' ? null : new Date(Date.now() - 1000 * 60 * (1 + (c.id.charCodeAt(4) % 7))).toISOString(),
  }));
});

/** 取流地址：演示返回占位，真实环境返回可播放地址 */
app.get('/api/cameras/:id/stream', (req, res) => {
  const c = db.cameras.find((x) => x.id === req.params.id);
  if (!c) return fail(res, 404, '设备不存在');
  if (c.status === 'offline') return fail(res, 503, '设备离线，无法取流');
  ok(res, {
    id: c.id, protocol: c.protocol, playable: false,
    url: roleOf(req) === 'admin' ? c.streamUrl : '(内网地址，仅管理员可见)',
    resolution: c.resolution,
    /** 前端播放所需参数（真实接入时填充） */
    player: { type: c.protocol === 'hls' ? 'hls.js' : c.protocol === 'webrtc' ? 'webrtc' : 'flv.js', autoplay: true, muted: true },
    note: '演示环境返回占位信息；接入真实平台时改为返回签名后的播放地址。',
  });
});

/** 抓拍：演示返回一张生成的占位图 */
const snapCache = new Map();
app.get('/api/cameras/:id/snapshot', (req, res) => {
  const c = db.cameras.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).send('device not found');
  const t = new Date();
  const stamp = t.toISOString().replace('T', ' ').slice(0, 19);
  const hue = ((c.id.charCodeAt(4) || 65) * 17) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},28%,26%)"/><stop offset="1" stop-color="hsl(${(hue + 24) % 360},24%,12%)"/>
    </linearGradient>
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="640" height="360" fill="url(#sky)"/>
  <rect width="640" height="360" filter="url(#n)" opacity="0.09"/>
  <path d="M0 250 L140 196 L260 232 L420 168 L640 224 L640 360 L0 360 Z" fill="hsl(${hue},20%,17%)" opacity="0.9"/>
  <path d="M0 292 L120 262 L300 296 L470 252 L640 288 L640 360 L0 360 Z" fill="hsl(${hue},16%,11%)"/>
  <g fill="hsl(${hue},12%,38%)" opacity="0.75">
    <rect x="72" y="214" width="46" height="38"/><rect x="132" y="204" width="34" height="48"/>
    <rect x="300" y="220" width="52" height="32"/><rect x="470" y="208" width="40" height="44"/>
  </g>
  <g stroke="hsl(${hue},30%,45%)" stroke-width="1" opacity="0.35">
    ${Array.from({ length: 8 }, (_, i) => `<path d="M0 ${40 + i * 40} H640"/>`).join('')}
    ${Array.from({ length: 10 }, (_, i) => `<path d="M${64 * i} 0 V360"/>`).join('')}
  </g>
  <g font-family="Consolas,Menlo,monospace" font-size="14" fill="#e6f2ff">
    <text x="16" y="28">${c.id} ${c.name}</text>
    <text x="16" y="344" font-size="12" opacity="0.85">${stamp} · ${c.resolution} · ${c.protocol}</text>
  </g>
  <g font-family="Consolas,Menlo,monospace" font-size="13" fill="#8ff0c0">
    <text x="624" y="28" text-anchor="end">${c.status === 'online' ? '● LIVE' : '● OFFLINE'}</text>
  </g>
</svg>`;
  snapCache.set(c.id, stamp);
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'no-store');
  res.send(svg);
});

app.post('/api/cameras/:id/snapshot', (req, res) => {
  const c = db.cameras.find((x) => x.id === req.params.id);
  if (!c) return fail(res, 404, '设备不存在');
  if (c.status === 'offline') return fail(res, 503, '设备离线，抓拍失败');
  const at = new Date().toISOString();
  ok(res, { id: c.id, at, url: '/api/cameras/' + c.id + '/snapshot?t=' + Date.now(), note: '演示抓拍，真实环境返回平台抓拍图 URL' });
});

/** 云台控制 */
const PTZ_ACTIONS = ['up', 'down', 'left', 'right', 'zoomIn', 'zoomOut', 'reset', 'stop'];
app.post('/api/cameras/:id/ptz', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '云台控制需管理员权限');
  const c = db.cameras.find((x) => x.id === req.params.id);
  if (!c) return fail(res, 404, '设备不存在');
  const { action, speed = 5 } = req.body || {};
  if (PTZ_ACTIONS.indexOf(action) < 0) return fail(res, 400, '不支持的云台指令：' + action);
  if (!c.ptz) return fail(res, 400, '该设备为枪机，不支持云台控制');
  if (c.status === 'offline') return fail(res, 503, '设备离线');
  let dir = Number(c.direction) || 0;
  if (action === 'left') dir = (dir - 15 + 360) % 360;
  if (action === 'right') dir = (dir + 15) % 360;
  c.direction = Math.round(dir);
  ok(res, { id: c.id, action, speed, direction: c.direction, at: new Date().toISOString(), note: '演示环境仅记录指令，未下发到真实设备' });
});

/** 录像 / 回放（演示） */
app.post('/api/cameras/:id/record', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '录像操作需管理员权限');
  const c = db.cameras.find((x) => x.id === req.params.id);
  if (!c) return fail(res, 404, '设备不存在');
  const { action = 'start' } = req.body || {};
  if (['start', 'stop'].indexOf(action) < 0) return fail(res, 400, 'action 只能是 start / stop');
  ok(res, {
    id: c.id, action, recording: action === 'start',
    file: action === 'start' ? null : '/api/cameras/' + c.id + '/record/' + Date.now().toString(36),
    at: new Date().toISOString(), note: '演示环境不产生真实录像文件',
  });
});

/** 设备心跳巡检 */
app.post('/api/cameras/heartbeat', (req, res) => {
  const at = new Date().toISOString();
  const list = db.cameras.map((c) => ({ id: c.id, status: c.status, at, rtt: c.status === 'online' ? 20 + (c.id.charCodeAt(4) % 40) : null }));
  ok(res, { checked: list.length, at, list });
});

/* 摄像头设备台账维护（管理员） */
/** 生成不重复的 CAM-xx 编号：取已有最大序号 +1，删除后不会撞号 */
function nextCameraId() {
  const max = db.cameras.reduce((m, c) => {
    const n = parseInt(String(c.id).replace(/^CAM-/, ''), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return 'CAM-' + String(max + 1).padStart(2, '0');
}

app.post('/api/cameras/device', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const body = req.body || {};
  if (!body.streamUrl && body.protocol === 'rtsp') return fail(res, 400, 'RTSP 设备必须填写取流地址');
  const { errors, value } = S.validateRow('cameras', body);
  if (errors.length) return fail(res, 400, errors[0].msg);
  const v = S.normalize('cameras', value);
  if (db.cameras.some((c) => String(c.deviceId) === String(v.deviceId))) return fail(res, 400, '设备编号已存在：' + v.deviceId);
  const seq = nextCameraId().replace(/^CAM-/, '');
  const item = Object.assign({ fov: 55, storageDays: 30, note: '' }, v, {
    id: 'CAM-' + seq, channel: 'CH' + seq,
    lat: Number(v.lat) || 30.235, lng: Number(v.lng) || 120.1155,
    status: v.status || 'online',
  });
  db.cameras.push(item); persist.cameras();
  ok(res, cameraPublic(item));
});

app.put('/api/cameras/device/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const c = db.cameras.find((x) => x.id === req.params.id);
  if (!c) return fail(res, 404, '设备不存在');
  // 局部更新：与现有值合并后再校验，避免只传几个字段时把其它字段清空
  const patch = Object.assign({}, req.body || {});
  // 列表接口下发的是脱敏代理地址，客户端回传时忽略，避免把代理地址存成真实取流地址
  if (patch.streamUrl !== undefined && (patch.streamUrl === '' || String(patch.streamUrl).indexOf('/api/cameras/') === 0)) delete patch.streamUrl;
  const merged = Object.assign({}, c, patch, { id: c.id });
  if (merged.ptz === true || merged.ptz === false) merged.ptz = merged.ptz ? '是' : '否';
  if (Array.isArray(merged.aiTags)) merged.aiTags = merged.aiTags.join(',');
  const { errors, value } = S.validateRow('cameras', merged);
  if (errors.length) return fail(res, 400, errors[0].msg);
  const v = S.normalize('cameras', value);
  if (db.cameras.some((x) => x.id !== c.id && String(x.deviceId) === String(v.deviceId))) {
    return fail(res, 400, '设备编号已被其它设备占用：' + v.deviceId);
  }
  delete v.id;
  Object.assign(c, v, { id: c.id });
  persist.cameras(); ok(res, cameraPublic(c));
});

app.delete('/api/cameras/device/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const i = db.cameras.findIndex((x) => x.id === req.params.id);
  if (i < 0) return fail(res, 404, '设备不存在');
  const [removed] = db.cameras.splice(i, 1);
  persist.cameras();
  // 删除后在线率、云台数等统计随之变化，返回最新统计方便前端直接刷新
  ok(res, { id: removed.id, name: removed.name, total: db.cameras.length });
});

app.get('/api/events', (req, res) => {
  const { status = '' } = req.query;
  let list = db.events;
  if (status) list = list.filter((e) => e.status === status);
  ok(res, list);
});
app.post('/api/events', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const { errors, value } = S.validateRow('events', req.body || {});
  if (errors.length) return fail(res, 400, errors[0].msg);
  const item = Object.assign({ id: 'EV-' + Date.now().toString(36), status: '待处置' }, value);
  db.events.unshift(item);
  persist.events();
  ok(res, item);
});
app.patch('/api/events/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限，事件状态需管理员确认');
  const e = db.events.find((x) => x.id === req.params.id);
  if (!e) return fail(res, 404, '事件不存在');
  const opts = ['待处置', '处置中', '已处置', '已作废'];
  const status = req.body && req.body.status;
  if (!status) return fail(res, 400, '缺少 status 参数');
  if (opts.indexOf(status) < 0) return fail(res, 400, `状态“${status}”不在可选范围内（${opts.join(' / ')}）`);
  e.status = status;
  // 作废保留记录（误报/重复上报），不做物理删除，便于追溯与考核口径统一
  if (status === '已作废') e.voidedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  else delete e.voidedAt;
  if (status === '已处置') e.resolvedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
  else delete e.resolvedAt;
  persist.events();
  ok(res, e);
});

/* ------------------------- 通知 / 服务 ------------------------- */
app.get('/api/notices', (req, res) => {
  const { category = '', important = '' } = req.query;
  let list = db.notices;
  if (category) list = list.filter((n) => n.category === category);
  if (important === '1') list = list.filter((n) => n.important);
  ok(res, list);
});
app.get('/api/notices/:id', (req, res) => {
  const n = db.notices.find((x) => x.id === req.params.id);
  if (!n) return fail(res, 404, '通知不存在');
  n.views += 1;
  ok(res, n);
});

app.get('/api/categories', (req, res) => ok(res, db.categories));
app.get('/api/services', (req, res) => {
  const { cat = '', keyword = '' } = req.query;
  let list = db.services;
  if (cat) list = list.filter((s) => s.cat === cat);
  if (keyword) list = list.filter((s) => s.name.includes(keyword) || s.desc.includes(keyword));
  ok(res, list);
});

/* ------------------------- 政策 / 问答 ------------------------- */
app.get('/api/policies', (req, res) => {
  const { category = '', keyword = '' } = req.query;
  let list = db.policies;
  if (category) list = list.filter((p) => p.category === category);
  if (keyword) list = list.filter((p) => p.title.includes(keyword) || p.keywords.some((k) => k.includes(keyword)));
  ok(res, list.map(({ keywords, ...rest }) => rest));
});

app.get('/api/policies/:id', (req, res) => {
  const p = db.policies.find((x) => x.id === req.params.id);
  if (!p) return fail(res, 404, '政策不存在');
  const { keywords, ...rest } = p;
  ok(res, rest);
});

/** 关键词检索式问答（演示版，不调用外部大模型） */
app.post('/api/qa/ask', (req, res) => {
  const q = String((req.body && req.body.question) || '').trim();
  if (!q) return fail(res, 400, '请输入问题');
  let best = null, bestScore = 0;
  for (const p of db.policies) {
    let score = 0;
    for (const k of p.keywords) if (q.includes(k)) score += k.length >= 3 ? 3 : 2;
    if (q.includes(p.category)) score += 1;
    if (p.title && q.includes(p.title.slice(0, 4))) score += 2;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  const history = [{ role: 'user', content: q }];
  if (!best || bestScore < 2) {
    return ok(res, {
      matched: false, question: q, history,
      answer: {
        title: '暂未找到匹配的政策',
        summary: '您可以换个说法再问一次，或查看下方的常见问题，也可以转人工咨询。',
        applyTo: [], materials: [], steps: [], place: '村便民服务站', placePending: true,
        basis: [], updatedAt: '',
      },
      suggestions: ['农机购置补贴怎么申请？', '医保报销比例是多少？', '高龄津贴怎么领？'],
      docs: [],
    });
  }
  const { keywords, ...p } = best;
  ok(res, {
    matched: true, question: q, history,
    answer: {
      policyId: p.id, title: p.title, summary: p.summary, applyTo: p.applyTo,
      materials: p.materials, steps: p.steps, place: p.place, placePending: p.placePending,
      basis: p.basis, updatedAt: p.updatedAt, confirmed: p.confirmed, category: p.category,
    },
    confidence: Math.min(0.95, 0.62 + bestScore * 0.03),
    suggestions: ['需要准备哪些材料？', '可以代办吗？', '附近哪个网点能办？'],
    docs: p.docs,
  });
});

/* ------------------------- 统一搜索 ------------------------- */
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return ok(res, { households: [], policies: [], notices: [], points: [], services: [] });
  ok(res, {
    households: db.households.filter((h) => h.houseNo.includes(q) || h.owner.includes(q) || h.address.includes(q)).slice(0, 8).map(publicHousehold),
    policies: db.policies.filter((p) => p.title.includes(q) || p.keywords.some((k) => k.includes(q))).slice(0, 5).map(({ keywords, ...r }) => r),
    notices: db.notices.filter((n) => n.title.includes(q) || n.summary.includes(q)).slice(0, 5),
    points: db.points.filter((p) => p.name.includes(q) || p.type.includes(q)).slice(0, 5),
    services: db.services.filter((s) => s.name.includes(q)).slice(0, 5),
  });
});

/* ------------------------- 收藏 / 反馈 ------------------------- */
app.get('/api/favorites', (req, res) => {
  const userId = req.get('x-user') || 'demo-user';
  ok(res, db.favorites.filter((f) => f.userId === userId));
});
app.post('/api/favorites', (req, res) => {
  const userId = req.get('x-user') || 'demo-user';
  const { targetType, targetId, title, summary } = req.body || {};
  if (!targetType || !targetId) return fail(res, 400, '参数不完整');
  const exist = db.favorites.find((f) => f.userId === userId && f.targetType === targetType && f.targetId === targetId);
  if (exist) return ok(res, exist);
  const item = { id: 'F-' + Date.now().toString(36), userId, targetType, targetId, title: title || '', summary: summary || '', createdAt: new Date().toISOString() };
  db.favorites.unshift(item);
  persist.favorites();
  ok(res, item);
});
app.delete('/api/favorites/:id', (req, res) => {
  const i = db.favorites.findIndex((f) => f.id === req.params.id);
  if (i >= 0) { db.favorites.splice(i, 1); persist.favorites(); }
  ok(res, { id: req.params.id });
});

app.post('/api/feedback', (req, res) => {
  const { type = '功能建议', content = '', contact = '', page = '' } = req.body || {};
  if (!content.trim()) return fail(res, 400, '请填写意见内容');
  const item = { id: 'FB-' + Date.now().toString(36), type, content, contact: contact ? maskPhone(contact) : '', page, createdAt: new Date().toISOString(), status: '已受理' };
  db.feedback.unshift(item);
  persist.feedback();
  ok(res, item);
});
app.get('/api/feedback', (req, res) => ok(res, db.feedback));

app.post('/api/qa/feedback', (req, res) => {
  const { helpful, policyId } = req.body || {};
  ok(res, { policyId, helpful: !!helpful, message: '感谢反馈，我们会持续优化答案' });
});

/* ------------------------- 基础数据管理（管理员） ------------------------- */
app.post('/api/points', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const p = req.body || {};
  if (!p.name) return fail(res, 400, '名称必填');
  const item = { id: 'SP-' + Date.now().toString(36), lat: Number(p.lat) || 30.235, lng: Number(p.lng) || 120.1155, type: p.type || '便民服务', services: p.services || '', address: p.address || '', hours: p.hours || '08:30-17:00', phone: p.phone || '', name: p.name };
  db.points.push(item); persist.points(); ok(res, item);
});
app.put('/api/points/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const p = db.points.find((x) => x.id === req.params.id);
  if (!p) return fail(res, 404, '网点不存在');
  Object.assign(p, req.body || {}, { id: p.id });
  persist.points(); ok(res, p);
});
app.delete('/api/points/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const i = db.points.findIndex((x) => x.id === req.params.id);
  if (i >= 0) { db.points.splice(i, 1); persist.points(); }
  ok(res, { id: req.params.id });
});

app.post('/api/notices', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const b = req.body || {};
  if (!b.title) return fail(res, 400, '标题必填');
  const item = { id: 'N-' + Date.now().toString(36), title: b.title, category: b.category || '本地通知', summary: b.summary || '', content: b.content || b.summary || '', publishAt: new Date().toISOString().slice(0, 10), important: !!b.important, views: 0 };
  db.notices.unshift(item); persist.notices(); ok(res, item);
});
app.delete('/api/notices/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const i = db.notices.findIndex((x) => x.id === req.params.id);
  if (i >= 0) { db.notices.splice(i, 1); persist.notices(); }
  ok(res, { id: req.params.id });
});

/** 后台：农户基础信息维护（仅允许维护状态与联系电话，避免触碰敏感字段） */
app.patch('/api/households/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const h = db.households.find((x) => x.id === req.params.id);
  if (!h) return fail(res, 404, '农户不存在');
  const { houseStatus, members, care } = req.body || {};
  if (houseStatus) {
    const opts = (S.SCHEMAS.households.fields.find((f) => f.key === 'houseStatus') || {}).options || [];
    if (opts.indexOf(houseStatus) < 0) return fail(res, 400, `房屋状态“${houseStatus}”不在可选范围内（${opts.join(' / ')}）`);
    // 标记搬迁/拆除属于「退出台账」，不物理删除，只打标记并留时间戳，便于追溯
    if (S.RETIRED_STATUSES.indexOf(houseStatus) >= 0 && S.RETIRED_STATUSES.indexOf(h.houseStatus) < 0) {
      h.retiredAt = new Date().toISOString().slice(0, 10);
    }
    if (S.RETIRED_STATUSES.indexOf(houseStatus) < 0) delete h.retiredAt;
    h.houseStatus = houseStatus;
  }
  if (typeof members === 'number' && members > 0 && members < 20) h.members = members;
  if (care) h.care = care;
  h.updatedAt = new Date().toISOString().slice(0, 10);
  writeJson(path.join(DATA, 'households.json'), db.households);
  ok(res, publicHousehold(h));
});

/* ------------------------- 录入模板与批量导入 ------------------------- */
/** 可录入的数据类型清单 */
app.get('/api/schema', (req, res) => ok(res, S.entityList()));
/** 单个类型的字段定义（前端据此渲染表单与模板说明） */
app.get('/api/schema/:entity', (req, res) => {
  const d = S.describe(req.params.entity);
  if (!d) return fail(res, 404, '未知的数据类型：' + req.params.entity);
  ok(res, d);
});
/** CSV 模板下载（含 BOM，Excel 直接打开不乱码） */
app.get('/api/template/csv/:entity', (req, res) => {
  const csv = S.toCsv(req.params.entity);
  if (!csv) return fail(res, 404, '未知的数据类型：' + req.params.entity);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  const fname = S.SCHEMAS[req.params.entity].label + '-录入模板.csv';
  res.set('Content-Disposition', `attachment; filename="template.csv"; filename*=UTF-8''${encodeURIComponent(fname)}`);
  res.send(csv);
});
app.get('/api/template/:entity', (req, res) => {
  const d = S.describe(req.params.entity);
  if (!d) return fail(res, 404, '未知的数据类型：' + req.params.entity);
  ok(res, { entity: d.entity, label: d.label, csv: S.toCsv(req.params.entity), fields: d.fields });
});

/** 文本批量导入：支持从 Excel/CSV 直接粘贴，mode=validate 仅校验，mode=commit 写入
 *  strategy=merge（默认，追加并按唯一键去重）/ replace（整表覆盖，覆盖前自动归档）
 */
app.post('/api/import/:entity', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '批量导入需管理员权限');
  const entity = req.params.entity;
  if (!S.SCHEMAS[entity]) return fail(res, 404, '未知的数据类型：' + entity);
  const { text = '', rows = null, mode = 'validate', strategy = 'merge' } = req.body || {};
  const replace = strategy === 'replace';
  let list = Array.isArray(rows) ? rows : S.parseText(entity, text);
  if (!list.length) return fail(res, 400, '没有解析到数据行，请检查是否包含表头');

  const store = db[entity] || [];
  const uniqueKey = S.SCHEMAS[entity].uniqueKey;
  const seen = new Set();
  const results = list.map((raw, i) => {
    const { errors, warnings, value } = S.validateRow(entity, raw);
    const uv = String(value[uniqueKey] || '').trim();
    if (!errors.length && uv) {
      if (seen.has(uv)) errors.push({ key: uniqueKey, label: uniqueKey, msg: '本次导入中该值重复' });
      else seen.add(uv);
    }
    if (!errors.length && !replace) {
      const exist = store.find((x) => String(x[uniqueKey]) === uv);
      if (exist) errors.push({ key: uniqueKey, label: uniqueKey, msg: `库中已存在「${uv}」，请勿重复导入（如需整表替换请勾选「覆盖导入」）` });
    }
    return { index: i + 1, line: raw._line || i + 2, ok: errors.length === 0, errors, warnings, value: S.normalize(entity, value) };
  });

  const valid = results.filter((r) => r.ok);
  const summary = {
    entity, total: results.length, valid: valid.length, invalid: results.length - valid.length,
    mode, strategy: replace ? 'replace' : 'merge',
  };

  if (mode !== 'commit' || !valid.length) {
    if (replace && mode === 'commit' && !valid.length) return fail(res, 400, '覆盖导入被拒绝：没有任何一行通过校验，为避免清空台账已终止操作');
    return ok(res, Object.assign(summary, { results, imported: 0 }));
  }

  // 覆盖模式：先归档，再清空，最后写入（任何一步出错都不会留下半截数据）
  let archived = null;
  let replacedCount = 0;
  if (replace) {
    archived = archiveEntity(entity);
    replacedCount = store.length;
    if (entity === 'households') backupHouseholds();
    while (store.length) store.pop();
  }

  // 写入：按类型生成 id 并落盘
  let imported = 0;
  valid.forEach((r) => {
    const v = r.value;
    if (entity === 'households') {
      if (!replace) backupHouseholds();
      db.households.push(Object.assign({
        id: v.houseNo, phone: '138****0000', tags: [], updatedAt: new Date().toISOString().slice(0, 10),
        lat: Number(v.lat) || 30.235, lng: Number(v.lng) || 120.1155,
      }, v, { id: v.houseNo, houseNo: v.houseNo }));
      imported++;
    } else if (entity === 'points') {
      db.points.push(Object.assign({ id: 'SP-' + Date.now().toString(36) + imported, services: '', phone: '' }, v));
      imported++;
    } else if (entity === 'cameras') {
      const seq = db.cameras.length + 1;
      db.cameras.push(Object.assign({
        id: 'CAM-' + String(seq).padStart(2, '0'), channel: 'CH' + String(seq).padStart(2, '0'),
        fov: 55, storageDays: 30, note: '', snapUrl: '',
      }, v, { snapUrl: '' }));
      imported++;
    } else if (entity === 'notices') {
      db.notices.unshift(Object.assign({ id: 'N-' + Date.now().toString(36) + imported, views: 0, content: v.summary || '' },
        v, { publishAt: v.publishAt || new Date().toISOString().slice(0, 10) }));
      imported++;
    } else if (entity === 'events') {
      db.events.push(Object.assign({ id: 'EV-' + Date.now().toString(36) + imported }, v, { status: v.status || '待处置' }));
      imported++;
    }
  });
  if (entity === 'households') persist.households();
  if (entity === 'points') persist.points();
  if (entity === 'cameras') persist.cameras();
  if (entity === 'notices') persist.notices();
  if (entity === 'events') persist.events();

  ok(res, Object.assign(summary, {
    results, imported, replaced: replacedCount,
    archived: archived ? path.basename(archived) : null,
  }));
});

/** 单条新增农户（录入页使用） */
app.post('/api/households', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const { errors, value } = S.validateRow('households', req.body || {});
  if (errors.length) return fail(res, 400, errors[0].msg);
  if (db.households.some((h) => h.houseNo === value.houseNo)) return fail(res, 400, '户号已存在：' + value.houseNo);
  backupHouseholds();
  const item = Object.assign({
    id: value.houseNo, ownerKey: String(value.owner || '').charAt(0), phone: '138****0000',
    tags: [], updatedAt: new Date().toISOString().slice(0, 10),
  }, value, { lat: Number(value.lat) || 30.235, lng: Number(value.lng) || 120.1155 });
  db.households.push(item);
  persist.households();
  ok(res, publicHousehold(item));
});

app.get('/api/admin/summary', (req, res) => {
  ok(res, {
    households: db.households.length, points: db.points.length, notices: db.notices.length,
    events: db.events.length, feedback: db.feedback.length, favorites: db.favorites.length,
    accessLog: db.accessLog.length, role: roleOf(req),
  });
});

app.post('/api/admin/reset', (req, res) => {
  db.feedback = []; db.favorites = []; db.accessLog = [];
  persist.feedback(); persist.favorites(); persist.accessLog();
  ok(res, { reset: true });
});

/** 还原农户台账到首次录入前的备份（演示环境用于清理录入数据） */
app.post('/api/admin/restore-households', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限');
  const bak = path.join(RUNTIME, 'households.backup.json');
  if (!fs.existsSync(bak)) return fail(res, 404, '未找到台账备份，可能尚未录入过农户数据');
  db.households = readJson(bak, []);
  writeJson(path.join(DATA, 'households.json'), db.households);
  ok(res, { restored: true, count: db.households.length });
});

/* ------------------------- 地图服务接入配置 ------------------------- */
/** 底图配置：支持环境变量注入 key，未配置的服务标记为不可用 */
app.get('/api/map/config', (req, res) => {
  const cfg = readJson(path.join(DATA, 'map-providers.json'), { providers: [] });
  const resolve = (u) => String(u || '').replace(/\$\{([A-Z0-9_]+)\}/g, (_, k) => process.env[k] || '');
  const providers = cfg.providers.map((p) => {
    const keyOk = !p.needKey || (p.url.match(/\$\{([A-Z0-9_]+)\}/g) || []).every((m) => {
      const k = m.slice(2, -1);
      return !!process.env[k];
    });
    return {
      id: p.id, name: p.name, short: p.short || p.name, group: p.group, crs: p.crs || 'wgs84',
      url: resolve(p.url), annoUrl: p.annoUrl ? resolve(p.annoUrl) : '',
      options: p.options || {}, needKey: !!p.needKey, desc: p.desc || '',
      enabled: !!p.enabled, available: !!p.enabled && keyOk,
      keyConfigured: keyOk,
    };
  });
  const envDefault = process.env.MAP_PROVIDER;
  let current = providers.find((p) => p.id === envDefault && p.available);
  if (!current) current = providers.find((p) => p.available && p.group === (cfg.defaultGroup || 'satellite'));
  if (!current) current = providers.find((p) => p.available);
  ok(res, {
    defaultGroup: cfg.defaultGroup || 'satellite',
    current: current ? current.id : null,
    providers,
    crs: { logical: 'wgs84', note: '业务点位统一按 WGS84 存储；底图为 GCJ02 时前端自动纠偏。' },
    env: cfg.env || {},
  });
});

/* ------------------------- 静态资源 ------------------------- */
app.use('/vendor/leaflet', express.static(path.join(ROOT, 'node_modules', 'leaflet', 'dist')));
app.use(express.static(path.join(ROOT, 'public')));

app.use('/api', (req, res) => fail(res, 404, '接口不存在'));

const PORT = process.env.PORT || 5178;
app.listen(PORT, () => {
  console.log('');
  console.log('  智慧乡村 · 原型服务已启动');
  console.log('  管理端  http://localhost:' + PORT + '/web/');
  console.log('  小程序  http://localhost:' + PORT + '/app/');
  console.log('  接口    http://localhost:' + PORT + '/api/overview');
  console.log('');
});
