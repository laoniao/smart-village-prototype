/* 地图公共能力：底图服务（配置驱动）、坐标纠偏（WGS84 <-> GCJ02）、图层切换
 *
 * 底图不再写死在前端：默认加载 /api/map/config，服务端由 data/map-providers.json 描述
 * 各底图服务（Esri / 高德 / 天地图 / 自建瓦片），配置缺失时回退到内置的 FALLBACK。
 * 新增底图只需改服务端 JSON（或设置环境变量），前端无需改动。
 */
(function () {
  const PI = Math.PI, A = 6378245.0, EE = 0.00669342162296594323;

  function outOfChina(lat, lng) {
    return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
  }
  function tLat(x, y) {
    let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
    return r;
  }
  function tLng(x, y) {
    let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
    r += (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
    return r;
  }
  function wgs2gcj(lat, lng) {
    if (outOfChina(lat, lng)) return [lat, lng];
    let dLat = tLat(lng - 105, lat - 35);
    let dLng = tLng(lng - 105, lat - 35);
    const radLat = lat / 180 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - EE * magic * magic;
    const sq = Math.sqrt(magic);
    dLat = (dLat * 180) / ((A * (1 - EE)) / (magic * sq) * PI);
    dLng = (dLng * 180) / (A / sq * Math.cos(radLat) * PI);
    return [lat + dLat, lng + dLng];
  }

  /* ---------------- 底图服务注册表 ---------------- */
  /** 兜底配置：接口不可用时也能正常演示 */
  const FALLBACK = [
    {
      id: 'esri-img', name: 'Esri 卫星影像', short: '影像', group: 'satellite', crs: 'wgs84',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      annoUrl: '',
      options: { maxZoom: 18, maxNativeZoom: 18, attribution: '影像底图 © Esri · 演示用途' },
      needKey: false, enabled: true, available: true, desc: '内置兜底影像底图'
    },
    {
      id: 'amap-vec', name: '高德矢量地图', short: '矢量', group: 'vector', crs: 'gcj02',
      url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      annoUrl: 'https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8',
      options: { subdomains: '1234', maxZoom: 18, maxNativeZoom: 18, attribution: '矢量底图 © 高德 · 演示用途' },
      needKey: false, enabled: true, available: true, desc: '内置兜底矢量底图（GCJ02）'
    }
  ];

  let PROVIDERS = FALLBACK.slice();
  let DEFAULT_ID = 'esri-img';
  let configLoaded = false;
  let configPromise = null;
  let rawConfig = null;

  function usable(p) {
    return p && p.enabled !== false && p.available !== false;
  }
  function byId(id) {
    return PROVIDERS.find((p) => p.id === id) || null;
  }
  function byGroup(group) {
    return PROVIDERS.find((p) => usable(p) && p.group === group) || null;
  }
  /** 名称可以是 provider id（esri-img），也可以是分组名（satellite / vector） */
  function resolve(name) {
    if (!name) return byId(DEFAULT_ID) || byGroup('satellite') || PROVIDERS[0];
    return byId(name) || byGroup(name) || byId(DEFAULT_ID) || PROVIDERS[0];
  }

  /** 构建瓦片图层组（底图 + 可选注记层） */
  function buildLayers(p) {
    const opt = Object.assign({}, p.options || {});
    const layers = [L.tileLayer(p.url, opt)];
    if (p.annoUrl) {
      layers.push(L.tileLayer(p.annoUrl, Object.assign({}, p.options || {}, {
        attribution: '', opacity: opt.opacity != null ? opt.opacity : 0.9
      })));
    }
    return layers;
  }

  const MapKit = {
    gcj: false,
    wgs2gcj,

    /** 拉取服务端底图配置；页面可 await，也可不 await（会自动回退） */
    loadConfig(force) {
      if (configLoaded && !force) return Promise.resolve(rawConfig);
      if (configPromise && !force) return configPromise;
      configPromise = fetch('/api/map/config')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const d = j && j.data;
          if (!d || !Array.isArray(d.providers) || !d.providers.length) return null;
          rawConfig = d;
          PROVIDERS = d.providers.filter((p) => p && p.id);
          const cur = byId(d.current);
          DEFAULT_ID = cur && usable(cur) ? d.current
            : (byGroup(d.defaultGroup || 'satellite') || PROVIDERS.find(usable) || PROVIDERS[0] || {}).id;
          configLoaded = true;
          return d;
        })
        .catch(() => null);
      return configPromise;
    },

    /** 可用底图列表（供 UI 渲染） */
    providers(all) {
      return all ? PROVIDERS.slice() : PROVIDERS.filter(usable);
    },
    /** 分组列表：satellite / vector ... */
    groups() {
      const seen = [];
      PROVIDERS.filter(usable).forEach((p) => {
        if (seen.indexOf(p.group) < 0) seen.push(p.group);
      });
      return seen;
    },
    config() { return rawConfig; },
    current() { return byId(DEFAULT_ID); },
    provider(id) { return byId(id); },

    /** 逻辑坐标 -> 当前底图坐标；gcj 可显式传入，避免多地图互相影响 */
    P(lat, lng, gcj) {
      const use = gcj === undefined ? MapKit.gcj : !!gcj;
      if (!use) return [lat, lng];
      const g = wgs2gcj(lat, lng);
      return [g[0], g[1]];
    },

    create(el, opts) {
      opts = opts || {};
      const start = resolve(opts.base || DEFAULT_ID);
      const map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        center: MapKit.P(opts.center[0], opts.center[1], start && start.crs === 'gcj02'),
        zoom: opts.zoom || 16,
        minZoom: opts.minZoom || 12,
        maxZoom: opts.maxZoom || 18,
        zoomSnap: 1,
        preferCanvas: true,
        tap: false
      });
      map.attributionControl.setPrefix('');
      map.baseLayers = {};
      map.baseLayers[start.id] = L.layerGroup(buildLayers(start));
      map.baseLayers[start.id].addTo(map);
      map.currentProvider = start.id;
      map.currentBase = start.group;
      map.useGcj = start.crs === 'gcj02';
      MapKit.gcj = map.useGcj;
      const container = map.getContainer();
      if (container) {
        container.dataset.base = start.group;
        container.dataset.provider = start.id;
      }
      return map;
    },

    /**
     * 切换底图。name 可为 provider id 或分组名；切换时同步更新坐标纠偏状态，
     * 并调用 onSwitch 让页面重绘业务图层（WGS84 逻辑坐标不变）。
     */
    setBase(map, name, logicalCenter, onSwitch) {
      const p = resolve(name);
      if (!p) return;
      MapKit.gcj = p.crs === 'gcj02';
      map.useGcj = MapKit.gcj;
      Object.keys(map.baseLayers).forEach((k) => map.removeLayer(map.baseLayers[k]));
      if (!map.baseLayers[p.id]) map.baseLayers[p.id] = L.layerGroup(buildLayers(p));
      map.baseLayers[p.id].addTo(map);
      map.currentProvider = p.id;
      map.currentBase = p.group;
      if (logicalCenter) {
        map.setView(MapKit.P(logicalCenter[0], logicalCenter[1], map.useGcj), map.getZoom(), { animate: false });
      }
      if (typeof onSwitch === 'function') onSwitch();
      const el = map.getContainer();
      if (el) {
        el.dataset.base = p.group;
        el.dataset.provider = p.id;
      }
      return p;
    },

    /** 圆点样式（农户状态色） */
    householdColor(status) {
      return status === '闲置' ? '#94a3b8' : status === '待核查' ? '#f59e0b' : '#2f7cf6';
    }
  };

  window.MapKit = MapKit;
})();
