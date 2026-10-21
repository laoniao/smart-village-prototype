/* 智慧乡村治理平台 —— 前端交互（演示版） */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const state = {
    role: 'admin',
    page: 'overview',
    base: 'satellite',
    data: { households: [], points: [], cameras: [], events: [], notices: [], villages: [], stats: null },
    filter: { status: '', keyword: '', care: false, quick: 'all' },
    layers: { households: true, points: true, cameras: true, events: true, boundary: true },
    selected: null,
    adminTab: 'households',
    adminPage: 1,
    adminSearch: '',
    chat: [],
  };

  /* ---------------- 基础请求 ---------------- */
  async function api(url, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json', 'x-role': state.role, 'x-user': 'demo-user' }, opts.headers || {});
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    const json = await res.json();
    if (json.code !== 0) {
      const err = new Error(json.message || '请求失败');
      err.code = json.code;
      throw err;
    }
    return json.data;
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('#toastRoot').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 1900);
    setTimeout(() => el.remove(), 2300);
  }

  /* ---------------- 图标 ---------------- */
  const icons = {
    home: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    users: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 20c0-3.4 2.8-5.4 6.2-5.4s6.2 2 6.2 5.4"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.2M18 14.8c2.2.5 3.6 2.1 3.6 5.2"/></svg>',
    camera: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5h11l3-2v11l-3-2H3z"/><circle cx="7.5" cy="12" r="1.4"/><path d="M20 6v12"/></svg>',
    alert: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    star: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7L12 3Z"/></svg>',
    pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    cam: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5h11l3-2v11l-3-2H3z"/></svg>',
    phone: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h3.3l1.6 4-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 4 1.6V17a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.2 2 2 0 0 1 5 3Z"/></svg>',
    id: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M13 10h5M13 14h5M5.5 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4"/></svg>',
    group: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.7-4.6 6-4.6s6 1.6 6 4.6"/><path d="M16 5.5a3 3 0 0 1 0 5.6"/></svg>',
    lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
    doc: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
  };

  /* ---------------- 导航 ---------------- */
  function goPage(page) {
    state.page = page;
    $$('.nav-item').forEach((b) => b.classList.toggle('on', b.dataset.page === page));
    $$('.page').forEach((p) => p.classList.add('hidden'));
    const el = $('#page-' + page);
    el.classList.remove('hidden');
    if (page === 'overview' && ovMap) setTimeout(() => ovMap.invalidateSize(), 60);
    if (page === 'households') {
      if (!hhMap) initHouseholds().then(() => setTimeout(() => hhMap && hhMap.invalidateSize(), 60));
      else setTimeout(() => hhMap.invalidateSize(), 60);
    }
    if (page === 'admin') renderAdmin();
    if (page === 'qa') scrollChat();
  }
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => goPage(b.dataset.page)));
  $('#toHouseholds').addEventListener('click', () => goPage('households'));
  $('#toAdmin').addEventListener('click', () => { state.adminTab = 'events'; goPage('admin'); syncAdminTabs(); });

  /* ---------------- 角色切换 ---------------- */
  $$('#roleSwitch button').forEach((b) => b.addEventListener('click', () => {
    state.role = b.dataset.role;
    $$('#roleSwitch button').forEach((x) => x.classList.toggle('on', x === b));
    $('#roleName').textContent = state.role === 'admin' ? '系统管理员' : '网格员';
    $('#adminRoleBadge').textContent = '当前角色：' + (state.role === 'admin' ? '管理员' : '网格员');
    $('#adminRoleBadge').className = 'badge ' + (state.role === 'admin' ? 'ok' : 'warn');
    if (state.selected) openHousehold(state.selected.id);
    renderAdmin();
    toast(state.role === 'admin' ? '已切换为管理员：可查看完整台账、维护基础数据' : '已切换为网格员：仅可查看脱敏信息');
  }));

  /* ---------------- 概览 ---------------- */
  let ovMap = null, ovLayers = null;

  function renderStats(stats, overview) {
    const items = [
      { ic: 'home', cls: 'blue', label: '总户数', value: stats.households, unit: '户', trend: '+' + stats.householdsDelta + '%', trendCls: 'up', tip: '较上月' },
      { ic: 'users', cls: 'cyan', label: '常住人口', value: stats.population, unit: '人', trend: '+' + stats.populationDelta + '%', trendCls: 'up', tip: '较上月' },
      { ic: 'camera', cls: 'green', label: '摄像头在线', value: overview.cameraOnline, unit: '/ ' + overview.cameraTotal + ' 个', trend: '在线率 ' + stats.cameraOnlineRate + '%', trendCls: '', tip: '' },
      { ic: 'alert', cls: 'orange', label: '待处置事件', value: stats.pendingEvents, unit: '件', trend: '+33.3%', trendCls: 'up', tip: '较昨日' },
    ];
    $('#statRow').innerHTML = items.map((i) => `
      <div class="stat">
        <div class="ic ${i.cls}">${icons[i.ic]}</div>
        <div>
          <div class="num">${i.value}<small>${i.unit}</small>
            ${i.trend ? `<span class="trend ${i.trendCls}">${i.trend}</span>` : ''}
          </div>
          <div class="lb">${i.label}${i.tip ? ' · ' + i.tip : ''}</div>
        </div>
      </div>`).join('');
  }

  function renderAlerts(alerts) {
    const cls = { 待处置: 'pending', 已处置: 'done' };
    $('#alertList').innerHTML = alerts.map((a, i) => `
      <div class="alert">
        <div class="tag ${i === 0 ? 'red' : i === 1 ? 'orange' : 'blue'}">${a.category.slice(0, 1)}</div>
        <div class="txt"><b>${a.title}</b><p>${a.desc}</p></div>
        <div class="meta"><div class="tm">${a.reportedAt.slice(5, 10)} ${a.reportedAt.slice(11)}</div>
          <span class="st ${cls[a.status] || 'pending'}">${a.status}</span></div>
      </div>`).join('') || '<div class="no-doc">暂无预警</div>';
  }

  async function initOverview() {
    const ov = await api('/api/overview');
    state.data.stats = ov.stats;
    state.data.villages = ov.villages;
    renderStats(ov.stats, ov);
    renderAlerts(ov.alerts);
    renderCharts(ov.stats.monthly);
    drawOverviewMap(ov);
    const [points, cameras, events, notices] = await Promise.all([
      api('/api/service-points'), api('/api/cameras'), api('/api/events'), api('/api/notices'),
    ]);
    state.data.points = points;
    state.data.cameras = cameras;
    state.data.events = events;
    state.data.notices = notices;
    drawOverviewOverlays();
  }

  function drawOverviewMap(ov) {
    if (ovMap) { ovMap.remove(); ovMap = null; }
    ovMap = MapKit.create('ovMap', { center: ov.village.center, zoom: 15 });
    ovLayers = { boundary: L.layerGroup().addTo(ovMap), points: L.layerGroup().addTo(ovMap), cameras: L.layerGroup().addTo(ovMap), events: L.layerGroup().addTo(ovMap) };
    drawOverviewOverlays();
    setTimeout(() => {
      const b = L.latLngBounds(ov.village.boundary.map((p) => [p[0], p[1]]));
      ovMap.fitBounds(b, { padding: [28, 28] });
    }, 80);
  }

  function drawOverviewOverlays() {
    if (!ovMap || !ovLayers) return;
    const { villages, points, cameras, events } = state.data;
    ovLayers.boundary.clearLayers(); ovLayers.points.clearLayers();
    ovLayers.cameras.clearLayers(); ovLayers.events.clearLayers();

    (villages || []).forEach((v) => {
      const latlngs = v.boundary.map((p) => [p[0], p[1]]);
      L.polygon(latlngs, {
        color: v.isMain ? '#17a673' : '#2f7cf6',
        weight: v.isMain ? 2 : 1.4,
        opacity: v.isMain ? 0.95 : 0.6,
        fillColor: v.isMain ? '#17a673' : '#2f7cf6',
        fillOpacity: v.isMain ? 0.07 : 0.04,
        dashArray: v.isMain ? null : '4 4',
      }).addTo(ovLayers.boundary).bindTooltip(v.name, { permanent: false, direction: 'center', className: 'v-label' });
      const c = [v.center[0], v.center[1]];
      L.marker(c, {
        icon: L.divIcon({
          className: 'v-pin', iconSize: [12, 12], iconAnchor: [6, 6],
          html: `<span style="display:block;width:10px;height:10px;border-radius:50%;background:${v.isMain ? '#17a673' : '#3b82f6'};box-shadow:0 0 0 3px rgba(255,255,255,.85)"></span>`,
        }),
      }).addTo(ovLayers.boundary)
        .bindTooltip(v.name + ' · ' + v.households + ' 户', {
          permanent: true, direction: 'top', offset: [0, -6],
          className: 'v-tip',
        });
    });

    (points || []).forEach((p) => {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: 'sp-icon', iconSize: [16, 16], iconAnchor: [8, 8], html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:#17a673;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></span>` }),
      }).addTo(ovLayers.points).bindTooltip(p.name + ' · ' + p.type, { direction: 'top', offset: [0, -8] });
    });

    (cameras || []).forEach((c) => {
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({ className: 'cam-icon', iconSize: [14, 14], iconAnchor: [7, 7], html: `<span style="display:grid;place-items:center;width:14px;height:14px;border-radius:3px;background:#334155;color:#fff;font-size:8px;box-shadow:0 1px 4px rgba(0,0,0,.35)">▣</span>` }),
      }).addTo(ovLayers.cameras).bindTooltip('摄像头 · ' + c.name, { direction: 'top', offset: [0, -8] });
    });

    (events || []).forEach((e) => {
      const color = e.status === '待处置' ? '#e0475f' : '#94a3b8';
      L.marker([e.lat, e.lng], {
        icon: L.divIcon({ className: 'ev-icon', iconSize: [16, 16], iconAnchor: [8, 8], html: `<span style="display:block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:12px solid ${color};filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"></span>` }),
      }).addTo(ovLayers.events).bindTooltip(e.title + ' · ' + e.status, { direction: 'top', offset: [0, -10] });
    });
  }

  $('#ovZoomIn').addEventListener('click', () => ovMap && ovMap.zoomIn());
  $('#ovZoomOut').addEventListener('click', () => ovMap && ovMap.zoomOut());
  $('#ovFull').addEventListener('click', () => {
    const el = $('#ovMap');
    if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
    else document.exitFullscreen();
    setTimeout(() => ovMap && ovMap.invalidateSize(), 300);
  });
  $('#refreshOverview').addEventListener('click', async () => { await initOverview(); toast('数据已刷新（演示数据）'); });

  /* ---------------- 图表（原生 SVG） ---------------- */
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
    const n = (v || 1) / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  function axisFrame(w, h, labels, max, min, pad) {
    const l = pad.l, r = pad.r, t = pad.t, b = pad.b;
    const ih = h - t - b, iw = w - l - r;
    let grid = '', yl = '';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = t + ih - (ih * i) / steps;
      const val = min + ((max - min) * i) / steps;
      grid += `<line x1="${l}" y1="${y}" x2="${w - r}" y2="${y}" stroke="#eef2f8" stroke-width="1"/>`;
      yl += `<text x="${l - 6}" y="${y + 3}" text-anchor="end" class="chart-axis">${Math.round(val).toLocaleString()}</text>`;
    }
    let xl = '';
    labels.forEach((s, i) => {
      const x = l + (iw * i) / (labels.length - 1);
      xl += `<text x="${x}" y="${h - 6}" text-anchor="middle" class="chart-axis">${s}</text>`;
    });
    return { l, r, t, b, ih, iw, grid, yl, xl };
  }
  function lineChart(el, labels, series) {
    const w = 420, h = 186, pad = { l: 38, r: 12, t: 12, b: 22 };
    const all = series.flatMap((s) => s.data);
    const max = niceMax(Math.max(...all) * 1.12), min = 0;
    const f = axisFrame(w, h, labels, max, min, pad);
    const x = (i) => f.l + (f.iw * i) / (labels.length - 1);
    const y = (v) => f.t + f.ih - ((v - min) / (max - min)) * f.ih;
    let body = '';
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      if (si === 0) {
        body += `<defs><linearGradient id="g${s.key}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${s.color}" stop-opacity=".22"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
        </linearGradient></defs>`;
        body += `<polygon points="${x(0)},${f.t + f.ih} ${pts} ${x(labels.length - 1)},${f.t + f.ih}" fill="url(#g${s.key})"/>`;
      }
      body += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      s.data.forEach((v, i) => { body += `<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="#fff" stroke="${s.color}" stroke-width="1.8"/>`; });
    });
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}">${f.grid}${f.yl}${f.xl}${body}</svg>`;
  }
  function barChart(el, labels, series, opts = {}) {
    const w = 420, h = 186, pad = { l: 38, r: opts.dual ? 34 : 12, t: 12, b: 22 };
    const s0 = series[0], s1 = series[1];
    const max0 = niceMax(Math.max(...s0.data) * 1.15);
    const max1 = opts.dual ? niceMax(Math.max(...s1.data) * 3.2) : max0;
    const f = axisFrame(w, h, labels, max0, 0, pad);
    const bandW = f.iw / labels.length;
    const bw = Math.min(18, bandW / (series.length + 1.2));
    let body = '';
    labels.forEach((_, i) => {
      const cx = f.l + bandW * i + bandW / 2;
      series.forEach((s, si) => {
        const max = si === 0 ? max0 : max1;
        const bh = (s.data[i] / max) * f.ih;
        const bx = cx - (series.length * (bw + 3)) / 2 + si * (bw + 3);
        body += `<rect x="${bx}" y="${f.t + f.ih - bh}" width="${bw}" height="${Math.max(2, bh)}" rx="3" fill="${s.color}" opacity="${s.opacity || 1}"/>`;
        body += `<title>${s.name} ${labels[i]}：${s.data[i]}</title>`;
      });
    });
    if (opts.dual) {
      let right = '';
      for (let i = 0; i <= 4; i++) {
        const y = f.t + f.ih - (f.ih * i) / 4;
        right += `<text x="${w - f.r + 6}" y="${y + 3}" class="chart-axis">${Math.round((max1 * i) / 4)}</text>`;
      }
      body += right;
    }
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}">${f.grid}${f.yl}${f.xl}${body}</svg>`;
  }
  function renderCharts(monthly) {
    const labels = monthly.map((m) => m.month);
    lineChart($('#chartPop'), labels, [
      { key: 'res', name: '常住人口', color: '#2f7cf6', data: monthly.map((m) => m.resident) },
      { key: 'flo', name: '流动人口', color: '#17a673', data: monthly.map((m) => m.floating) },
    ]);
    barChart($('#chartHouse'), labels, [
      { name: '总户数', color: '#2f7cf6', data: monthly.map((m) => m.households) },
      { name: '新增户数', color: '#f0a020', data: monthly.map((m) => m.newHouseholds) },
    ], { dual: true });
    barChart($('#chartEvent'), labels, [
      { name: '事件总数', color: '#2f7cf6', data: monthly.map((m) => m.events) },
      { name: '待处置', color: '#e0475f', data: monthly.map((m) => m.pending) },
    ]);
  }

  /* ---------------- 村户一张图 ---------------- */
  let hhMap = null, hhLoading = null;
  const hhLayers = {};
  const hp = (lat, lng) => MapKit.P(lat, lng, hhMap ? hhMap.useGcj : false);

  function initHouseholds() {
    if (hhMap) return Promise.resolve();
    if (hhLoading) return hhLoading;
    hhLoading = buildHouseholdMap().finally(() => { hhLoading = null; });
    return hhLoading;
  }

  async function buildHouseholdMap() {
    const [list, points, cameras, events] = await Promise.all([
      api('/api/households?size=600'), api('/api/service-points'), api('/api/cameras'), api('/api/events'),
    ]);
    state.data.households = list.rows;
    state.data.points = points;
    state.data.cameras = cameras;
    state.data.events = events;
    const main = state.data.villages.find((v) => v.isMain) || { center: [30.235, 120.1155], boundary: [] };

    hhMap = MapKit.create('hhMap', { center: main.center, zoom: 17 });
    hhLayers.boundary = L.layerGroup().addTo(hhMap);
    hhLayers.households = L.layerGroup().addTo(hhMap);
    hhLayers.points = L.layerGroup().addTo(hhMap);
    hhLayers.cameras = L.layerGroup().addTo(hhMap);
    hhLayers.events = L.layerGroup().addTo(hhMap);
    hhLayers.highlight = L.layerGroup().addTo(hhMap);

    renderMiniStats(list);
    renderHouseholds();
    renderPointLayers();
    renderBoundary();
    hhMap.setView(hp(main.center[0], main.center[1]), 17, { animate: false });
    hhMap.on('zoomend', () => renderHouseholds());
    setTimeout(() => hhMap.invalidateSize(), 100);
  }

  function renderMiniStats(list) {
    const stats = {
      total: list.total,
      resident: state.data.stats ? state.data.stats.population : 672,
      out: state.data.stats ? state.data.stats.outflow : 156,
      care: list.rows.filter((h) => h.care !== '无').length,
      points: state.data.points.length,
    };
    $('#hhMini').innerHTML = `
      <div class="m"><div class="v">${stats.total}<em>户</em></div><div class="k">总户数</div></div>
      <div class="m"><div class="v">${stats.resident}<em>人</em></div><div class="k">常住人口</div></div>
      <div class="m"><div class="v">${stats.out}<em>人</em></div><div class="k">外出人口</div></div>
      <div class="m"><div class="v">${stats.care}<em>户</em></div><div class="k">重点关怀</div></div>
      <div class="m" style="grid-column:span 2"><div class="v">${stats.points}<em>个</em></div><div class="k">服务网点（图上可点）</div></div>`;
  }

  function currentHouseholds() {
    const f = state.filter;
    return state.data.households.filter((h) => {
      if (f.status && h.houseStatus !== f.status) return false;
      if (f.care && h.care === '无') return false;
      if (f.quick === '待核查' && h.houseStatus !== '待核查') return false;
      if (f.quick === '闲置' && h.houseStatus !== '闲置') return false;
      if (f.quick === 'care' && h.care === '无') return false;
      if (f.keyword) {
        const k = f.keyword.trim();
        if (!(h.houseNo.includes(k) || h.owner.includes(k) || h.address.includes(k) || h.group.includes(k))) return false;
      }
      return true;
    });
  }

  function renderHouseholds() {
    if (!hhMap) return;
    hhLayers.households.clearLayers();
    const list = currentHouseholds();
    const z = hhMap.getZoom();
    const baseR = z >= 18 ? 6 : z >= 17 ? 4.2 : 3;
    list.forEach((h) => {
      const care = h.care !== '无';
      const m = L.circleMarker(hp(h.lat, h.lng), {
        radius: state.filter.keyword ? baseR + 1.6 : baseR,
        color: care ? '#e0475f' : '#ffffff',
        weight: care ? 2 : 1,
        fillColor: MapKit.householdColor(h.houseStatus),
        fillOpacity: 1,
        opacity: 1,
      });
      m.bindTooltip(`<b>${h.houseNo}</b> · ${h.owner}<br>${h.group} · ${h.address.replace('示范村', '')}`, { direction: 'top', offset: [0, -4], className: 'hh-tip' });
      m.on('click', () => openHousehold(h.id));
      m.addTo(hhLayers.households);
    });
    $('#cntH').textContent = list.length;
    $('#scaleHint').textContent = '当前显示 ' + list.length + ' 户' + (state.filter.status ? ' · ' + state.filter.status : '') + (state.filter.keyword ? ' · 关键词“' + state.filter.keyword + '”' : '');
  }

  function renderPointLayers() {
    if (!hhMap) return;
    hhLayers.points.clearLayers();
    hhLayers.cameras.clearLayers();
    hhLayers.events.clearLayers();
    state.data.points.forEach((p) => {
      L.marker(hp(p.lat, p.lng), {
        icon: L.divIcon({
          className: '', iconSize: [22, 22], iconAnchor: [11, 11],
          html: `<span style="display:grid;place-items:center;width:20px;height:20px;border-radius:6px;background:#17a673;color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${icons.star}</span>`,
        }),
      }).addTo(hhLayers.points)
        .bindTooltip(p.name, { direction: 'top', offset: [0, -12] })
        .on('click', () => toast(p.name + ' · ' + p.hours + ' · ' + p.phone));
    });
    state.data.cameras.forEach((c) => {
      L.marker(hp(c.lat, c.lng), {
        icon: L.divIcon({
          className: '', iconSize: [16, 16], iconAnchor: [8, 8],
          html: `<span style="display:grid;place-items:center;width:15px;height:15px;border-radius:4px;background:${c.status === 'online' ? '#334155' : '#94a3b8'};color:#fff;border:1.5px solid #fff">${icons.cam}</span>`,
        }),
      }).addTo(hhLayers.cameras).bindTooltip('摄像头 · ' + c.name + (c.status === 'online' ? '' : '（离线）'), { direction: 'top', offset: [0, -8] });
    });
    state.data.events.forEach((e) => {
      L.marker(hp(e.lat, e.lng), {
        icon: L.divIcon({
          className: '', iconSize: [18, 18], iconAnchor: [9, 14],
          html: `<span style="display:block;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:13px solid ${e.status === '待处置' ? '#e0475f' : '#94a3b8'};filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"></span>`,
        }),
      }).addTo(hhLayers.events).bindTooltip(e.title + ' · ' + e.status, { direction: 'top', offset: [0, -12] });
    });
  }

  function renderBoundary() {
    if (!hhMap) return;
    hhLayers.boundary.clearLayers();
    const main = state.data.villages.find((v) => v.isMain);
    if (!main) return;
    L.polygon(main.boundary.map((p) => hp(p[0], p[1])), {
      color: '#17a673', weight: 2, dashArray: '6 4', fillColor: '#17a673', fillOpacity: 0.04,
    }).addTo(hhLayers.boundary).bindTooltip('示范村村域范围（示意）', { sticky: true });
  }

  function fitVillage() {
    const main = state.data.villages.find((v) => v.isMain);
    if (!main || !hhMap) return;
    const b = L.latLngBounds(main.boundary.map((p) => hp(p[0], p[1])));
    hhMap.fitBounds(b, { padding: [26, 26] });
  }

  function refreshOverlays() {
    renderBoundary();
    renderHouseholds();
    renderPointLayers();
    if (state.selected) openHousehold(state.selected.id, true);
  }

  /* 图层显隐 */
  $$('#layerList .layer-item').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.layer;
      const on = !el.querySelector('.box').classList.contains('on');
      el.querySelector('.box').classList.toggle('on', on);
      state.layers[key] = on;
      if (!hhMap) return;
      if (on) hhLayers[key].addTo(hhMap); else hhMap.removeLayer(hhLayers[key]);
    });
  });

  /* 快速筛选 */
  $$('[data-quick]').forEach((b) => b.addEventListener('click', () => {
    state.filter.quick = b.dataset.quick;
    state.filter.care = b.dataset.quick === 'care';
    state.filter.status = ['待核查', '闲置'].includes(b.dataset.quick) ? b.dataset.quick : '';
    state.filter.keyword = '';
    $('#hhSearch').value = '';
    $$('#hhChips .chip').forEach((c) => c.classList.toggle('on', c.dataset.status === state.filter.status));
    $$('[data-quick]').forEach((x) => x.classList.toggle('btn-on', x === b));
    renderHouseholds();
  }));

  $$('#hhChips .chip').forEach((c) => c.addEventListener('click', () => {
    state.filter.status = c.dataset.status;
    state.filter.quick = 'all';
    $$('#hhChips .chip').forEach((x) => x.classList.toggle('on', x === c));
    renderHouseholds();
  }));

  function doSearch() {
    state.filter.keyword = $('#hhSearch').value.trim();
    renderHouseholds();
    const list = currentHouseholds();
    if (!list.length) { toast('没有匹配的农户，试试户号或户主姓氏'); return; }
    if (list.length === 1) {
      const h = list[0];
      hhMap.flyTo(hp(h.lat, h.lng), 18, { duration: 0.6 });
      openHousehold(h.id);
    } else {
      hhMap.fitBounds(L.latLngBounds(list.map((h) => hp(h.lat, h.lng))), { padding: [50, 50] });
    }
  }
  $('#hhSearchBtn').addEventListener('click', doSearch);
  $('#hhSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  $('#hhZoomIn').addEventListener('click', () => hhMap && hhMap.zoomIn());
  $('#hhZoomOut').addEventListener('click', () => hhMap && hhMap.zoomOut());
  $('#hhReset').addEventListener('click', () => {
    state.filter = { status: '', keyword: '', care: false, quick: 'all' };
    $('#hhSearch').value = '';
    $$('#hhChips .chip').forEach((c, i) => c.classList.toggle('on', i === 0));
    renderHouseholds(); fitVillage(); closeDrawer();
  });
  $('#hhFull').addEventListener('click', () => {
    const el = $('#hhWrap');
    if (!document.fullscreenElement) el.requestFullscreen && el.requestFullscreen();
    else document.exitFullscreen();
    setTimeout(() => hhMap && hhMap.invalidateSize(), 300);
  });

  $$('[data-base]').forEach((b) => b.addEventListener('click', () => switchBase(b.dataset.base)));
  function switchBase(name) {
    if (!hhMap || state.base === name) return;
    state.base = name;
    $$('[data-base]').forEach((b) => b.classList.toggle('on', b.dataset.base === name));
    const main = state.data.villages.find((v) => v.isMain);
    MapKit.setBase(hhMap, name, main ? main.center : null, refreshOverlays);
    if (name === 'vector') toast('已切换矢量底图（已做坐标纠偏）');
  }

  /* 详情抽屉 */
  function closeDrawer() {
    state.selected = null;
    if (hhLayers.highlight) hhLayers.highlight.clearLayers();
    $('#detailDrawer').classList.add('hidden');
    $('#page-households').classList.remove('hh-open-drawer');
    if (hhMap) setTimeout(() => hhMap.invalidateSize(), 200);
  }

  function photoSvg() {
    return `<svg viewBox="0 0 300 128" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe3f7"/><stop offset="1" stop-color="#eaf3fb"/></linearGradient></defs>
      <rect width="300" height="128" fill="url(#sky)"/>
      <path d="M0 86c40-14 62-6 90-16 26-9 40-22 70-20 40 3 70 20 140 14v64H0z" fill="#cfe0c2"/>
      <path d="M0 100c48-10 80 4 120-2 44-6 90-10 180 2v28H0z" fill="#bcd5ab"/>
      <g transform="translate(96 44)">
        <path d="M0 34 54 2l54 32v46H0z" fill="#f5f1e8" stroke="#d9d2c3"/>
        <path d="M-6 36 54 0l60 36" fill="none" stroke="#8a5b45" stroke-width="7" stroke-linecap="round"/>
        <rect x="20" y="46" width="20" height="20" fill="#b9d3e6" stroke="#fff" stroke-width="2"/>
        <rect x="70" y="46" width="20" height="20" fill="#b9d3e6" stroke="#fff" stroke-width="2"/>
        <rect x="46" y="54" width="18" height="26" fill="#8a5b45"/>
      </g>
      <g fill="#8fae7a"><circle cx="30" cy="96" r="13"/><circle cx="52" cy="102" r="10"/><circle cx="264" cy="94" r="12"/></g>
    </svg>`;
  }

  async function openHousehold(id, silent) {
    let h = state.data.households.find((x) => x.id === id);
    if (!h) {
      try { h = await api('/api/households/' + id); } catch (e) { return toast(e.message); }
    }
    state.selected = h;
    if (hhLayers.highlight) {
      hhLayers.highlight.clearLayers();
      L.circleMarker(hp(h.lat, h.lng), { radius: 13, color: '#1d5fd0', weight: 2, fillColor: '#2f7cf6', fillOpacity: 0.16, opacity: 0.9 })
        .addTo(hhLayers.highlight);
    }
    const badge = h.houseStatus === '正常' ? 'ok' : h.houseStatus === '闲置' ? 'idle' : 'warn';
    const drawer = $('#detailDrawer');
    drawer.innerHTML = `
      <div class="drawer-head">
        <h3>农户详细信息</h3>
        <button class="close" id="closeDrawer" title="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="drawer-body">
        <div class="house-photo">${photoSvg()}<span class="ph-tag">住房照片 · 示例</span></div>
        <div class="house-id">
          <b>${h.houseNo}</b>
          <span class="badge ${badge}">${h.houseStatus}</span>
          ${h.care !== '无' ? `<span class="badge care">${h.care}</span>` : ''}
          ${h.tags && h.tags.length ? `<span class="badge ok">${h.tags[0]}</span>` : ''}
        </div>
        <div class="info-grid">
          ${[
            ['户号', h.houseNo, icons.id],
            ['户主', h.owner + '（脱敏）', icons.users],
            ['联系电话', h.phone, icons.phone],
            ['所属组', h.group, icons.group],
            ['家庭成员', h.members + ' 人', icons.users],
            ['房屋状态', h.houseStatus, icons.home],
            ['建房年份', h.builtYear + ' 年', icons.home],
            ['建筑面积', h.area + ' ㎡', icons.home],
            ['详细地址', h.address, icons.pin],
            ['更新日期', h.updatedAt, icons.doc],
          ].map(([k, v, ic]) => `<div class="info-row"><span class="k">${ic}${k}</span><span class="v">${v}</span></div>`).join('')}
        </div>
        <button class="btn primary block" id="viewFull" style="margin-top:12px">${icons.lock} 查看完整台账</button>
        <div class="privacy-note">${icons.lock}
          <span>您当前仅可查看脱敏信息，完整台账需具备“农户台账查看”权限，查看行为将记录审计日志。</span>
        </div>
        <div id="fullProfileBox"></div>
      </div>`;
    drawer.classList.remove('hidden');
    $('#page-households').classList.add('hh-open-drawer');
    $('#closeDrawer').addEventListener('click', closeDrawer);
    $('#viewFull').addEventListener('click', () => loadFull(h));
    if (!silent) {
      hhMap.panInside(hp(h.lat, h.lng), { padding: [80, 80] });
    }
    setTimeout(() => hhMap && hhMap.invalidateSize(), 220);
  }

  async function loadFull(h) {
    try {
      const full = await api('/api/households/' + h.id + '/full');
      $('#fullProfileBox').innerHTML = `
        <div class="full-profile">
          <div class="fp-title">完整台账（管理员权限 · 已记录审计日志）</div>
          <div>身份证号：${full.idCard}</div>
          <div>联系电话：${full.phoneFull}</div>
          <div>宅基地面积：${full.landArea} ㎡ · 建筑面积：${full.area} ㎡</div>
          <div>家庭成员：${full.memberList.map((m) => `${m.name}（${m.relation}，${m.ageBand}岁）`).join('、')}</div>
          <div style="color:#8fa2ba;margin-top:6px">${full.note}</div>
        </div>`;
      const body = $('.drawer-body');
      if (body) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
      toast('已按权限展示完整台账，本次查看已写入审计日志');
    } catch (e) {
      $('#fullProfileBox').innerHTML = `<div class="denied">${icons.lock} ${e.message}<br><br>
        <button class="btn ghost" id="applyPerm" style="height:28px">申请台账查看权限</button></div>`;
      const btn = $('#applyPerm');
      if (btn) btn.addEventListener('click', () => toast('已提交权限申请，请联系乡镇管理员审批（演示）'));
    }
  }

  /* ---------------- 政策问答 ---------------- */
  const qaSamples = ['农机购置补贴怎么申请？', '医保报销比例是多少？', '高龄津贴怎么领？'];
  let chatHistory = [];

  function initQA() {
    $('#topicList').innerHTML = ['全部话题', '农业生产', '民生政务', '医保社保', '乡村建设', '社会救助']
      .map((t, i) => `<div class="topic ${i === 0 ? 'on' : ''}" data-topic="${t === '全部话题' ? '' : t}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>${t}</div>`).join('');
    $$('#topicList .topic').forEach((el) => el.addEventListener('click', () => {
      $$('#topicList .topic').forEach((x) => x.classList.toggle('on', x === el));
      const t = el.dataset.topic;
      if (!t) return;
      const map = { 农业生产: '农机购置补贴怎么申请？', 民生政务: '宅基地申请需要什么条件？', 医保社保: '医保报销比例是多少？', 乡村建设: '村里修路怎么申请？', 社会救助: '高龄津贴怎么申领？' };
      $('#qaInput').value = map[t] || '';
      $('#qaInput').focus();
    }));
    renderDocs([]);
    resetChat();
    $('#qaSend').addEventListener('click', () => sendQuestion($('#qaInput').value));
    $('#qaInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion($('#qaInput').value); }
    });
    $('#qaMic').addEventListener('click', () => startVoice($('#qaInput'), () => sendQuestion($('#qaInput').value)));
    $('#qaHuman').addEventListener('click', () => toast('已为您转接村便民服务站人工坐席（演示）'));
    $('#newChat').addEventListener('click', resetChat);
  }

  function resetChat() {
    chatHistory = [];
    $('#chatBody').innerHTML = '';
    addAIBubble(`您好！我是示范村政策助手。您可以问我惠农补贴、医保社保、宅基地、养老认证等问题，我会按“适用对象、所需材料、办理流程、办理地点、政策依据”为您整理。`, true);
    renderHistory();
    renderDocs([]);
  }

  function renderHistory() {
    const items = chatHistory.slice(0, 8);
    $('#histList').innerHTML = items.length ? items.map((h, i) => `
      <div class="hist-item ${i === 0 ? 'on' : ''}" data-q="${h.q}">
        <b>${h.q}</b><span>今天 ${h.time}</span>
      </div>`).join('') : `<div style="font-size:11.5px;color:#93a1b5;padding:6px 8px">暂无对话记录</div>`;
    $$('#histList .hist-item').forEach((el) => el.addEventListener('click', () => {
      $('#qaInput').value = el.dataset.q;
      $('#qaInput').focus();
    }));
  }

  function addUserBubble(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `<div class="ava">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg>
      </div><div class="bubble">${escapeHtml(text)}</div>`;
    $('#chatBody').appendChild(el);
    scrollChat();
  }
  function addAIBubble(html, withAvatar = true) {
    const el = document.createElement('div');
    el.className = 'msg ai';
    el.innerHTML = `<div class="ava">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="7" width="16" height="12" rx="4"/><circle cx="9" cy="13" r="1.2" fill="currentColor"/><circle cx="15" cy="13" r="1.2" fill="currentColor"/><path d="M12 3v4M8 19v2M16 19v2"/></svg>
      </div><div class="bubble">${html}</div>`;
    $('#chatBody').appendChild(el);
    scrollChat();
    return el;
  }
  function scrollChat() {
    const b = $('#chatBody');
    if (b) b.scrollTop = b.scrollHeight;
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function sendQuestion(text) {
    text = (text || '').trim();
    if (!text) return;
    $('#qaInput').value = ''; $('#qaInput').style.height = '40px';
    addUserBubble(text);
    const typing = addAIBubble(`<span class="typing"><i></i><i></i><i></i></span> 正在检索政策知识库…`);
    let data;
    try { data = await api('/api/qa/ask', { method: 'POST', body: JSON.stringify({ question: text }) }); }
    catch (e) { typing.querySelector('.bubble').textContent = '服务暂时不可用：' + e.message; return; }

    chatHistory.unshift({ q: text, time: new Date().toTimeString().slice(0, 5) });
    renderHistory();

    const a = data.answer;
    const cardHtml = answerCard(a, data);
    const bubble = typing.querySelector('.bubble');
    bubble.innerHTML = `<div>${data.matched ? '为您找到相关政策，整理如下：' : a.summary}</div>${cardHtml}
      <div class="quick-row">${(data.suggestions || []).map((s) => `<button class="quick" data-sug="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>`;
    bindAnswerCard(bubble, a, data);
    renderDocs(data.docs || []);
    scrollChat();
  }

  function answerCard(a, data) {
    if (!data.matched) {
      return `<div class="answer-card"><div class="ac-head"><div class="ic">${icons.doc}</div><b>${a.title}</b></div>
        <div class="ac-body"><div style="font-size:12px;color:#4b6076">建议换个说法，或直接转人工咨询。</div></div></div>`;
    }
    const li = (arr) => arr.map((x) => `<div class="li">${escapeHtml(x)}</div>`).join('');
    return `<div class="answer-card">
      <div class="ac-head">
        <div class="ic">${icons.doc}</div>
        <b>${escapeHtml(a.title)}</b>
        <span class="conf">匹配度 ${(data.confidence * 100).toFixed(0)}%</span>
      </div>
      <div class="ac-body">
        <div class="ac-row"><span class="k">适用对象</span><span class="v">${li(a.applyTo)}</span></div>
        <div class="ac-row"><span class="k">所需材料</span><span class="v">${li(a.materials)}</span></div>
        <div class="ac-row"><span class="k">办理流程</span><span class="v">${a.steps.map((s, i) => `<div class="li">${i + 1}. ${escapeHtml(s)}</div>`).join('')}</span></div>
        <div class="ac-row"><span class="k">办理地点</span><span class="v">${escapeHtml(a.place)}${a.placePending ? '<span class="pending-tag">待确认</span>' : ''}</span></div>
        <div class="ac-row"><span class="k">政策依据</span><span class="v">${li(a.basis)}</span></div>
      </div>
      <div class="ac-foot">
        <span>更新时间：${a.updatedAt || '—'}</span>
        <span style="flex:1"></span>
        <span class="fbq" data-fb="1">${icons.check} 有帮助</span>
        <span class="fbq" data-fb="0">没帮助</span>
        <span class="fbq" data-human="1">转人工</span>
      </div>
    </div>`;
  }

  function bindAnswerCard(scope, a, data) {
    $$('[data-sug]', scope).forEach((b) => b.addEventListener('click', () => sendQuestion(b.dataset.sug)));
    $$('[data-fb]', scope).forEach((b) => b.addEventListener('click', async () => {
      await api('/api/qa/feedback', { method: 'POST', body: JSON.stringify({ helpful: b.dataset.fb === '1', policyId: a.policyId }) });
      toast(b.dataset.fb === '1' ? '感谢反馈，已记录为“有帮助”' : '已记录，我们会优化该问题的答案');
    }));
    $$('[data-human]', scope).forEach((b) => b.addEventListener('click', () => toast('已为您转接村便民服务站人工坐席（演示）')));
  }

  function renderDocs(docs) {
    const list = docs && docs.length ? docs : defaultDocs;
    $('#docList').innerHTML = list.map((d) => `
      <div class="doc-item ${d.type === '官方文件' ? 'official' : ''}">
        <div class="dt">${icons.doc}${d.type} · ${d.date}</div>
        <b>${d.title}</b>
        <div class="dt" style="justify-content:space-between"><span>${d.dept}</span><span class="lk">查看原文 ›</span></div>
      </div>`).join('') + `<div class="no-doc">以上文件为演示用脱敏摘要</div>`;
    $$('#docList .lk').forEach((x) => x.addEventListener('click', () => toast('原文阅读为演示占位，接入政策库后可查看全文')));
  }
  const defaultDocs = [
    { title: '农机购置补贴政策实施意见', dept: '农业农村部', date: '2024-03-01', type: '官方文件' },
    { title: '城乡居民基本医疗保险实施办法', dept: 'XX市医疗保障局', date: '2026-09-15', type: '地方文件' },
    { title: 'XX省农村住房建设管理办法', dept: 'XX省人民政府', date: '2025-11-08', type: '地方文件' },
  ];

  /* 语音输入：优先使用浏览器语音识别，不可用时降级为演示 */
  function startVoice(inputEl, onDone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const mock = ['农机购置补贴需要准备哪些材料？', '医保住院报销比例是多少？', '高龄津贴怎么申领？'][Math.floor(Math.random() * 3)];
    showVoiceModal('正在聆听…', () => {
      if (SR) {
        try {
          const rec = new SR();
          rec.lang = 'zh-CN';
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          rec.onresult = (e) => { inputEl.value = e.results[0][0].transcript; closeVoiceModal(); onDone(); };
          rec.onerror = () => { inputEl.value = mock; closeVoiceModal(); onDone(); };
          rec.onend = () => closeVoiceModal();
          rec.start();
          voiceRec = rec;
          return;
        } catch (e) { /* fallthrough */ }
      }
      inputEl.value = mock;
      closeVoiceModal();
      onDone();
    });
  }
  let voiceRec = null;
  function showVoiceModal(text, cb) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.id = 'voiceMask';
    mask.innerHTML = `<div class="modal" style="width:300px;text-align:center">
      <h3 style="border:none;padding-bottom:0">${text}</h3>
      <div class="mbody" style="align-items:center;padding-top:6px">
        <div class="wave"><i></i><i></i><i></i><i></i><i></i></div>
        <div style="font-size:11.5px;color:#93a1b5">请说出您的问题，例如“农机补贴怎么申请”</div>
      </div>
      <div class="mfoot" style="justify-content:center"><button class="btn ghost" id="voiceCancel">取消</button></div>
    </div>`;
    $('#modalRoot').appendChild(mask);
    $('#voiceCancel').addEventListener('click', () => { if (voiceRec) { try { voiceRec.stop(); } catch (e) {} } closeVoiceModal(); });
    setTimeout(() => { if (document.getElementById('voiceMask')) cb(); }, 1400);
  }
  function closeVoiceModal() {
    const m = $('#voiceMask');
    if (m) m.remove();
    voiceRec = null;
  }

  /* ---------------- 数据管理 ---------------- */
  const adminDefs = {
    households: {
      title: '农户台账',
      cols: ['户号', '户主', '组别', '家庭成员', '房屋状态', '关怀标签', '更新时间', '操作'],
      row: (h) => [h.houseNo, h.owner, h.group, h.members + ' 人', `<span class="badge ${h.houseStatus === '正常' ? 'ok' : h.houseStatus === '闲置' ? 'idle' : 'warn'}">${h.houseStatus}</span>`, h.care, h.updatedAt,
        `<div class="ops"><button data-edit-h="${h.id}">维护</button><button data-locate="${h.id}">定位</button></div>`],
    },
    points: {
      title: '服务网点',
      cols: ['名称', '类型', '地址', '服务时间', '联系电话', '操作'],
      row: (p) => [p.name, p.type, p.address, p.hours, p.phone, `<div class="ops"><button data-edit-p="${p.id}">编辑</button><button class="del" data-del-p="${p.id}">删除</button></div>`],
    },
    notices: {
      title: '通知公告',
      cols: ['标题', '分类', '发布时间', '重要', '阅读量', '操作'],
      row: (n) => [n.title, n.category, n.publishAt, n.important ? '<span class="badge care">重要</span>' : '—', n.views, `<div class="ops"><button class="del" data-del-n="${n.id}">删除</button></div>`],
    },
    events: {
      title: '事件记录',
      cols: ['事件', '类别', '上报时间', '上报人', '状态', '操作'],
      row: (e) => [e.title, e.category, e.reportedAt, e.reporter, `<span class="st ${e.status === '待处置' ? 'pending' : 'done'}">${e.status}</span>`,
        `<div class="ops"><button data-toggle-e="${e.id}">${e.status === '待处置' ? '标记已处置' : '重新打开'}</button></div>`],
    },
  };

  function syncAdminTabs() {
    $$('#adminTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.adminTab));
  }
  $$('#adminTabs button').forEach((b) => b.addEventListener('click', () => {
    state.adminTab = b.dataset.tab; state.adminPage = 1; state.adminSearch = '';
    $('#adminSearch').value = '';
    syncAdminTabs(); renderAdmin();
  }));
  $('#adminSearch').addEventListener('input', (e) => { state.adminSearch = e.target.value; state.adminPage = 1; renderAdmin(); });
  $('#adminAdd').addEventListener('click', () => {
    if (state.role !== 'admin') return toast('仅管理员可新增基础数据');
    if (state.adminTab === 'households') return toast('农户数据由台账同步，演示环境不支持新增');
    openEditModal(state.adminTab, null);
  });

  async function renderAdmin() {
    if (state.page !== 'admin') return;
    const tab = state.adminTab;
    const def = adminDefs[tab];
    if (tab === 'households' && !state.data.households.length) {
      const r = await api('/api/households?size=600');
      state.data.households = r.rows;
    }
    const key = tab === 'points' ? 'points' : tab === 'notices' ? 'notices' : tab;
    if (!state.data[key] || !state.data[key].length) {
      state.data[key] = await api(tab === 'points' ? '/api/service-points' : tab === 'notices' ? '/api/notices' : '/api/events');
    }
    let rows = state.data[key];
    const kw = state.adminSearch.trim();
    if (kw) rows = rows.filter((r) => JSON.stringify(r).includes(kw));
    const pageSize = 12;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (state.adminPage > pages) state.adminPage = 1;
    const slice = rows.slice((state.adminPage - 1) * pageSize, state.adminPage * pageSize);
    const ths = def.cols.map((c) => `<th>${c}</th>`).join('');
    const trs = slice.map((r) => `<tr>${def.row(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
    $('#adminTable').innerHTML = `<thead><tr>${ths}</tr></thead><tbody>${trs || `<tr><td colspan="${def.cols.length}" style="text-align:center;color:#93a1b5;padding:26px">暂无数据</td></tr>`}</tbody>`;
    $('#adminCount').textContent = `共 ${rows.length} 条 · 当前第 ${state.adminPage}/${pages} 页`;
    $('#adminPageInfo').innerHTML = `<button class="btn ghost" style="height:26px;padding:0 10px" id="prevPage">上一页</button>
      <span style="margin:0 8px">${state.adminPage} / ${pages}</span>
      <button class="btn ghost" style="height:26px;padding:0 10px" id="nextPage">下一页</button>`;
    $('#prevPage').addEventListener('click', () => { if (state.adminPage > 1) { state.adminPage--; renderAdmin(); } });
    $('#nextPage').addEventListener('click', () => { if (state.adminPage < pages) { state.adminPage++; renderAdmin(); } });

    $$('[data-locate]').forEach((b) => b.addEventListener('click', () => {
      goPage('households');
      setTimeout(() => { initHouseholds().then(() => openHousehold(b.dataset.locate)); }, 120);
    }));
    $$('[data-edit-h]').forEach((b) => b.addEventListener('click', () => openHouseholdEdit(b.dataset.editH)));
    $$('[data-edit-p]').forEach((b) => b.addEventListener('click', () => openEditModal('points', state.data.points.find((p) => p.id === b.dataset.editP))));
    $$('[data-del-p]').forEach((b) => b.addEventListener('click', () => removeItem('points', b.dataset.delP)));
    $$('[data-del-n]').forEach((b) => b.addEventListener('click', () => removeItem('notices', b.dataset.delN)));
    $$('[data-toggle-e]').forEach((b) => b.addEventListener('click', async () => {
      const e = state.data.events.find((x) => x.id === b.dataset.toggleE);
      if (state.role !== 'admin') return toast('仅管理员可变更事件状态');
      await api('/api/events/' + e.id, { method: 'PATCH', body: JSON.stringify({ status: e.status === '待处置' ? '已处置' : '待处置' }) });
      state.data.events = await api('/api/events');
      renderAdmin();
      toast('事件状态已更新');
    }));
  }

  function openHouseholdEdit(id) {
    const h = state.data.households.find((x) => x.id === id);
    if (!h) return;
    modal({
      title: '维护农户信息 · ' + h.houseNo,
      fields: [
        { k: 'houseStatus', label: '房屋状态', type: 'select', options: ['正常', '待核查', '闲置'], value: h.houseStatus },
        { k: 'members', label: '家庭成员数', type: 'number', value: h.members },
        { k: 'care', label: '关怀标签', type: 'select', options: ['无', '留守老人', '低保户', '残疾人', '独居老人'], value: h.care },
      ],
      onSubmit: async (v) => {
        await api('/api/households/' + h.id, { method: 'PATCH', body: JSON.stringify({ houseStatus: v.houseStatus, members: Number(v.members), care: v.care }) });
        Object.assign(h, { houseStatus: v.houseStatus, members: Number(v.members), care: v.care });
        renderAdmin(); renderHouseholds();
        toast('已保存（演示仅允许维护状态、人数与关怀标签）');
      },
    });
  }

  function openEditModal(tab, item) {
    if (tab === 'points') {
      modal({
        title: item ? '编辑服务网点' : '新增服务网点',
        fields: [
          { k: 'name', label: '网点名称', value: item ? item.name : '' },
          { k: 'type', label: '类型', type: 'select', options: ['便民服务', '医疗健康', '文化活动', '养老服务', '生活服务'], value: item ? item.type : '便民服务' },
          { k: 'address', label: '地址', value: item ? item.address : '' },
          { k: 'hours', label: '服务时间', value: item ? item.hours : '08:30-17:00' },
          { k: 'phone', label: '联系电话', value: item ? item.phone : '' },
          { k: 'lat', label: '纬度', value: item ? item.lat : '30.2351' },
          { k: 'lng', label: '经度', value: item ? item.lng : '120.1157' },
        ],
        onSubmit: async (v) => {
          if (item) await api('/api/points/' + item.id, { method: 'PUT', body: JSON.stringify(v) });
          else await api('/api/points', { method: 'POST', body: JSON.stringify(v) });
          state.data.points = await api('/api/service-points');
          renderPointLayers(); renderAdmin(); renderMiniStats({ total: state.data.households.length, rows: state.data.households });
          toast(item ? '网点已更新' : '网点已新增');
        },
      });
    } else if (tab === 'notices') {
      modal({
        title: '新增通知公告',
        fields: [
          { k: 'title', label: '标题', value: '' },
          { k: 'category', label: '分类', type: 'select', options: ['本地通知', '医保社保', '惠农政策', '医疗健康', '民生政务', '农业生产'], value: '本地通知' },
          { k: 'summary', label: '内容摘要', type: 'textarea', value: '' },
          { k: 'important', label: '设为重要', type: 'select', options: ['否', '是'], value: '否' },
        ],
        onSubmit: async (v) => {
          await api('/api/notices', { method: 'POST', body: JSON.stringify({ ...v, important: v.important === '是', content: v.summary }) });
          state.data.notices = await api('/api/notices');
          renderAdmin(); toast('通知已发布');
        },
      });
    }
  }

  function removeItem(tab, id) {
    if (state.role !== 'admin') return toast('仅管理员可删除数据');
    modal({
      title: '确认删除', fields: [], confirmText: '确认删除',
      desc: '删除后该条数据将从演示库中移除，是否继续？',
      onSubmit: async () => {
        await api((tab === 'points' ? '/api/points/' : '/api/notices/') + id, { method: 'DELETE' });
        if (tab === 'points') { state.data.points = await api('/api/service-points'); renderPointLayers(); }
        else state.data.notices = await api('/api/notices');
        renderAdmin(); toast('已删除');
      },
    });
  }

  function modal({ title, fields, onSubmit, confirmText = '保存', desc }) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal">
      <h3>${title}</h3>
      <div class="mbody">
        ${desc ? `<div style="font-size:12.5px;color:#4b6076;line-height:1.7">${desc}</div>` : ''}
        ${fields.map((f) => `<div class="field"><label>${f.label}</label>
          ${f.type === 'select'
            ? `<select data-k="${f.k}">${f.options.map((o) => `<option ${o === f.value ? 'selected' : ''}>${o}</option>`).join('')}</select>`
            : f.type === 'textarea'
              ? `<textarea data-k="${f.k}">${f.value || ''}</textarea>`
              : `<input data-k="${f.k}" type="${f.type || 'text'}" value="${f.value ?? ''}">`}
        </div>`).join('')}
      </div>
      <div class="mfoot"><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>${confirmText}</button></div>
    </div>`;
    $('#modalRoot').appendChild(mask);
    const close = () => mask.remove();
    mask.querySelector('[data-cancel]').addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    mask.querySelector('[data-ok]').addEventListener('click', async () => {
      const v = {};
      $$('[data-k]', mask).forEach((el) => { v[el.dataset.k] = el.value; });
      try { await onSubmit(v); close(); } catch (e) { toast(e.message); }
    });
  }

  /* ---------------- 全局搜索 ---------------- */
  let searchTimer = null;
  const gsInput = $('#globalSearch');
  gsInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = gsInput.value.trim();
    if (!q) return $('#searchResults').classList.add('hidden');
    searchTimer = setTimeout(async () => {
      const r = await api('/api/search?q=' + encodeURIComponent(q));
      const groups = [
        ['农户', r.households.map((h) => ({ title: h.houseNo + ' · ' + h.owner, desc: h.address, act: () => { goPage('households'); setTimeout(() => initHouseholds().then(() => { $('#hhSearch').value = h.houseNo; doSearch(); }), 120); } }))],
        ['政策', r.policies.map((p) => ({ title: p.title, desc: p.category, act: () => { goPage('qa'); sendQuestion(p.title.replace('指南', '怎么办理？').replace('查询及办理', '怎么查？')); } }))],
        ['通知', r.notices.map((n) => ({ title: n.title, desc: n.publishAt, act: () => toast('通知详情请在移动端查看（演示）') }))],
        ['服务网点', r.points.map((p) => ({ title: p.name, desc: p.type + ' · ' + p.address, act: () => { goPage('households'); toast(p.name + ' · ' + p.phone); } }))],
      ].filter((g) => g[1].length);
      const box = $('#searchResults');
      box.innerHTML = groups.length ? groups.map(([g, items]) => `
        <div class="sr-group">${g}</div>
        ${items.slice(0, 4).map((it, i) => `<div class="sr-item" data-g="${g}" data-i="${i}"><div><div class="t">${it.title}</div><div class="d">${it.desc}</div></div></div>`).join('')}
      `).join('') : '<div class="sr-group">未找到相关结果</div>';
      box.classList.remove('hidden');
      $$('.sr-item', box).forEach((el) => el.addEventListener('click', () => {
        const g = groups.find((x) => x[0] === el.dataset.g);
        const it = g[1][Number(el.dataset.i)];
        box.classList.add('hidden');
        it.act();
      }));
    }, 260);
  });
  $('#globalSearchBtn').addEventListener('click', () => {
    const q = gsInput.value.trim();
    if (!q) return;
    goPage('households');
    setTimeout(() => initHouseholds().then(() => { $('#hhSearch').value = q; doSearch(); }), 120);
    $('#searchResults').classList.add('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-global')) $('#searchResults').classList.add('hidden');
  });
  $('#bellBtn').addEventListener('click', () => { goPage('admin'); state.adminTab = 'events'; syncAdminTabs(); renderAdmin(); });

  /* ---------------- 样式补丁（气泡动画/提示框） ---------------- */
  const stylePatch = document.createElement('style');
  stylePatch.textContent = `
    .leaflet-tooltip.v-tip { background: rgba(255,255,255,.94); border: none; box-shadow: 0 2px 8px rgba(15,35,70,.18); font-size: 11.5px; color:#22314a; padding: 3px 8px; border-radius: 6px; }
    .leaflet-tooltip.v-tip:before { display:none; }
    .leaflet-tooltip.hh-tip { background: rgba(18,32,52,.92); color:#fff; border:none; font-size:11px; border-radius:6px; padding:4px 8px; box-shadow:none; }
    .leaflet-tooltip.hh-tip:before { display:none; }
    .v-label { background: rgba(23,166,115,.9); color:#fff; border:none; font-size:11px; }
    .wave { display:flex; align-items:flex-end; gap:4px; height:36px; }
    .wave i { width:4px; background:#2f7cf6; border-radius:2px; animation: wv 1s infinite ease-in-out; }
    .wave i:nth-child(1){height:12px;animation-delay:0s}.wave i:nth-child(2){height:26px;animation-delay:.15s}
    .wave i:nth-child(3){height:36px;animation-delay:.3s}.wave i:nth-child(4){height:22px;animation-delay:.45s}
    .wave i:nth-child(5){height:14px;animation-delay:.6s}
    @keyframes wv { 0%,100%{transform:scaleY(.4)} 50%{transform:scaleY(1)} }
    .btn-on { border-color:#1d5fd0 !important; color:#1d5fd0 !important; background:#eef4ff !important; }
    .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,.7) !important; }
  `;
  document.head.appendChild(stylePatch);

  /* ---------------- 启动 ---------------- */
  (async function boot() {
    try {
      await initOverview();
      initQA();
      $('#adminRoleBadge').textContent = '当前角色：管理员';
      goPage('overview');
      await api('/api/health');
    } catch (e) {
      console.error(e);
      toast('加载失败：' + e.message + '，请确认后端服务已启动');
    }
  })();
})();
