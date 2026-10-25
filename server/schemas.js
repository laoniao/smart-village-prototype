/**
 * 录入模板 / 字段元数据 / 校验规则
 * ------------------------------------------------------------
 * 所有录入（单条表单、批量粘贴、CSV 导入）都从这里取字段定义，
 * 前端据此渲染表单、下载模板、展示校验结果；服务端据此二次校验。
 * 新增一类数据只需要在这里加一段。
 */

/** 示范村大致范围，用于“超出范围”提示（仅警告，不阻断） */
const VILLAGE_BBOX = { latMin: 30.215, latMax: 30.255, lngMin: 120.098, lngMax: 120.134 };

/** 房屋状态：后两项为「退出台账」的标记，不删除记录，只从常住户统计中排除 */
const STATUSES = ['正常', '待核查', '闲置', '已搬迁', '已拆除'];
const RETIRED_STATUSES = ['已搬迁', '已拆除'];
const CARE_TAGS = ['无', '留守老人', '独居老人', '低保户', '残疾人', '困境儿童'];
const POINT_TYPES = ['便民服务', '医疗健康', '文化活动', '养老服务', '生活服务', '政务代办'];
const PROTOCOLS = ['gb28181', 'rtsp', 'hls', 'rtmp', 'webrtc'];
const CAM_STATUS = ['online', 'offline', 'fault'];
const NOTICE_CATS = ['本地通知', '医保社保', '惠农政策', '医疗健康', '民生政务', '农业生产'];
const EVENT_CATS = ['安全', '防汛', '环保', '设施', '环境', '民生', '其他'];

const SCHEMAS = {
  /* ------------------------------- 农户台账 ------------------------------- */
  households: {
    label: '农户台账',
    icon: 'home',
    desc: '一户一行。户号须唯一；经纬度用于地图落点，留空则按门牌地址近似补点。',
    uniqueKey: 'houseNo',
    fields: [
      { key: 'houseNo', label: '户号', type: 'text', required: true, sample: 'A-429', desc: '格式建议：组别字母-序号，如 A-001', pattern: /^[A-Za-z]-\d{3,}$/, patternMsg: '建议格式为「字母-三位数字」，如 A-001' },
      { key: 'owner', label: '户主姓名', type: 'text', required: true, sample: '陈某', desc: '演示环境请使用脱敏姓名（陈某 / 张某某）' },
      { key: 'group', label: '所属组别', type: 'select', required: true, options: ['一组', '二组', '三组', '四组', '五组', '六组'], sample: '一组' },
      { key: 'address', label: '门牌地址', type: 'text', required: true, sample: '示范村一组128号' },
      { key: 'members', label: '家庭成员数', type: 'number', required: true, min: 1, max: 20, unit: '人', sample: 3 },
      { key: 'houseStatus', label: '房屋状态', type: 'select', options: STATUSES, required: true, sample: '正常' },
      { key: 'care', label: '关怀标签', type: 'select', options: CARE_TAGS, sample: '无' },
      { key: 'builtYear', label: '建造年份', type: 'number', min: 1900, max: 2030, sample: 2005, desc: '四位年份' },
      { key: 'area', label: '建筑面积', type: 'number', min: 10, max: 1000, unit: '㎡', sample: 132 },
      { key: 'lat', label: '纬度', type: 'number', min: 3, max: 54, sample: 30.2351, desc: 'WGS84 坐标，保留 6 位小数' },
      { key: 'lng', label: '经度', type: 'number', min: 73, max: 136, sample: 120.1157, desc: 'WGS84 坐标，保留 6 位小数' },
      { key: 'phone', label: '联系电话', type: 'text', sample: '138****2468', desc: '建议填写脱敏号码，完整号码仅管理员可维护' },
      { key: 'note', label: '备注', type: 'textarea', sample: '' },
    ],
  },

  /* ------------------------------- 服务网点 ------------------------------- */
  points: {
    label: '服务网点',
    icon: 'pin',
    desc: '村级服务场所台账。经纬度必填，用于在村户一张图上标注。',
    uniqueKey: 'name',
    fields: [
      { key: 'name', label: '网点名称', type: 'text', required: true, sample: '示范村邻里中心' },
      { key: 'type', label: '网点类型', type: 'select', required: true, options: POINT_TYPES, sample: '便民服务' },
      { key: 'services', label: '可办事项', type: 'text', sample: '事项代办、证明开具、政策咨询' },
      { key: 'address', label: '地址', type: 'text', required: true, sample: '示范村文化路 12 号' },
      { key: 'hours', label: '服务时间', type: 'text', sample: '08:30-17:00（周一至周五）' },
      { key: 'phone', label: '联系电话', type: 'text', sample: '0572-****101' },
      { key: 'lat', label: '纬度', type: 'number', required: true, min: 3, max: 54, sample: 30.2358 },
      { key: 'lng', label: '经度', type: 'number', required: true, min: 73, max: 136, sample: 120.1154 },
    ],
  },

  /* ------------------------------- 视频监控 ------------------------------- */
  cameras: {
    label: '视频监控设备',
    icon: 'camera',
    desc: '设备编号按 GB/T 28181 编码规则填写（20 位数字）。协议决定取流方式，演示环境不会真正拉流。',
    uniqueKey: 'deviceId',
    fields: [
      { key: 'name', label: '点位名称', type: 'text', required: true, sample: '茶山入口' },
      { key: 'deviceId', label: '设备编号', type: 'text', required: true, sample: '33052100001320000013', desc: 'GB/T 28181 20 位编码', pattern: /^\d{20}$/, patternMsg: '应为 20 位数字（GB/T 28181 编码）' },
      { key: 'kind', label: '点位类型', type: 'select', options: ['主要出入口', '重点路段', '公共活动', '公共服务', '水域防汛', '村组路口', '桥梁涵洞', '重点关怀', '生活服务', '公共停车场', '农林防火'], sample: '农林防火' },
      { key: 'vendor', label: '厂商', type: 'select', options: ['海康威视', '大华股份', '宇视科技', '天地伟业', '其他'], sample: '海康威视' },
      { key: 'protocol', label: '接入协议', type: 'select', required: true, options: PROTOCOLS, sample: 'gb28181', desc: 'gb28181 / rtsp / hls / rtmp / webrtc' },
      { key: 'streamUrl', label: '取流地址', type: 'text', sample: 'rtsp://10.18.11.33:554/Streaming/Channels/1301', desc: '以 rtsp://、http:// 开头' },
      { key: 'resolution', label: '分辨率', type: 'select', options: ['1920×1080', '2560×1440', '3840×2160', '1280×720'], sample: '2560×1440' },
      { key: 'ptz', label: '是否球机', type: 'select', options: ['是', '否'], sample: '是', desc: '球机支持云台控制' },
      { key: 'direction', label: '安装方向角', type: 'number', min: 0, max: 360, unit: '°', sample: 121, desc: '正北为 0，顺时针' },
      { key: 'radius', label: '可视半径', type: 'number', min: 10, max: 300, unit: 'm', sample: 90 },
      { key: 'aiTags', label: 'AI 能力', type: 'text', sample: '烟火检测,越界检测', desc: '多个用逗号分隔' },
      { key: 'installAt', label: '安装日期', type: 'date', sample: '2026-01-06' },
      { key: 'lat', label: '纬度', type: 'number', required: true, min: 3, max: 54, sample: 30.2361 },
      { key: 'lng', label: '经度', type: 'number', required: true, min: 73, max: 136, sample: 120.1161 },
      { key: 'status', label: '设备状态', type: 'select', options: CAM_STATUS, sample: 'online', desc: 'online / offline / fault' },
    ],
  },

  /* ------------------------------- 通知公告 ------------------------------- */
  notices: {
    label: '通知公告',
    icon: 'doc',
    desc: '发布后在小程序「通知信息」中可见；设为重要的通知会在首页置顶。',
    uniqueKey: 'title',
    fields: [
      { key: 'title', label: '标题', type: 'text', required: true, sample: '2026 年度城乡居民医保缴费开始' },
      { key: 'category', label: '分类', type: 'select', required: true, options: NOTICE_CATS, sample: '医保社保' },
      { key: 'summary', label: '内容摘要', type: 'textarea', required: true, sample: '缴费标准为每人 630 元，可通过小程序线上办理。' },
      { key: 'important', label: '是否重要', type: 'select', options: ['是', '否'], sample: '是' },
      { key: 'publishAt', label: '发布日期', type: 'date', sample: '2026-10-25' },
    ],
  },

  /* ------------------------------- 事件记录 ------------------------------- */
  events: {
    label: '事件记录',
    icon: 'alert',
    desc: '网格员上报的事件，支持在地图上落点；状态由管理员确认处置。',
    uniqueKey: 'title',
    fields: [
      { key: 'title', label: '事件标题', type: 'text', required: true, sample: '四组路灯不亮' },
      { key: 'category', label: '事件类别', type: 'select', required: true, options: EVENT_CATS, sample: '设施' },
      { key: 'desc', label: '情况描述', type: 'textarea', sample: '村民反映四组主干道路灯不亮，夜间出行存在隐患。' },
      { key: 'reportedAt', label: '上报时间', type: 'text', required: true, sample: '2026-10-25 09:20', desc: '格式：YYYY-MM-DD HH:mm' },
      { key: 'reporter', label: '上报人', type: 'text', sample: '网格员 王某' },
      { key: 'lat', label: '纬度', type: 'number', min: 3, max: 54, sample: 30.2348 },
      { key: 'lng', label: '经度', type: 'number', min: 73, max: 136, sample: 120.1162 },
      { key: 'status', label: '处置状态', type: 'select', options: ['待处置', '处置中', '已处置', '已作废'], sample: '待处置', desc: '已作废 = 误报或重复上报，保留记录但不计入考核' },
    ],
  },
};

/* ------------------------------- 校验 ------------------------------- */
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;

/**
 * 校验一行数据。
 * @returns {{errors: Array, warnings: Array, value: Object}}
 */
function validateRow(entity, raw) {
  const schema = SCHEMAS[entity];
  const errors = [];
  const warnings = [];
  const value = {};
  if (!schema) return { errors: [{ key: '_', msg: '未知的数据类型：' + entity }], warnings, value };

  schema.fields.forEach((f) => {
    let v = raw[f.key];
    if (typeof v === 'string') v = v.trim();
    if (f.type === 'tags' && typeof v === 'string') v = v.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);

    if (isBlank(v)) {
      if (f.required) errors.push({ key: f.key, label: f.label, msg: `${f.label}不能为空` });
      value[f.key] = f.type === 'number' ? null : '';
      return;
    }

    if (f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) { errors.push({ key: f.key, label: f.label, msg: `${f.label}必须是数字` }); return; }
      if (f.min !== undefined && n < f.min) errors.push({ key: f.key, label: f.label, msg: `${f.label}不能小于 ${f.min}` });
      if (f.max !== undefined && n > f.max) errors.push({ key: f.key, label: f.label, msg: `${f.label}不能大于 ${f.max}` });
      value[f.key] = n;
      // 坐标越界提示
      if (f.key === 'lat' || f.key === 'lng') {
        const out = f.key === 'lat' ? (n < VILLAGE_BBOX.latMin || n > VILLAGE_BBOX.latMax)
          : (n < VILLAGE_BBOX.lngMin || n > VILLAGE_BBOX.lngMax);
        if (out) warnings.push({ key: f.key, label: f.label, msg: `${f.label} ${n} 超出示范村范围，点位可能落在村域外` });
      }
      return;
    }

    if (f.type === 'date' && !DATE_RE.test(String(v))) {
      errors.push({ key: f.key, label: f.label, msg: `${f.label}格式应为 YYYY-MM-DD` });
    }
    if (f.key === 'reportedAt' && !DATETIME_RE.test(String(v))) {
      warnings.push({ key: f.key, label: f.label, msg: '上报时间建议为 YYYY-MM-DD HH:mm' });
    }
    if (f.options && f.options.indexOf(String(v)) < 0) {
      errors.push({ key: f.key, label: f.label, msg: `${f.label}“${v}”不在可选范围内（${f.options.join(' / ')}）` });
    }
    if (f.pattern && !f.pattern.test(String(v))) {
      warnings.push({ key: f.key, label: f.label, msg: f.patternMsg || `${f.label}格式不符合建议规范` });
    }
    if (f.key === 'streamUrl' && !/^(rtsp|rtmp|http|https):\/\//i.test(String(v))) {
      warnings.push({ key: f.key, label: f.label, msg: '取流地址应以 rtsp://、rtmp:// 或 http(s):// 开头' });
    }
    value[f.key] = v;
  });

  return { errors, warnings, value };
}

/** 归一化：把 AI 能力等字符串转数组，布尔化球机字段 */
function normalize(entity, value) {
  const out = Object.assign({}, value);
  if (entity === 'cameras') {
    if (typeof out.aiTags === 'string') {
      out.aiTags = out.aiTags.split(/[,，;；]/).map((s) => s.trim()).filter(Boolean);
    }
    out.ptz = String(out.ptz) === '是' || out.ptz === true;
  }
  if (entity === 'notices') out.important = String(out.important) === '是' || out.important === true;
  if (entity === 'households' || entity === 'events') {
    ['lat', 'lng'].forEach((k) => { if (out[k] === null) delete out[k]; });
  }
  return out;
}

/* ------------------------------- 模板 / 解析 ------------------------------- */

/** 生成 CSV 模板（首行为中文表头 + 两行示例） */
function toCsv(entity) {
  const schema = SCHEMAS[entity];
  if (!schema) return '';
  const head = schema.fields.map((f) => f.label).join(',');
  const row = (n) => schema.fields.map((f) => {
    let v = f.sample;
    if (n === 2) {
      // 第二行示例做一点变化，方便看出可填写的形态；唯一键必须不同，否则示例自身会被判重复
      if (f.key === schema.uniqueKey) {
        const s0 = String(v == null ? '' : v);
        v = /\d+$/.test(s0) ? s0.replace(/(\d+)$/, (m) => String(Number(m) + 1).padStart(m.length, '0')) : s0 + '-2';
      } else if (f.key === 'lat' || f.key === 'lng') {
        v = typeof f.sample === 'number' ? Math.round((f.sample + 0.0008) * 1e6) / 1e6 : f.sample;
      } else if (f.type === 'date' || f.type === 'datetime') {
        v = f.sample;                    // 日期保持合法，避免示例自身校验失败
      } else if (f.type === 'select' && f.options && f.options.length > 1) {
        v = f.options[f.options.length - 1];
      } else if (f.type === 'number') {
        v = typeof f.sample === 'number' ? f.sample + 1 : f.sample;
      } else if (typeof v === 'string' && v && !f.pattern) {
        v = v + '（示例）';
      }
    }
    const s = String(v === undefined || v === null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',');
  return '﻿' + [head, row(1), row(2)].join('\r\n') + '\r\n';
}

/** 模板元信息（供页面渲染字段说明表） */
function describe(entity) {
  const s = SCHEMAS[entity];
  if (!s) return null;
  return {
    entity, label: s.label, icon: s.icon, desc: s.desc, uniqueKey: s.uniqueKey,
    fields: s.fields.map(({ key, label, type, required, options, min, max, unit, desc, sample }) =>
      ({ key, label, type, required: !!required, options, min, max, unit, desc, sample })),
  };
}

/**
 * 解析分隔符文本（支持从 Excel 直接粘贴的 TSV、CSV 或分号分隔）。
 * 首行为表头，按「表头=字段名或中文名」映射。
 */
function parseText(entity, text) {
  const schema = SCHEMAS[entity];
  if (!schema) return [];
  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const delim = (() => {
    const cands = ['\t', ',', ';', '|'];
    let best = ',', bestN = 0;
    cands.forEach((d) => { const n = (lines[0].split(d).length - 1); if (n > bestN) { bestN = n; best = d; } });
    return best;
  })();
  const split = (line) => {
    // 简易 CSV：支持双引号包裹
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === delim && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const head = split(lines[0]);
  const map = head.map((h) => schema.fields.find((f) => f.label === h || f.key === h) || null);
  return lines.slice(1).map((ln, i) => {
    const cells = split(ln);
    const raw = { _line: i + 2 };
    map.forEach((f, idx) => { if (f) raw[f.key] = cells[idx]; });
    return raw;
  });
}

module.exports = {
  SCHEMAS, describe, validateRow, normalize, toCsv, parseText,
  entityList: () => Object.keys(SCHEMAS).map((k) => ({ entity: k, label: SCHEMAS[k].label, icon: SCHEMAS[k].icon, desc: SCHEMAS[k].desc })),
  VILLAGE_BBOX, STATUSES, RETIRED_STATUSES,
};
