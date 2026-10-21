/* 乡村便民助手 · 小程序原型（H5） */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const screen = $('#screen');
  const tabbar = $('#tabbar');
  const overlayRoot = $('#overlayRoot');

  const state = {
    route: 'home',
    params: {},
    stack: [],
    elder: false,
    cats: [], notices: [], services: [], points: [], stats: null,
    favs: [], chat: [], chatTab: 'ai', svcCat: '', policy: null,
    map: null,
  };

  /* ---------------- 请求 ---------------- */
  async function api(url, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json', 'x-user': 'demo-user' }, opts.headers || {});
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    const json = await res.json();
    if (json.code !== 0) throw new Error(json.message || '请求失败');
    return json.data;
  }

  /* ---------------- 图标 ---------------- */
  const svg = (path, size = 20, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;
  const I = {
    home: (s = 21) => svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>', s),
    grid: (s = 21) => svg('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>', s),
    chat: (s = 21) => svg('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.8-.8L4 20l1-3.6A8.3 8.3 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>', s),
    user: (s = 21) => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>', s),
    search: (s = 17) => svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', s),
    mic: (s = 18) => svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', s),
    micBig: (s = 38) => svg('<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>', s, 'stroke-width="1.6"'),
    back: (s = 20) => svg('<path d="m15 5-7 7 7 7"/>', s, 'stroke-width="2"'),
    chevron: (s = 15) => svg('<path d="m9 6 6 6-6 6"/>', s, 'stroke-width="2"'),
    bell: (s = 19) => svg('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>', s),
    sprout: (s = 22) => svg('<path d="M12 21v-7"/><path d="M12 14c0-4 3-7 7-7 0 4-3 7-7 7Z"/><path d="M12 17c0-3.3-2.4-6-6-6 0 3.3 2.4 6 6 6Z"/>', s),
    doc: (s = 22) => svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h4"/>', s),
    shield: (s = 22) => svg('<path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6Z"/><path d="m9 12 2 2 4-4"/>', s),
    house: (s = 22) => svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-5h4v5"/>', s),
    heart: (s = 22) => svg('<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/>', s),
    build: (s = 22) => svg('<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>', s),
    pin: (s = 15) => svg('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>', s),
    phone: (s = 18) => svg('<path d="M5 3h3.3l1.6 4-2 1.4a12 12 0 0 0 5.6 5.6l1.4-2 4 1.6V17a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.2 2 2 0 0 1 5 3Z"/>', s),
    star: (s = 17) => svg('<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7Z"/>', s),
    check: (s = 15) => svg('<path d="m5 12.5 4.5 4.5L19 7"/>', s, 'stroke-width="2.4"'),
    close: (s = 16) => svg('<path d="M6 6l12 12M18 6 6 18"/>', s, 'stroke-width="2"'),
    trash: (s = 17) => svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>', s),
    list: (s = 15) => svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', s),
    info: (s = 15) => svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/>', s),
    pen: (s = 15) => svg('<path d="M4 20h4L20 8l-4-4L4 16v4Z"/>', s),
    arrow: (s = 15) => svg('<path d="m9 6 6 6-6 6"/>', s, 'stroke-width="2"'),
    sound: (s = 18) => svg('<path d="M4 9v6h3l5 4V5L7 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', s),
    aa: (s = 18) => svg('<path d="M3 18 7.5 6 12 18M4.7 14h5.6M15 18l3-8 3 8M16 15.4h4"/>', s),
  };

  /* ---------------- 页面切换 ---------------- */
  const tabRoutes = ['home', 'services', 'chat', 'me'];
  function navigate(route, params = {}, replace = false) {
    if (state.route && !replace) state.stack.push({ route: state.route, params: state.params });
    state.route = route;
    state.params = params;
    if (state.map) { state.map.remove(); state.map = null; }
    render();
    screen.scrollTop = 0;
  }
  function back() {
    const prev = state.stack.pop();
    if (prev) { state.route = prev.route; state.params = prev.params; if (state.map) { state.map.remove(); state.map = null; } render(); }
    else navigate('home', {}, true);
  }

  function render() {
    const r = state.route;
    let html = '', showTab = false, light = false;

    if (r === 'home') { html = state.elder ? elderHome() : normalHome(); showTab = true; }
    else if (r === 'services') { html = servicesPage(); showTab = true; }
    else if (r === 'chat') { html = chatPage(); }
    else if (r === 'me') { html = mePage(); showTab = true; }
    else if (r === 'answer') { html = answerPage(); }
    else if (r === 'notices') { html = noticesPage(); }
    else if (r === 'notice') { html = noticeDetail(); }
    else if (r === 'points') { html = pointsPage(); }
    else if (r === 'favorites') { html = favoritesPage(); }
    else if (r === 'feedback') { html = feedbackPage(); }

    screen.innerHTML = html;
    screen.classList.toggle('no-scroll', r === 'chat');
    const isHeroPage = r === 'home';
    $('#statusbar').className = 'statusbar ' + (isHeroPage ? 'on-hero' : 'dark');
    renderTabbar(showTab);
    bindPage(r);
    if (r === 'chat') setTimeout(scrollChatBottom, 40);
  }

  function renderTabbar(show) {
    tabbar.classList.toggle('hidden', !show);
    tabbar.classList.toggle('elder', state.elder);
    if (!show) return;
    const items = [
      ['home', '首页', I.home],
      ['services', '服务', I.grid],
      ['chat', 'AI助手', I.chat],
      ['me', '我的', I.user],
    ];
    tabbar.innerHTML = items.map(([k, label, ic]) => `
      <button data-tab="${k}" class="${state.route === k ? 'on' : ''}">${ic(state.elder ? 24 : 21)}<span>${label}</span></button>`).join('');
    $$('button', tabbar).forEach((b) => b.addEventListener('click', () => {
      if (state.route === b.dataset.tab) return;
      state.stack = [];
      state.route = b.dataset.tab; state.params = {};
      if (state.map) { state.map.remove(); state.map = null; }
      render();
      screen.scrollTop = 0;
    }));
  }

  /* ---------------- 首页：普通版 ---------------- */
  function hillsSvg(id) {
    return `<svg class="hills" viewBox="0 0 390 92" preserveAspectRatio="none">
      <path d="M0 62c46-22 74-8 108-22 34-14 54-32 92-28 40 4 68 26 104 30 30 3 60-2 86 10v40H0Z" fill="#ffffff" opacity=".16"/>
      <path d="M0 78c50-14 80 4 120-4 44-9 76-18 118-10 46 8 90 4 152 16v12H0Z" fill="#ffffff" opacity=".2"/>

    </svg>`;
  }

  function normalHome() {
    const cats = state.cats.slice(0, 4);
    const notices = state.notices.slice(0, 2);
    return `
    <div class="hero">
      ${hillsSvg()}
      <div class="hero-top">
        <div class="loc">${I.pin(13)} 某乡镇 · 示范村 ${I.chevron(12)}</div>
        <div class="sp"></div>
        <button data-go="notices" style="color:#fff;opacity:.9">${I.bell(18)}</button>
      </div>
      <div class="hero-title">
        <h1>办好身边事<span>服务新农村</span></h1>
        <p>政策查询 · 事项办理 · 语音咨询</p>
      </div>
      <div class="version" data-version>
        <button class="on" data-elder="0">普通版</button>
        <button data-elder="1">长辈版</button>
      </div>
      <div class="hero-search" data-go="chat">
        ${I.search()}<span>请问您想了解什么？</span>
      </div>
    </div>

    <div class="grid4">
      ${cats.map((c) => `
        <button class="cat" data-cat="${c.name}">
          <span class="ci" style="background:${c.color}18;color:${c.color}">${catIcon(c.name, 22)}</span>
          <span><b>${c.name}</b><span>${c.desc}</span></span>
        </button>`).join('')}
    </div>

    <div class="sec-head"><b>本地通知</b><button class="more" data-go="notices">更多 ${I.chevron(12)}</button></div>
    <div class="notice-card">
      ${notices.map((n) => `
        <div class="notice-row" data-notice="${n.id}">
          <span class="nt">${n.title}</span>
          <span class="tag ${n.important ? 'imp' : 'nor'}">${n.important ? '重要' : '通知'}</span>
        </div>`).join('')}
    </div>

    <div class="sec-head"><b>常用服务</b><button class="more" data-go="points">服务网点 ${I.chevron(12)}</button></div>
    <div class="notice-card">
      <div class="notice-row" data-go="points">
        <span class="ci" style="width:30px;height:30px;border-radius:9px;background:#eaf6f0;color:#2c8f61;display:grid;place-items:center">${I.pin(16)}</span>
        <span style="flex:1"><span class="nt">5 个便民服务网点，最近 260 米</span><span class="ns">便民服务站 · 卫生室 · 文化礼堂 · 养老中心</span></span>
        ${I.chevron(14)}
      </div>
      <div class="notice-row" data-go="chat">
        <span class="ci" style="width:30px;height:30px;border-radius:9px;background:#fff1e9;color:#d9612d;display:grid;place-items:center">${I.mic(16)}</span>
        <span style="flex:1"><span class="nt">说不清楚？按住说话直接问</span><span class="ns">支持普通话与方言识别（演示）</span></span>
        ${I.chevron(14)}
      </div>
    </div>

    <div class="slogan">
      <b>建设和美乡村<br>共享美好生活</b>
      <svg class="hills2" viewBox="0 0 140 76" fill="none" preserveAspectRatio="xMaxYMax meet">
        <path d="M0 66c24-8 34-24 56-24s28 14 44 16 28-4 40 4v14H0Z" fill="#c9e7d4"/>
        <path d="M10 70c20-6 30-18 48-18s26 10 42 12 30-2 40 4v8H10Z" fill="#b4ddc4"/>
        <rect x="70" y="44" width="24" height="18" fill="#fff" opacity=".9"/>
        <path d="M66 44 82 33l16 11" stroke="#8fc7a6" stroke-width="2" fill="none"/>
        <circle cx="122" cy="38" r="7" fill="#a9d8bb"/>
      </svg>
    </div>`;
  }

  /* ---------------- 首页：长辈版 ---------------- */
  function elderHome() {
    const cats = state.cats.slice(0, 4);
    return `
    <div class="elder-page">
      <div class="elder-head">
        <div class="hero-top" style="padding:0">
          <div class="loc">${I.pin(14)} 某乡镇 · 示范村 ${I.chevron(13)}</div>
        </div>
        <div class="elder-title">数字服务<br>更贴近每一位村民</div>
        <div class="elder-sub">字大、按钮大，点一下就能问</div>
        <div class="version" data-version>
          <button data-elder="0">普通版</button>
          <button class="on" data-elder="1">长辈版</button>
        </div>
      </div>

      <div class="elder-grid">
        ${cats.map((c) => `
          <button class="elder-tile" data-cat="${c.name}">
            <span class="ci" style="background:${c.color}18;color:${c.color}">${catIcon(c.name, 30)}</span>
            <b>${c.name}</b><span>${c.desc}</span>
          </button>`).join('')}
      </div>

      <div class="mic-zone">
        <button class="mic-big" data-voice>${I.micBig(40)}</button>
        <div class="mic-label">按住说话</div>
      </div>

      <div class="elder-tools">
        <button class="elder-tool" data-read>${I.sound(20)} 听内容</button>
        <button class="elder-tool" data-elder="0">${I.aa(20)} 大字模式</button>
      </div>
    </div>`;
  }

  function catIcon(name, size) {
    const map = { 惠农政策: I.sprout, 民生政务: I.doc, 医保社保: I.shield, 便民服务: I.house, 乡村建设: I.build, 社会救助: I.heart };
    return (map[name] || I.grid)(size);
  }

  /* ---------------- 服务页 ---------------- */
  function servicesPage() {
    const cat = state.svcCat;
    const list = cat ? state.services.filter((s) => s.cat === cat) : state.services;
    const groups = {};
    list.forEach((s) => { (groups[s.cat] = groups[s.cat] || []).push(s); });
    return `
      <div class="page-head"><b style="margin-left:4px">便民服务</b>
        <span class="act" data-go="chat">${I.chat(15)} 智能助手</span>
      </div>
      <div class="page-body">
        <div class="chiprow" style="padding-top:12px">
          <button class="chip ${!cat ? 'on' : ''}" data-svccat="">全部</button>
          ${state.cats.map((c) => `<button class="chip ${cat === c.name ? 'on' : ''}" data-svccat="${c.name}">${c.name}</button>`).join('')}
        </div>

        <div style="display:flex;gap:10px;padding:14px 16px 0">
          <button class="card" data-go="points" style="flex:1;padding:12px;display:flex;align-items:center;gap:9px;text-align:left">
            <span style="width:34px;height:34px;border-radius:10px;background:#eaf6f0;color:#2c8f61;display:grid;place-items:center">${I.pin(17)}</span>
            <span><b style="font-size:13px">服务网点</b><span style="display:block;font-size:10.5px;color:#9aa9a1">5 个网点可办理</span></span>
          </button>
          <button class="card" data-go="notices" style="flex:1;padding:12px;display:flex;align-items:center;gap:9px;text-align:left">
            <span style="width:34px;height:34px;border-radius:10px;background:#fff1e9;color:#d9612d;display:grid;place-items:center">${I.bell(17)}</span>
            <span><b style="font-size:13px">通知公告</b><span style="display:block;font-size:10.5px;color:#9aa9a1">${state.notices.length} 条本地通知</span></span>
          </button>
        </div>

        ${Object.keys(groups).map((g) => `
          <div class="svc-group">
            <h4>${g}</h4>
            <div class="card">
              ${groups[g].map((s) => `
                <div class="svc-item" data-svc="${s.id}">
                  <span class="si" style="background:${(state.cats.find((c) => c.name === s.cat) || {}).color || '#2fb37a'}18;color:${(state.cats.find((c) => c.name === s.cat) || {}).color || '#2fb37a'}">${catIcon(s.cat, 18)}</span>
                  <span class="st"><b>${s.name}</b><span>${s.desc}</span></span>
                  ${s.hot ? '<span class="tag imp">热门</span>' : ''}
                  <span class="go">${I.chevron(15)}</span>
                </div>`).join('')}
            </div>
          </div>`).join('')}
        <div style="height:12px"></div>
      </div>`;
  }

  /* ---------------- 智能问答 ---------------- */
  function chatPage() {
    const msgs = state.chat;
    return `
      <div class="chat-screen">
        <div class="page-head">
          <button class="back" data-back>${I.back()}</button>
          <b>乡村便民助手</b>
          <span class="act" data-human>人工 ›</span>
        </div>
        <div class="chat-tabs">
          <button class="${state.chatTab === 'ai' ? 'on' : ''}" data-chattab="ai">AI 对话</button>
          <button class="${state.chatTab === 'faq' ? 'on' : ''}" data-chattab="faq">常见问题</button>
        </div>
        <div id="chatList" style="flex:1;overflow-y:auto;padding-bottom:6px">
          <div class="msg"><div class="av">${I.chat(16)}</div>
            <div class="bb">您好！关于政策补贴、医保社保、宅基地等事项，您可以问我，我会按“适用对象、材料、流程、地点、依据”为您整理。</div></div>
          <div class="time">今天 10:24</div>
          ${msgs.map((m) => m.role === 'user'
            ? `<div class="msg user"><div class="av">${I.user(16)}</div><div class="bb">${esc(m.text)}</div></div>`
            : `<div class="msg ai"><div class="av">${I.chat(16)}</div><div class="bb">${m.typing ? '<span class="typing">正在为您查询…</span>' : aiBubble(m)}</div></div>`).join('')}
        </div>
        <div class="chat-quick">
          ${['农机购置补贴怎么申请？', '医保报销比例是多少？', '高龄津贴怎么领？'].map((q) => `<button data-ask="${q}">${q}</button>`).join('')}
        </div>
        <div class="chat-inputbar">
          <button class="mic" data-voice>${I.mic(17)}</button>
          <input class="inp" id="chatInput" placeholder="请输入您的问题…">
          <button class="send" id="chatSend">${I.arrow(17)}</button>
        </div>
      </div>`;
  }

  function aiBubble(m) {
    if (!m.policy) return esc(m.text || '');
    const p = m.policy;
    return `${esc(m.text || '')}
      <div class="ans-mini">
        <div class="am-h">${I.doc(14)} ${esc(p.title)}</div>
        <div class="am-b">
          <div class="am-r"><i>适用对象</i><span>${esc((p.applyTo || [])[0] || '')}</span></div>
          <div class="am-r"><i>所需材料</i><span>${esc((p.materials || []).slice(0, 3).join('、'))}</span></div>
          <div class="am-r"><i>办理地点</i><span>${esc(p.place || '')}</span></div>
        </div>
        <div class="am-f" data-answer="${p.policyId}"><span>查看完整办理指南</span>${I.chevron(14)}</div>
      </div>`;
  }

  /* ---------------- 政策详情 ---------------- */
  function answerPage() {
    const p = state.policy;
    if (!p) return '<div class="empty">加载中…</div>';
    const section = (title, iconName, color, body, open) => `
      <div class="acc ${open ? 'open' : ''}">
        <div class="acc-h"><span class="ic" style="background:${color}18;color:${color}">${iconName}</span>${title}
          <span class="arw">${I.chevron(15)}</span></div>
        <div class="acc-b" ${open ? '' : 'style="display:none"'}>${body}</div>
      </div>`;
    const lis = (arr) => arr.map((x) => `<div class="li">${esc(x)}</div>`).join('');
    const fav = state.favs.some((f) => f.targetId === p.id);
    return `
      <div class="page-head"><button class="back" data-back>${I.back()}</button><b>政策办理指南</b>
        <span class="act" data-human>转人工</span></div>
      <div class="policy-body">
        <div class="policy-hero">
          <h2>${esc(p.title)}</h2>
          <p>${esc(p.summary)}</p>
          <div class="meta"><span>${esc(p.category || '惠农政策')}</span><span>更新时间：${p.updatedAt || '—'}</span></div>
        </div>

        ${section('办理说明', I.info(16), '#2f7cf6', `<div>${esc(p.summary)}</div>`, true)}
        ${section('适用对象', I.user(16), '#2fb37a', lis(p.applyTo || []))}
        ${section('所需材料', I.doc(16), '#e8663d', lis(p.materials || []))}
        ${section('办理流程', I.list(16), '#8a63d2', (p.steps || []).map((s, i) => `<div class="li">${i + 1}. ${esc(s)}</div>`).join(''))}
        ${section('办理地点', I.pin(16), '#0f9b8e', `${esc(p.place || '')}${p.placePending ? ' <span class="tag imp" style="margin-left:4px">待确认</span>' : ''}`, true)}
        ${section('政策依据', I.shield(16), '#2f7cf6', lis(p.basis || []))}

        <div class="policy-actions">
          <button class="btn-primary" data-human>转人工咨询</button>
          <button class="btn-ghost" data-fav="${p.id}" style="color:${fav ? '#e0a020' : '#93a29a'}">${I.star(20)}</button>
        </div>

        <div class="policy-foot">
          <span data-helpful="1">${I.check(14)} 有帮助</span>
          <span data-helpful="0">${I.close(14)} 没帮助</span>
          <span data-go="feedback">${I.pen(14)} 意见反馈</span>
        </div>
        <div class="policy-tip">${I.info(13)} 以上内容由本地政策知识库整理，具体金额、材料以当年正式通知为准；无法确认的信息已标注“待确认”。</div>
      </div>`;
  }

  /* ---------------- 通知 ---------------- */
  function noticesPage() {
    return `
      <div class="page-head"><button class="back" data-back>${I.back()}</button><b>通知公告</b></div>
      <div class="page-body">
        <div class="card" style="margin:12px 16px;overflow:hidden">
          ${state.notices.map((n) => `
            <div class="notice-item" data-notice="${n.id}">
              ${n.important ? '<span class="dot-imp"></span>' : ''}
              <div class="body">
                <h4>${esc(n.title)}</h4>
                <p>${esc(n.summary)}</p>
                <div class="meta"><span>${n.category}</span><span>${n.publishAt}</span><span>${n.views} 次阅读</span></div>
              </div>
              <span style="color:#c3d2c9;align-self:center">${I.chevron(15)}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  function noticeDetail() {
    const n = state.params.notice;
    if (!n) return '<div class="empty">通知不存在</div>';
    return `
      <div class="page-head"><button class="back" data-back>${I.back()}</button><b>通知详情</b></div>
      <div style="padding:18px 18px 8px">
        <h2 style="font-size:18px;line-height:1.5;margin:0 0 10px">${esc(n.title)}</h2>
        <div style="font-size:11px;color:#9aa9a1;display:flex;gap:10px">
          <span>${n.category}</span><span>${n.publishAt}</span><span>${n.views} 次阅读</span>
        </div>
      </div>
      <div style="padding:0 18px 24px;font-size:13.5px;line-height:2;color:#3d5348;white-space:pre-wrap">${esc(n.content)}</div>
      <div class="policy-tip" style="margin-top:0">${I.info(13)} 本通知为脱敏演示内容，具体以村委会正式发布为准。</div>`;
  }

  /* ---------------- 服务网点 ---------------- */
  function pointsPage() {
    return `
      <div class="page-head"><button class="back" data-back>${I.back()}</button><b>服务网点</b>
        <span class="act" data-human>咨询</span></div>
      <div class="map-box">
        <div id="appMap"></div>
        <div class="map-legend-sm"><span>● 服务网点</span><span>共 ${state.points.length} 个</span></div>
      </div>
      <div class="card" style="margin:12px 16px;overflow:hidden">
        ${state.points.map((p, i) => `
          <div class="sp-item" data-point="${p.id}">
            <span class="num">${i + 1}</span>
            <div style="flex:1;min-width:0">
              <h4>${esc(p.name)} <span class="ty">${p.type}</span></h4>
              <p>${esc(p.address)}</p>
              <p>${p.hours} · ${p.phone}</p>
            </div>
            <button class="call" data-call="${p.phone}">${I.phone(18)}</button>
          </div>`).join('')}
      </div>
      <div class="policy-tip">${I.info(13)} 网点位置与服务时间为演示数据，实际以村委会公布为准。</div>
      <div style="height:20px"></div>`;
  }

  /* ---------------- 我的 ---------------- */
  function mePage() {
    return `
      <div class="me-head">
        <div class="ava">村</div>
        <div style="flex:1">
          <b>张某某</b>
          <span>示范村 · 一组村民（演示账号）</span>
        </div>
        <span style="opacity:.8">${I.chevron(16)}</span>
      </div>
      <div class="me-grid">
        <div data-go="favorites"><b>${state.favs.length}</b>收藏</div>
        <div data-go="chat"><b>${state.chat.filter((m) => m.role === 'user').length}</b>咨询</div>
        <div data-go="feedback"><b>1</b>反馈</div>
      </div>

      <div class="me-list">
        <div class="me-row" data-go="favorites"><span class="mi" style="background:#fff6e5;color:#d99a20">${I.star(15)}</span>我的收藏<span class="arw">${I.chevron(15)}</span></div>
        <div class="me-row" data-go="chat"><span class="mi" style="background:#eaf6f0;color:#2c8f61">${I.chat(15)}</span>我的咨询<span class="arw">${I.chevron(15)}</span></div>
        <div class="me-row" data-go="feedback"><span class="mi" style="background:#eef2ff;color:#5b6fd6">${I.pen(15)}</span>意见反馈<span class="arw">${I.chevron(15)}</span></div>
      </div>

      <div class="me-list">
        <div class="me-row" data-toggle-elder><span class="mi" style="background:#eaf6f0;color:#2c8f61">${I.aa(15)}</span>长辈版（大字模式）
          <span class="switch ${state.elder ? 'on' : ''}"></span></div>
        <div class="me-row" data-read><span class="mi" style="background:#fff1e9;color:#d9612d">${I.sound(15)}</span>语音播报<span class="arw">${I.chevron(15)}</span></div>
        <div class="me-row" data-about><span class="mi" style="background:#f1f4f2;color:#6b7d74">${I.info(15)}</span>关于与数据说明<span class="arw">${I.chevron(15)}</span></div>
      </div>
      <div style="text-align:center;font-size:10.5px;color:#b3c0b9;padding:22px 0 26px">乡村便民助手 · 演示原型 v1.0</div>`;
  }

  /* ---------------- 收藏 ---------------- */
  function favoritesPage() {
    return `
      <div class="page-head"><button class="back" data-back>${I.back()}</button><b>我的收藏</b></div>
      <div class="page-body">
        ${state.favs.length ? `<div class="card" style="margin:12px 16px;overflow:hidden">
          ${state.favs.map((f) => `
            <div class="fav-item">
              <div class="ft" data-favopen="${f.targetId}">
                <h4>${esc(f.title)}</h4>
                <p>${esc(f.summary || '政策办理指南')} · ${f.createdAt ? f.createdAt.slice(0, 10) : ''}</p>
              </div>
              <button class="rm" data-favdel="${f.id}">${I.trash(17)}</button>
            </div>`).join('')}
        </div>` : `<div class="empty">${I.star(40)}<div>还没有收藏内容</div>
          <div style="font-size:11.5px;margin-top:6px">在政策详情页点击 ☆ 即可收藏</div>
          <button class="btn-primary" style="width:180px;margin:18px auto 0" data-go="services">去逛逛服务</button></div>`}
      </div>`;
  }

  /* ---------------- 反馈 ---------------- */
  function feedbackPage() {
    return `
      <div class="page-head"><button class="back" data-back>${I.back()}</button><b>意见反馈</b></div>
      <div class="form">
        <label>反馈类型</label>
        <div class="types">
          ${['功能建议', '政策有误', '使用问题', '其他'].map((t, i) => `<button class="${i === 0 ? 'on' : ''}" data-fbtype="${t}">${t}</button>`).join('')}
        </div>
        <label>意见内容 <span style="color:#e0475f">*</span></label>
        <textarea id="fbContent" placeholder="请描述您遇到的问题或建议，例如：想查询高龄津贴的发放进度…"></textarea>
        <label>联系方式（选填）</label>
        <input id="fbContact" placeholder="手机号，便于我们回访" inputmode="numeric">
        <div style="font-size:11px;color:#a3b1a9;line-height:1.7;margin-top:10px">提交后的内容仅用于原型演示，不会对外公开。</div>
        <button class="btn-primary" style="margin-top:20px" id="fbSubmit">提交反馈</button>
      </div>`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindPage(r) {
    $$('[data-go]').forEach((el) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      const to = el.dataset.go;
      if (to === 'notices') return navigate('notices');
      if (to === 'points') return navigate('points');
      if (to === 'feedback') return navigate('feedback');
      if (to === 'favorites') return navigate('favorites');
      if (to === 'chat') return navigate('chat');
      if (to === 'services') return navigate('services');
    }));
    $$('[data-back]').forEach((b) => b.addEventListener('click', back));
    $$('[data-elder]').forEach((b) => b.addEventListener('click', () => {
      state.elder = b.dataset.elder === '1';
      state.stack = [];
      render();
      screen.scrollTop = 0;
    }));
    $$('[data-cat]').forEach((b) => b.addEventListener('click', () => {
      state.svcCat = b.dataset.cat;
      navigate('services');
    }));
    $$('[data-svccat]').forEach((b) => b.addEventListener('click', () => {
      state.svcCat = b.dataset.svccat;
      render();
    }));
    $$('[data-notice]').forEach((el) => el.addEventListener('click', async () => {
      try {
        const n = await api('/api/notices/' + el.dataset.notice);
        navigate('notice', { notice: n });
      } catch (e) { toast(e.message); }
    }));
    $$('[data-svc]').forEach((el) => el.addEventListener('click', () => {
      const s = state.services.find((x) => x.id === el.dataset.svc);
      if (s && s.policyId) return openPolicy(s.policyId);
      showSheet({
        title: s ? s.name : '事项办理',
        desc: '该事项为演示占位，可先咨询智能助手了解办理要求，或到村便民服务站现场办理。',
        ok: '问问助手', onOk: () => navigate('chat'),
      });
    }));
    $$('[data-voice]').forEach((b) => b.addEventListener('click', openVoice));
    $$('[data-read]').forEach((b) => b.addEventListener('click', () => toast('语音播报为演示功能，正式版将朗读当前页面内容')));
    $$('[data-toggle-elder]').forEach((b) => b.addEventListener('click', () => {
      state.elder = !state.elder;
      state.route = 'home'; state.params = {}; state.stack = [];
      render();
      screen.scrollTop = 0;
      toast(state.elder ? '已切换长辈版：字更大、按钮更大' : '已切换回普通版');
    }));
    $$('[data-human]').forEach((b) => b.addEventListener('click', () => showSheet({
      title: '转人工咨询', desc: '村便民服务站工作时间 08:30-17:00，电话 0572-****101。是否拨打电话？（演示）',
      ok: '拨打', onOk: () => toast('正在呼叫村便民服务站（演示）'),
    })));
    $$('[data-about]').forEach((b) => b.addEventListener('click', () => showSheet({
      title: '关于本原型', desc: '本原型用于方案演示，地图底图为公开在线地图服务，农户点位依据卫星影像中的房屋位置生成，姓名、电话、户号均为脱敏模拟数据，不含任何真实个人信息。',
      ok: '我知道了',
    })));

    if (r === 'chat') bindChat();
    if (r === 'answer') bindAnswer();
    if (r === 'points') bindPoints();
    if (r === 'favorites') bindFavorites();
    if (r === 'feedback') bindFeedback();
    if (r === 'services') { /* handled above */ }
  }

  function bindChat() {
    $$('[data-chattab]').forEach((b) => b.addEventListener('click', () => { state.chatTab = b.dataset.chattab; render(); }));
    $$('[data-ask]').forEach((b) => b.addEventListener('click', () => ask(b.dataset.ask)));
    $$('[data-answer]').forEach((b) => b.addEventListener('click', () => openPolicy(b.dataset.answer)));
    const send = $('#chatSend');
    if (send) send.addEventListener('click', () => ask($('#chatInput').value));
    const inp = $('#chatInput');
    if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(inp.value); });
  }

  function bindAnswer() {
    $$('.acc-h').forEach((h) => h.addEventListener('click', () => {
      const acc = h.parentElement;
      acc.classList.toggle('open');
      const b = $('.acc-b', acc);
      b.style.display = acc.classList.contains('open') ? '' : 'none';
    }));
    $$('[data-fav]').forEach((b) => b.addEventListener('click', () => toggleFav(state.policy, b)));
    $$('[data-helpful]').forEach((b) => b.addEventListener('click', async () => {
      try { await api('/api/qa/feedback', { method: 'POST', body: JSON.stringify({ helpful: b.dataset.helpful === '1', policyId: state.policy.id }) }); } catch (e) {}
      toast(b.dataset.helpful === '1' ? '感谢反馈，已记录为“有帮助”' : '已记录，我们会继续优化答案');
    }));
  }

  function bindPoints() {
    const el = $('#appMap');
    if (!el) return;
    const map = MapKit.create(el, { center: [30.235, 120.1155], zoom: 16 });
    state.map = map;
    const pts = state.points;
    pts.forEach((p, i) => {
      L.marker(MapKit.P(p.lat, p.lng), {
        icon: L.divIcon({
          className: '', iconSize: [26, 26], iconAnchor: [13, 26],
          html: `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#178a56;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:grid;place-items:center">
            <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:600">${i + 1}</span></div>`,
        }),
      }).addTo(map).bindTooltip(p.name, { direction: 'top', offset: [0, -22] })
        .on('click', () => showSheet({ title: p.name, desc: `${p.type} · ${p.address}\n${p.hours}\n电话：${p.phone}`, ok: '拨打', onOk: () => toast('正在呼叫 ' + p.phone) }));
    });
    if (pts.length) {
      map.fitBounds(L.latLngBounds(pts.map((p) => MapKit.P(p.lat, p.lng))), { padding: [40, 40] });
    }
    setTimeout(() => map.invalidateSize(), 120);
    $$('[data-call]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); toast('正在呼叫 ' + b.dataset.call + '（演示）'); }));
    $$('[data-point]').forEach((el2) => el2.addEventListener('click', () => {
      const p = pts.find((x) => x.id === el2.dataset.point);
      map.flyTo(MapKit.P(p.lat, p.lng), 17, { duration: .5 });
      showSheet({ title: p.name, desc: `${p.type} · ${p.address}\n${p.hours}\n电话：${p.phone}`, ok: '拨打', onOk: () => toast('正在呼叫 ' + p.phone) });
    }));
  }

  async function toggleFav(policy, btn) {
    if (!policy) return;
    const exist = state.favs.find((f) => f.targetId === policy.id);
    try {
      if (exist) {
        await api('/api/favorites/' + exist.id, { method: 'DELETE' });
        state.favs = state.favs.filter((f) => f.id !== exist.id);
        toast('已取消收藏');
      } else {
        const item = await api('/api/favorites', { method: 'POST', body: JSON.stringify({ targetType: 'policy', targetId: policy.id, title: policy.title, summary: policy.summary }) });
        state.favs.unshift(item);
        toast('已收藏，可在“我的”中查看');
      }
      render();
    } catch (e) { toast(e.message); }
  }

  function bindFavorites() {
    $$('[data-favopen]').forEach((el) => el.addEventListener('click', () => openPolicy(el.dataset.favopen)));
    $$('[data-favdel]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await api('/api/favorites/' + b.dataset.favdel, { method: 'DELETE' });
        state.favs = state.favs.filter((f) => f.id !== b.dataset.favdel);
        render(); toast('已删除收藏');
      } catch (e) { toast(e.message); }
    }));
  }

  function bindFeedback() {
    $$('[data-fbtype]').forEach((b) => b.addEventListener('click', () => {
      $$('[data-fbtype]').forEach((x) => x.classList.toggle('on', x === b));
    }));
    const btn = $('#fbSubmit');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const content = $('#fbContent').value.trim();
      if (!content) return toast('请填写意见内容');
      const type = ($('.types .on') || {}).dataset ? $('.types .on').dataset.fbtype : '功能建议';
      try {
        await api('/api/feedback', { method: 'POST', body: JSON.stringify({ type, content, contact: $('#fbContact').value.trim(), page: '小程序-意见反馈' }) });
        showSheet({ title: '提交成功', desc: '感谢您的反馈，我们会在 1-2 个工作日内处理（演示）。', ok: '返回', onOk: () => navigate('me') });
        setTimeout(() => { $('#fbContent').value = ''; $('#fbContact').value = ''; }, 100);
      } catch (e) { toast(e.message); }
    });
  }

  /* ---------------- 交互组件 ---------------- */
  function showSheet({ title, desc, ok = '确定', cancel, onOk, onCancel }) {
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML = `<div class="sheet">
      <h3>${esc(title)}</h3>
      <p style="white-space:pre-wrap">${esc(desc || '')}</p>
      <div class="row">
        ${cancel === false ? '' : `<button class="ghost" data-cancel>${esc(cancel || '取消')}</button>`}
        <button class="main" data-ok>${esc(ok)}</button>
      </div>
    </div>`;
    overlayRoot.appendChild(mask);
    const close = () => mask.remove();
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    const c = mask.querySelector('[data-cancel]');
    if (c) c.addEventListener('click', () => { close(); onCancel && onCancel(); });
    mask.querySelector('[data-ok]').addEventListener('click', () => { close(); onOk && onOk(); });
  }

  let toastTimer = null;
  function toast(msg) {
    const old = $('.toast', overlayRoot);
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    overlayRoot.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 1800);
  }

  const voiceSamples = ['农机购置补贴怎么申请？', '医保报销比例是多少？', '高龄津贴怎么领？'];
  function openVoice() {
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML = `<div class="sheet voice-sheet">
      <h3>正在聆听…</h3>
      <div class="wave"><i></i><i></i><i></i><i></i><i></i></div>
      <p>请说出您的问题，例如“农机补贴怎么申请”</p>
      <div class="row"><button class="ghost" data-cancel>取消</button></div>
    </div>`;
    overlayRoot.appendChild(mask);
    let done = false;
    const close = () => { if (done) return; done = true; mask.remove(); };
    mask.querySelector('[data-cancel]').addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    setTimeout(() => {
      if (done) return;
      close();
      const q = voiceSamples[Math.floor(Math.random() * voiceSamples.length)];
      if (state.route !== 'chat') { navigate('chat'); setTimeout(() => ask(q), 120); }
      else ask(q);
    }, 1600);
  }

  /* ---------------- 问答逻辑 ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function ask(text) {
    text = (text || '').trim();
    if (!text) return;
    if (state.route !== 'chat') navigate('chat');
    state.chat.push({ role: 'user', text });
    const typing = { role: 'ai', typing: true };
    state.chat.push(typing);
    render();
    try {
      const data = await api('/api/qa/ask', { method: 'POST', body: JSON.stringify({ question: text }) });
      typing.typing = false;
      if (data.matched) {
        typing.text = '为您找到相关政策，整理如下：';
        typing.policy = { ...data.answer, policyId: data.answer.policyId };
      } else {
        typing.text = '暂未找到完全匹配的政策。您可以换个说法，或直接转人工咨询（08:30-17:00）。';
      }
    } catch (e) {
      typing.typing = false;
      typing.text = '服务暂时不可用：' + e.message;
    }
    render();
    setTimeout(scrollChatBottom, 60);
  }

  function scrollChatBottom() {
    const l = document.getElementById('chatList');
    if (l) l.scrollTop = l.scrollHeight;
  }

  async function openPolicy(id) {
    try {
      state.policy = null;
      navigate('answer', { id });
      const p = await api('/api/policies/' + id);
      state.policy = p;
      render();
      screen.scrollTop = 0;
    } catch (e) { toast(e.message); }
  }

  /* ---------------- 启动 ---------------- */
  (async function boot() {
    try {
      const [cats, notices, services, points, stats, favs] = await Promise.all([
        api('/api/categories'), api('/api/notices'), api('/api/services'),
        api('/api/service-points'), api('/api/overview'), api('/api/favorites'),
      ]);
      state.cats = cats; state.notices = notices; state.services = services;
      state.points = points; state.stats = stats.stats; state.favs = favs;
      render();
    } catch (e) {
      screen.innerHTML = `<div class="empty" style="padding-top:120px">加载失败：${esc(e.message)}<br><br>请确认本地服务已启动</div>`;
    }
  })();
})();
