/* 地图公共能力：底图、坐标纠偏（WGS84 <-> GCJ02）、图层切换 */
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

  const TILES = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: { maxZoom: 18, maxNativeZoom: 18, attribution: '影像底图 © Esri · 演示用途' }
    },
    vector: {
      url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
      options: { subdomains: '1234', maxZoom: 18, maxNativeZoom: 18, attribution: '矢量底图 © 高德 · 演示用途' }
    },
    vectorAnno: {
      url: 'https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=8',
      options: { subdomains: '1234', maxZoom: 18, maxNativeZoom: 18, opacity: 0.9 }
    }
  };

  const MapKit = {
    gcj: false,
    wgs2gcj,
    /** 逻辑坐标 -> 当前底图坐标；gcj 可显式传入，避免多地图互相影响 */
    P(lat, lng, gcj) {
      const use = gcj === undefined ? MapKit.gcj : !!gcj;
      if (!use) return [lat, lng];
      const g = wgs2gcj(lat, lng);
      return [g[0], g[1]];
    },
    create(el, opts) {
      const map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        center: MapKit.P(opts.center[0], opts.center[1]),
        zoom: opts.zoom || 16,
        minZoom: 12,
        maxZoom: 18,
        zoomSnap: 1,
        preferCanvas: true,
        tap: false
      });
      map.attributionControl.setPrefix('');
      map.baseLayers = {};
      map.baseLayers.satellite = L.layerGroup([
        L.tileLayer(TILES.satellite.url, TILES.satellite.options)
      ]);
      map.baseLayers.vector = L.layerGroup([
        L.tileLayer(TILES.vector.url, TILES.vector.options),
        L.tileLayer(TILES.vectorAnno.url, TILES.vectorAnno.options)
      ]);
      map.baseLayers.satellite.addTo(map);
      map.currentBase = 'satellite';
      map.useGcj = false;
      return map;
    },
    /**
     * 切换底图。切换时同步更新坐标纠偏状态，并调用 onSwitch 让页面重绘业务图层。
     */
    setBase(map, name, logicalCenter, onSwitch) {
      const target = name === 'vector';
      MapKit.gcj = target;
      map.useGcj = target;
      Object.keys(map.baseLayers).forEach((k) => map.removeLayer(map.baseLayers[k]));
      map.baseLayers[name].addTo(map);
      map.currentBase = name;
      if (logicalCenter) map.setView(MapKit.P(logicalCenter[0], logicalCenter[1], map.useGcj), map.getZoom(), { animate: false });
      if (typeof onSwitch === 'function') onSwitch();
      const el = map.getContainer();
      el.dataset.base = name;
    },
    /** 圆点样式（农户状态色） */
    householdColor(status) {
      return status === '闲置' ? '#94a3b8' : status === '待核查' ? '#f59e0b' : '#2f7cf6';
    }
  };

  window.MapKit = MapKit;
})();
