/**
 * 智慧乡村地图与便民助手 —— 原型后端（演示用）
 * 纯本地 JSON 数据 + 内存状态，不连接任何真实业务系统。
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

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
};

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
    alerts: db.events.slice().sort((a, b) => String(b.reportedAt).localeCompare(String(a.reportedAt))).slice(0, 5),
    eventCount: { pending: db.events.filter((e) => e.status === '待处置').length, done: db.events.filter((e) => e.status === '已处置').length },
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
  ok(res, {
    total: db.households.length,
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
app.get('/api/cameras', (req, res) => ok(res, db.cameras));
app.get('/api/events', (req, res) => {
  const { status = '' } = req.query;
  let list = db.events;
  if (status) list = list.filter((e) => e.status === status);
  ok(res, list);
});
app.patch('/api/events/:id', (req, res) => {
  if (roleOf(req) !== 'admin') return fail(res, 403, '无操作权限，事件状态需管理员确认');
  const e = db.events.find((x) => x.id === req.params.id);
  if (!e) return fail(res, 404, '事件不存在');
  if (req.body && req.body.status) e.status = req.body.status;
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
  if (houseStatus) h.houseStatus = houseStatus;
  if (typeof members === 'number' && members > 0 && members < 20) h.members = members;
  if (care) h.care = care;
  h.updatedAt = new Date().toISOString().slice(0, 10);
  writeJson(path.join(DATA, 'households.json'), db.households);
  ok(res, publicHousehold(h));
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
