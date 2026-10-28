(function () {
  "use strict";

  var COLORES = { navy: "#001A4F", azul: "#006FC9", cian: "#4FC3F7", ambar: "#FFB900", rosa: "#FF5C8A", blanco: "#FBFAF6" };
  var RAMPA = ["#0B3A7A", "#006FC9", "#4FC3F7", "#FFB900", "#FF5C8A"];
  var ALTURA_MAX = 320;

  var ICONOS = {
    densidad: "M3 21V10l6-4v15M9 21V4l6 3v14M15 21v-9l6-3v12",
    acueducto: "M12 2.5s6.5 7.5 6.5 12a6.5 6.5 0 0 1-13 0c0-4.5 6.5-12 6.5-12z",
    alcantarillado: "M4 7h16M4 12h16M4 17h16M8 4v16M16 4v16",
    internet: "M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01",
    salud: "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z",
    educacion: "M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5",
    seguridad: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
    estrato: "M4 20h4v-6H4zM10 20h4V9h-4zM16 20h4V4h-4z",
    ambiente: "M5 21c0-9 5-15 15-16-1 10-6 15-15 16zM5 21l8-8",
    necesidad: "M12 2l2.6 6.3L21 9l-5 4.4L17.5 20 12 16.6 6.5 20 8 13.4 3 9l6.4-.7z"
  };

  var LENTES = [
    { id: "necesidad", nombre: "Prioridad", campo: "necesidad", fijos: [0, 20, 40, 60, 80], titulo: "Índice de necesidad", unidad: "pts", nota: "0 a 100 · combina carencias de servicios y distancia a equipamientos con los pesos elegidos" },
    { id: "ambiente", nombre: "Ambiente", campo: null, titulo: "Estructura ecológica", unidad: "", nota: "Río, humedales y coberturas verdes de OpenStreetMap; no son límites oficiales del POT" },
    { id: "densidad", nombre: "Densidad", campo: "densidad_hab_ha", titulo: "Densidad de población", unidad: "hab/ha", nota: "Personas por hectárea · Censo DANE 2018" },
    { id: "acueducto", nombre: "Acueducto", campo: "pct_sin_acueducto", titulo: "Viviendas sin acueducto", unidad: "%", nota: "Porcentaje de viviendas · Censo DANE 2018" },
    { id: "alcantarillado", nombre: "Alcantarillado", campo: "pct_sin_alcantarillado", titulo: "Viviendas sin alcantarillado", unidad: "%", nota: "Porcentaje de viviendas · Censo DANE 2018" },
    { id: "internet", nombre: "Internet", campo: "pct_sin_internet", titulo: "Hogares sin internet", unidad: "%", nota: "Porcentaje de viviendas · Censo DANE 2018" },
    { id: "salud", nombre: "Salud", campo: "dist_salud_m", titulo: "Distancia a salud", unidad: "m", nota: "Línea recta al equipamiento más cercano · OSM" },
    { id: "educacion", nombre: "Educación", campo: "dist_educacion_m", titulo: "Distancia a educación", unidad: "m", nota: "Línea recta al equipamiento más cercano · OSM" },
    { id: "seguridad", nombre: "Seguridad", campo: "dist_seguridad_m", titulo: "Distancia a seguridad", unidad: "m", nota: "Línea recta al equipamiento más cercano · OSM" },
    { id: "estrato", nombre: "Estrato", campo: "estrato_modal", titulo: "Estrato modal", unidad: "", nota: "Estrato más frecuente de la manzana · DANE 2018" }
  ];

  var SECTORES = {
    salud: "Salud", educacion: "Educación", movilidad_infraestructura_vial: "Movilidad y vías",
    agua_potable_saneamiento: "Agua y saneamiento", espacio_publico_deporte_recreacion: "Espacio público y deporte",
    vivienda_habitat: "Vivienda", energia_alumbrado: "Energía y alumbrado", desarrollo_rural_productivo: "Desarrollo rural",
    cultura_patrimonio_turismo: "Cultura y turismo", equipamientos_infraestructura_general: "Equipamientos",
    conectividad_digital: "Conectividad", por_clasificar: "Por clasificar"
  };
  var CATEGORIAS = {
    salud: "Salud", educacion: "Educación", seguridad: "Seguridad", recreacion: "Recreación",
    abastecimiento: "Abastecimiento", institucional: "Institucional", transporte: "Transporte"
  };
  var COLOR_CATEGORIA = {
    salud: "#FF5C8A", educacion: "#4FC3F7", seguridad: "#B39DFF", recreacion: "#5EE6A8",
    abastecimiento: "#FFB900", institucional: "#FBFAF6", transporte: "#93A6C4"
  };

  var estado = {
    lente: "densidad", tres_d: true, seleccion: null, cortes: {}, medianas: {},
    secop: null, secopAnio: null, secopSector: "", secopTexto: "", secopPagina: 0, reproduciendo: null
  };
  var datos = {};
  var mapa;

  function $(sel) { return document.querySelector(sel); }
  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "texto") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (h) { if (h) n.appendChild(typeof h === "string" ? document.createTextNode(h) : h); });
    return n;
  }
  function icono(d) {
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
  }
  var INFO = icono("M12 11v6M12 7.5v.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z");
  function num(v, dec) {
    if (v == null || isNaN(v)) return "s. d.";
    return Number(v).toLocaleString("es-CO", { maximumFractionDigits: dec == null ? 0 : dec, minimumFractionDigits: dec || 0 });
  }
  function pesos(v) {
    if (!v) return "s. d.";
    if (v >= 1e12) return "$" + num(v / 1e12, 1) + " billones";
    if (v >= 1e9) return "$" + num(v / 1e9, 1) + " mil M";
    if (v >= 1e6) return "$" + num(v / 1e6, 0) + " M";
    return "$" + num(v);
  }
  function normalizar(t) { return (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function cuantil(ordenados, q) {
    if (!ordenados.length) return 0;
    var i = (ordenados.length - 1) * q, b = Math.floor(i);
    return ordenados[b] + (ordenados[Math.min(b + 1, ordenados.length - 1)] - ordenados[b]) * (i - b);
  }
  function lenteActual() { return LENTES.filter(function (l) { return l.id === estado.lente; })[0]; }
  function cargar(ruta) {
    return fetch(ruta).then(function (r) {
      if (!r.ok) throw new Error(ruta + ": " + r.status);
      return r.json();
    });
  }
  function contar(nodo, destino, dec, sufijo) {
    var inicio = performance.now(), dur = 1200;
    function paso(t) {
      var p = Math.min(1, (t - inicio) / dur), e = 1 - Math.pow(1 - p, 3);
      nodo.textContent = num(destino * e, dec) + (sufijo || "");
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  // ---------- Estadísticos por lente ----------
  function calcularCortes() {
    var fs = datos.manzanas.features;
    LENTES.forEach(function (l) {
      if (!l.campo) return;
      if (l.fijos) {
        var v2 = fs.map(function (f) { return f.properties[l.campo]; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
        estado.cortes[l.id] = l.fijos; estado.medianas[l.id] = cuantil(v2, 0.5);
        return;
      }
      var vals = fs.map(function (f) { return f.properties[l.campo]; })
        .filter(function (v) { return v != null && !isNaN(v); }).sort(function (a, b) { return a - b; });
      var c = [0, 0.25, 0.5, 0.75, 0.96].map(function (q) { return cuantil(vals, q); });
      // interpolate exige paradas estrictamente crecientes
      for (var i = 1; i < c.length; i++) if (c[i] <= c[i - 1]) c[i] = c[i - 1] + 0.001;
      estado.cortes[l.id] = c;
      estado.medianas[l.id] = cuantil(vals, 0.5);
    });
  }
  function expresionColor() {
    var l = lenteActual(), c = estado.cortes[l.id];
    if (!l.campo) return ["case", ["boolean", ["feature-state", "sel"], false], COLORES.blanco,
      ["boolean", ["feature-state", "hover"], false], "#FFE08A", "#3A5A99"];
    var expr = ["interpolate", ["linear"], ["coalesce", ["get", l.campo], c[0]]];
    c.forEach(function (v, i) { expr.push(v, RAMPA[i]); });
    return ["case", ["boolean", ["feature-state", "sel"], false], COLORES.blanco,
      ["boolean", ["feature-state", "hover"], false], "#FFE08A", expr];
  }
  function expresionAltura() {
    var l = lenteActual(), c = estado.cortes[l.id];
    if (!estado.tres_d || !l.campo) return 0;
    var h = ["interpolate", ["linear"], ["coalesce", ["get", l.campo], c[0]],
      c[0], 4, c[2], ALTURA_MAX * 0.3, c[4], ALTURA_MAX];
    // Al acercarse la altura se reduce para que las manzanas sigan leyéndose como relieve
    return ["interpolate", ["linear"], ["zoom"], 12.5, h, 14, ["*", h, 0.25], 15.5, ["*", h, 0.06]];
  }

  // ---------- Mapa ----------
  // Mapa base vectorial (OpenFreeMap, esquema OpenMapTiles): permite dibujar el agua,
  // los humedales y las coberturas verdes con estilo propio en lugar de una imagen fija.
  var ECO = {
    agua: { color: "#0E4C80", borde: "#4FC3F7", nombre: "Río y cuerpos de agua" },
    humedal: { color: "#0E5A5A", borde: "#2DD4BF", nombre: "Humedales y ciénagas" },
    bosque: { color: "#14532D", borde: "#5EE6A8", nombre: "Bosques y rondas arboladas" },
    verde: { color: "#1C4A2E", borde: "#86EFAC", nombre: "Parques y zonas verdes" }
  };
  var CAPAS_ECO = ["eco-agua", "eco-humedal", "eco-bosque", "eco-verde"];
  function estiloBase() {
    return {
      version: 8,
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: {},
      layers: [{ id: "fondo", type: "background", paint: { "background-color": "#000B22" } }]
    };
  }
  // El mapa base se agrega después de cargar el visor: si OpenFreeMap no responde,
  // el geovisor sigue funcionando con sus propias capas sobre fondo liso.
  function montarBase(antesDe) {
    mapa.addSource("omt", {
      type: "vector", url: "https://tiles.openfreemap.org/planet",
      attribution: '© <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · DANE 2018'
    });
    mapa.addSource("satelite", {
      type: "raster", tileSize: 256, maxzoom: 19,
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      attribution: "Imágenes © Esri, Maxar, Earthstar Geographics"
    });
    mapa.addLayer({ id: "satelite", type: "raster", source: "satelite", layout: { visibility: "none" },
      paint: { "raster-opacity": 0.9, "raster-saturation": -0.15, "raster-brightness-max": 0.8 } }, antesDe);
    capasBase().forEach(function (c) { mapa.addLayer(c, antesDe); });
  }
  // Selector de mapa base al estilo de Google Maps: mapa temático o satélite
  var CAPAS_TEMATICAS = ["eco-bosque", "eco-verde", "eco-parque", "eco-verde-uso", "eco-humedal", "eco-agua", "vias-menores", "vias-principales"];
  function fijarBase(tipo) {
    var sat = tipo === "satelite";
    mapa.setLayoutProperty("satelite", "visibility", sat ? "visible" : "none");
    CAPAS_TEMATICAS.forEach(function (c) { if (mapa.getLayer(c)) mapa.setLayoutProperty(c, "visibility", sat ? "none" : "visible"); });
    mapa.setPaintProperty("manzanas", "fill-extrusion-opacity", sat ? 0.7 : (lenteActual().campo ? 0.88 : 0.22));
    document.querySelectorAll("[data-base]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.base === tipo ? "true" : "false"); });
    estado.base = tipo;
  }
  // Filtro rápido de equipamientos por categoría (fila de chips, como las categorías de Google Maps)
  function fijarCategoria(cat) {
    estado.categoria = estado.categoria === cat ? null : cat;
    mapa.setFilter("equipamientos", estado.categoria ? ["==", ["get", "categoria"], estado.categoria] : null);
    mapa.setPaintProperty("equipamientos", "circle-radius", estado.categoria
      ? ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 9] : ["interpolate", ["linear"], ["zoom"], 12, 2.5, 16, 6]);
    if (estado.categoria) mapa.setLayerZoomRange("equipamientos", 0, 24); else mapa.setLayerZoomRange("equipamientos", 11.5, 24);
    document.querySelectorAll("[data-categoria]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.categoria === estado.categoria ? "true" : "false"); });
  }
  function capasBase() {
    var verde = ["park", "grass", "garden", "recreation_ground", "meadow", "pitch", "cemetery"];
    return [
        { id: "eco-bosque", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]],
          paint: { "fill-color": ECO.bosque.color, "fill-opacity": 0.55, "fill-opacity-transition": { duration: 600 } } },
        { id: "eco-verde", type: "fill", source: "omt", "source-layer": "landcover", filter: ["in", ["get", "class"], ["literal", ["grass", "farmland"]]],
          paint: { "fill-color": ECO.verde.color, "fill-opacity": 0.35, "fill-opacity-transition": { duration: 600 } } },
        { id: "eco-parque", type: "fill", source: "omt", "source-layer": "park",
          paint: { "fill-color": ECO.verde.color, "fill-opacity": 0.6, "fill-outline-color": ECO.verde.borde } },
        { id: "eco-verde-uso", type: "fill", source: "omt", "source-layer": "landuse", filter: ["in", ["get", "class"], ["literal", verde]],
          paint: { "fill-color": ECO.verde.color, "fill-opacity": 0.5 } },
        { id: "eco-humedal", type: "fill", source: "omt", "source-layer": "landcover", filter: ["==", ["get", "class"], "wetland"],
          paint: { "fill-color": ECO.humedal.color, "fill-opacity": 0.7, "fill-opacity-transition": { duration: 600 } } },
        { id: "eco-humedal-borde", type: "line", source: "omt", "source-layer": "landcover", filter: ["==", ["get", "class"], "wetland"],
          paint: { "line-color": ECO.humedal.borde, "line-width": 1, "line-opacity": 0.6, "line-dasharray": [3, 2] } },
        { id: "eco-agua", type: "fill", source: "omt", "source-layer": "water",
          paint: { "fill-color": ECO.agua.color, "fill-opacity": 0.95 } },
        { id: "eco-agua-borde", type: "line", source: "omt", "source-layer": "water",
          paint: { "line-color": ECO.agua.borde, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 16, 2], "line-opacity": 0.8, "line-blur": 0.5 } },
        { id: "eco-cauces", type: "line", source: "omt", "source-layer": "waterway", filter: ["!=", ["get", "class"], "river"],
          paint: { "line-color": "#38BDF8", "line-width": ["interpolate", ["linear"], ["zoom"], 12, 0.6, 16, 2.5], "line-opacity": 0.7 } },
        { id: "vias-menores", type: "line", source: "omt", "source-layer": "transportation", minzoom: 13,
          filter: ["in", ["get", "class"], ["literal", ["minor", "service", "tertiary"]]],
          paint: { "line-color": "#1A2C55", "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 17, 3] } },
        { id: "vias-principales", type: "line", source: "omt", "source-layer": "transportation",
          filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
          paint: { "line-color": "#2A4A8A", "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 4], "line-opacity": 0.85 } },
        { id: "nombres-agua", type: "symbol", source: "omt", "source-layer": "water_name",
          layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 12, "symbol-placement": "line" },
          paint: { "text-color": "#7DD3FC", "text-halo-color": "#000B22", "text-halo-width": 1.5 } },
        { id: "nombres-cauces", type: "symbol", source: "omt", "source-layer": "waterway", minzoom: 12,
          layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 12, "symbol-placement": "line", "text-letter-spacing": 0.08 },
          paint: { "text-color": "#7DD3FC", "text-halo-color": "#000B22", "text-halo-width": 1.5 } }
    ];
  }

  function crearMapa() {
    var b = new maplibregl.LngLatBounds();
    datos.manzanas.features.forEach(function (f) { f.geometry.coordinates[0].forEach(function (p) { b.extend(p); }); });
    estado.limites = b;
    mapa = new maplibregl.Map({
      container: "mapa",
      style: estiloBase(),
      bounds: b, fitBoundsOptions: { padding: paddingMapa() },
      maxBounds: [[b.getWest() - 0.35, b.getSouth() - 0.3], [b.getEast() + 0.35, b.getNorth() + 0.3]],
      pitch: 55, bearing: -18, maxPitch: 75, attributionControl: false, antialias: true
    });
    mapa.on("error", function (e) { if (console && console.warn) console.warn("Mapa:", e && e.error && e.error.message); });
    mapa.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    mapa.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, showAccuracyCircle: false }), "bottom-right");
    mapa.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
    mapa.on("load", function () {
      mapa.setZoom(mapa.getZoom() + (window.innerWidth > 760 ? 0.45 : 0.3));
      // En pantallas pequeñas las etiquetas de comuna solo aparecen al acercarse
      var etiquetas = function () { document.body.classList.toggle("lejos", window.innerWidth <= 760 && mapa.getZoom() < 12.6); };
      mapa.on("zoom", etiquetas); etiquetas();
      montarCapas();
    });
  }
  function paddingMapa() {
    if (window.innerWidth <= 760) return { top: 200, bottom: window.innerHeight * 0.46 + 10, left: 20, right: 20 };
    return { top: 190, bottom: 80, left: 110, right: 400 };
  }

  function montarCapas() {
    mapa.addSource("perimetro", { type: "geojson", data: datos.contexto.perimetro });
    mapa.addSource("comunas", { type: "geojson", data: datos.contexto.comunas, promoteId: "comuna_id" });
    mapa.addSource("rio", { type: "geojson", data: datos.contexto.rio });
    mapa.addSource("manzanas", { type: "geojson", data: datos.manzanas, promoteId: "cod_dane" });
    mapa.addSource("equipamientos", { type: "geojson", data: datos.equipamientos });
    mapa.addSource("obras", { type: "geojson", data: datos.obras });

    mapa.addLayer({ id: "perimetro-brillo", type: "line", source: "perimetro", paint: { "line-color": COLORES.cian, "line-width": 8, "line-blur": 8, "line-opacity": 0.35 } });
    mapa.addLayer({ id: "perimetro", type: "line", source: "perimetro", paint: { "line-color": COLORES.cian, "line-width": 1.2, "line-opacity": 0.8 } });
    mapa.addLayer({ id: "rio-brillo", type: "line", source: "rio", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#38BDF8", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 14, 16, 60], "line-blur": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 40], "line-opacity": 0.35 } });
    mapa.addLayer({ id: "rio", type: "line", source: "rio", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#7DD3FC", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2.5, 16, 5], "line-opacity": 0.9 } });
    mapa.addLayer({ id: "rio-flujo", type: "line", source: "rio", layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#E0F7FF", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 16, 2.5], "line-opacity": 0.85, "line-dasharray": [0, 4, 3] } });
    mapa.addLayer({ id: "comunas-relleno", type: "fill", source: "comunas",
      paint: { "fill-color": COLORES.ambar, "fill-opacity": ["case", ["boolean", ["feature-state", "sel"], false], 0.12, ["boolean", ["feature-state", "hover"], false], 0.05, 0] } });
    mapa.addLayer({ id: "comunas", type: "line", source: "comunas",
      paint: { "line-color": ["case", ["boolean", ["feature-state", "sel"], false], COLORES.ambar, COLORES.blanco],
        "line-width": ["case", ["boolean", ["feature-state", "sel"], false], 2.5, 1.2], "line-opacity": 0.7 } });
    mapa.addLayer({
      id: "manzanas", type: "fill-extrusion", source: "manzanas",
      paint: {
        "fill-extrusion-color": expresionColor(), "fill-extrusion-height": expresionAltura(),
        "fill-extrusion-opacity": 0.88, "fill-extrusion-vertical-gradient": true,
        "fill-extrusion-color-transition": { duration: 700 }, "fill-extrusion-height-transition": { duration: 900 }
      }
    });
    mapa.addLayer({ id: "equipamientos", type: "circle", source: "equipamientos", minzoom: 11.5, paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 16, 6],
      "circle-color": ["match", ["get", "categoria"]].concat(Object.keys(COLOR_CATEGORIA).reduce(function (a, k) { return a.concat([k, COLOR_CATEGORIA[k]]); }, []), ["#93A6C4"]),
      "circle-stroke-color": "#000B22", "circle-stroke-width": 1, "circle-opacity": 0.9
    } });
    mapa.addLayer({ id: "obras-halo", type: "circle", source: "obras", paint: { "circle-radius": 14, "circle-color": COLORES.ambar, "circle-opacity": 0.25, "circle-blur": 0.6 } });
    mapa.addLayer({ id: "obras", type: "circle", source: "obras", paint: { "circle-radius": 6, "circle-color": COLORES.ambar, "circle-stroke-color": COLORES.navy, "circle-stroke-width": 2 } });

    var hover = null;
    mapa.on("mousemove", "manzanas", function (e) {
      var id = e.features[0].id;
      if (hover !== null && hover !== id) mapa.setFeatureState({ source: "manzanas", id: hover }, { hover: false });
      hover = id; mapa.setFeatureState({ source: "manzanas", id: id }, { hover: true });
      mapa.getCanvas().style.cursor = "pointer";
    });
    mapa.on("mouseleave", "manzanas", function () {
      if (hover !== null) mapa.setFeatureState({ source: "manzanas", id: hover }, { hover: false });
      hover = null; mapa.getCanvas().style.cursor = "";
    });
    mapa.on("click", function (e) { if (clicSimulador(e)) e.preventDefault(); });
    mapa.on("click", "manzanas", function (e) {
      if (estado.simulando) return;
      if (mapa.queryRenderedFeatures(e.point, { layers: ["obras", "equipamientos"] }).length) return;
      seleccionarManzana(e.features[0].properties);
    });
    ["obras", "equipamientos"].forEach(function (capa) {
      mapa.on("mouseenter", capa, function () { mapa.getCanvas().style.cursor = "pointer"; });
      mapa.on("mouseleave", capa, function () { mapa.getCanvas().style.cursor = ""; });
    });
    mapa.on("click", "obras", function (e) { mostrarObra(e.features[0]); });
    mapa.on("click", "equipamientos", function (e) {
      var p = e.features[0].properties;
      popup(e.features[0].geometry.coordinates, "<b>" + escapar(p.nombre || "Sin nombre") + "</b><br><span style='color:#93A6C4'>" + escapar(CATEGORIAS[p.categoria] || p.categoria) + " · OSM</span>");
    });

    montarBase("perimetro-brillo");
    etiquetasComunas();
    enlazarInteraccionMapa();
    animarObras();
    animarRio();
    iniciarAsistente();
    leerVistaURL();
    mapa.on("moveend", guardarVistaURL);
    iniciarTutorial();
    $("#carga").classList.add("listo");
  }

  var popupActivo;
  function popup(coords, html) {
    if (popupActivo) popupActivo.remove();
    popupActivo = new maplibregl.Popup({ offset: 12, maxWidth: "280px" }).setLngLat(coords).setHTML(html).addTo(mapa);
  }
  function escapar(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function animarObras() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var t0 = performance.now(), ultimo = 0;
    function paso(t) {
      if (t - ultimo > 50) {
        var f = ((t - t0) % 2000) / 2000;
        mapa.setPaintProperty("obras-halo", "circle-radius", 8 + f * 22);
        mapa.setPaintProperty("obras-halo", "circle-opacity", 0.45 * (1 - f));
        ultimo = t;
      }
      requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }

  // Flujo del río: se recorre una secuencia de patrones de guiones para simular corriente
  function animarRio() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var pasos = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
      [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
    var i = 0;
    setInterval(function () { i = (i + 1) % pasos.length; mapa.setPaintProperty("rio-flujo", "line-dasharray", pasos[i]); }, 90);
  }

  function centroComuna(f) {
    var pols = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    var mayor = pols.reduce(function (a, p) { return p[0].length > a[0].length ? p : a; });
    var x = 0, y = 0;
    mayor[0].forEach(function (q) { x += q[0]; y += q[1]; });
    return [x / mayor[0].length, y / mayor[0].length];
  }
  function etiquetasComunas() {
    datos.contexto.comunas.features.forEach(function (f) {
      var id = f.properties.comuna_id;
      var n = el("button", { class: "etiqueta-comuna", type: "button", "aria-label": "Ver " + f.properties.nombre, texto: (f.properties.nombre || "").replace("Comuna ", "C") });
      n.addEventListener("click", function (e) { e.stopPropagation(); mostrarPestana("territorio"); pintarComuna(id); });
      n.dataset.comuna = id;
      new maplibregl.Marker({ element: n }).setLngLat(centroComuna(f)).addTo(mapa);
      n.setAttribute("aria-label", "Ver " + f.properties.nombre);
    });
  }
  var comunaSel = null;
  function marcarComuna(id) {
    if (comunaSel !== null) mapa.setFeatureState({ source: "comunas", id: comunaSel }, { sel: false });
    comunaSel = id;
    if (id !== null) mapa.setFeatureState({ source: "comunas", id: id }, { sel: true });
    document.querySelectorAll(".etiqueta-comuna").forEach(function (b) { b.classList.toggle("activa", b.dataset.comuna === id); });
  }
  function nombreComuna(id) {
    var c = datos.resumen.resumen.comunas.filter(function (x) { return x.comuna_id === id; })[0];
    return c ? c.nombre : "Fuera de las comunas OSM";
  }

  function enlazarInteraccionMapa() {
    var tip = $("#tooltip"), escritorio = window.matchMedia("(hover: hover)").matches;
    mapa.on("mousemove", function (e) {
      if (!escritorio) return;
      var f = mapa.queryRenderedFeatures(e.point, { layers: ["obras", "equipamientos", "manzanas"].concat(CAPAS_ECO) })[0];
      if (!f) { tip.hidden = true; return; }
      var html;
      if (f.layer.id === "manzanas") {
        var l = lenteActual(), p = f.properties;
        html = "<b>" + escapar(p.barrio ? "Cerca de " + p.barrio : "Manzana") + "</b><span>" + escapar(nombreComuna(p.comuna_id)) + "</span>" +
          (l.campo ? "<em>" + escapar(l.titulo) + ": " + (p[l.campo] == null ? "s. d." : num(p[l.campo], l.unidad === "%" ? 1 : 0) + (l.unidad ? " " + l.unidad : "")) + "</em>" : "<em>" + num(p.personas) + " personas</em>");
      } else if (f.layer.id === "obras") {
        html = "<b>" + escapar(f.properties.nombre) + "</b><span>Obra comunicada · clic para ver</span>";
      } else if (f.layer.id === "equipamientos") {
        html = "<b>" + escapar(f.properties.nombre || "Sin nombre") + "</b><span>" + escapar(CATEGORIAS[f.properties.categoria] || "") + "</span>";
      } else {
        var eco = ECO[f.layer.id.replace("eco-", "")];
        html = "<b>" + escapar(f.properties.name || eco.nombre) + "</b><span>" + escapar(eco.nombre) + " · OSM</span>";
      }
      tip.innerHTML = html; tip.hidden = false;
      tip.style.transform = "translate(" + (e.point.x + 16) + "px," + (e.point.y + 16) + "px)";
    });
    mapa.getCanvas().addEventListener("mouseleave", function () { tip.hidden = true; });
    mapa.on("movestart", function () { tip.hidden = true; });

    mapa.on("mousemove", "comunas-relleno", function (e) {
      var id = e.features[0].id;
      if (estado.comunaHover !== undefined && estado.comunaHover !== id) mapa.setFeatureState({ source: "comunas", id: estado.comunaHover }, { hover: false });
      estado.comunaHover = id; mapa.setFeatureState({ source: "comunas", id: id }, { hover: true });
    });
    mapa.on("mouseleave", "comunas-relleno", function () {
      if (estado.comunaHover !== undefined) mapa.setFeatureState({ source: "comunas", id: estado.comunaHover }, { hover: false });
      estado.comunaHover = undefined;
    });

    mapa.on("click", function (e) {
      if (estado.simulando) return;
      if (mapa.queryRenderedFeatures(e.point, { layers: ["obras", "equipamientos", "manzanas"] }).length) return;
      var f = mapa.queryRenderedFeatures(e.point, { layers: CAPAS_ECO })[0];
      if (!f) return;
      var eco = ECO[f.layer.id.replace("eco-", "")];
      popup(e.lngLat, "<b>" + escapar(f.properties.name || eco.nombre) + "</b><br><span style='color:" + eco.borde + "'>" + escapar(eco.nombre) + "</span><br><span style='color:#93A6C4'>Cobertura OpenStreetMap · no es un límite oficial</span>");
    });

    document.querySelectorAll("[data-base]").forEach(function (b) { b.addEventListener("click", function () { fijarBase(b.dataset.base); }); });
    document.querySelectorAll("[data-categoria]").forEach(function (b) { b.addEventListener("click", function () { fijarCategoria(b.dataset.categoria); }); });
    $("#abrir-simulador").addEventListener("click", abrirSimulador);
    $("#compartir").addEventListener("click", compartir);
    $("#vista-inicial").addEventListener("click", function () {
      detenerOrbita();
      mapa.fitBounds(estado.limites, { padding: paddingMapa(), pitch: estado.tres_d ? 55 : 0, bearing: estado.tres_d ? -18 : 0, duration: 1600 });
      marcarComuna(null); pintarCiudad();
    });
    $("#orbitar").addEventListener("click", function () {
      if (estado.orbita) { detenerOrbita(); return; }
      this.setAttribute("aria-pressed", "true");
      if (!estado.tres_d) $("#modo-3d").click();
      var girar = function () {
        if (!estado.orbita) return;
        mapa.easeTo({ bearing: mapa.getBearing() + 8, duration: 1000, easing: function (t) { return t; } });
      };
      estado.orbita = true; girar();
      mapa.on("moveend", girar);
      estado.girar = girar;
      ["mousedown", "touchstart", "wheel"].forEach(function (ev) { mapa.getCanvas().addEventListener(ev, detenerOrbita, { once: true }); });
    });
  }
  function detenerOrbita() {
    if (!estado.orbita) return;
    estado.orbita = false;
    mapa.off("moveend", estado.girar);
    $("#orbitar").setAttribute("aria-pressed", "false");
  }

  function aplicarLente() {
    var l = lenteActual(), c = estado.cortes[l.id];
    if (mapa && mapa.getLayer("manzanas")) {
      mapa.setPaintProperty("manzanas", "fill-extrusion-color", expresionColor());
      mapa.setPaintProperty("manzanas", "fill-extrusion-height", expresionAltura());
      mapa.setPaintProperty("manzanas", "fill-extrusion-opacity", estado.base === "satelite" ? 0.7 : (l.campo ? 0.88 : 0.22));
      mapa.setPaintProperty("eco-bosque", "fill-opacity", l.campo ? 0.55 : 0.85);
      mapa.setPaintProperty("eco-verde", "fill-opacity", l.campo ? 0.35 : 0.7);
      mapa.setPaintProperty("eco-humedal", "fill-opacity", l.campo ? 0.7 : 0.95);
    }
    $("#leyenda-titulo").textContent = l.titulo;
    $("#leyenda-eco").hidden = !!l.campo;
    $(".rampa-etiquetas").hidden = !l.campo;
    $("#leyenda-rampa").hidden = !l.campo;
    $("#leyenda-nota").textContent = l.nota;
    document.querySelectorAll(".lente").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lente === l.id ? "true" : "false"); });
    if (!l.campo) return;
    $("#leyenda-rampa").style.background = "linear-gradient(90deg," + RAMPA.join(",") + ")";
    $("#leyenda-min").textContent = num(c[0], l.unidad === "%" ? 0 : 0) + (l.unidad ? " " + l.unidad : "");
    $("#leyenda-max").textContent = "≥ " + num(c[4]) + (l.unidad ? " " + l.unidad : "");
    $("#leyenda-nota").textContent = l.nota + (estado.tres_d ? " · Altura = valor" : "");
    document.querySelectorAll(".lente").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lente === l.id ? "true" : "false"); });
  }

  // ---------- Interfaz fija ----------
  function pintarKpis() {
    var m = datos.resumen.resumen.municipio, s = datos.resumen.secop;
    var kpis = [
      { r: "Población urbana", v: m.personas, f: "Censo DANE 2018" },
      { r: "Manzanas", v: m.manzanas, f: "DANE MGN 2018" },
      { r: "Equipamientos", v: datos.equipamientos.features.length, f: "OpenStreetMap", c: COLORES.cian },
      { r: "Sin alcantarillado", v: m.pct_sin_alcantarillado, f: "% de viviendas · DANE", c: COLORES.ambar, d: 1, s: "%" },
      { r: "Obras comunicadas", v: datos.obras.features.length, f: "Instagram Alcaldía", c: COLORES.ambar },
      { r: "Proyectos SECOP", v: s.proyectos, f: "Candidatos de obra", c: COLORES.cian }
    ];
    var cont = $("#kpis");
    kpis.forEach(function (k) {
      var v = el("div", { class: "valor" });
      if (k.c) v.style.color = k.c;
      cont.appendChild(el("div", { class: "kpi vidrio" }, [el("div", { class: "rotulo", texto: k.r }), v, el("div", { class: "fuente", texto: k.f })]));
      contar(v, k.v, k.d || 0, k.s);
    });
  }
  function pintarLentes() {
    var cont = $("#lentes");
    LENTES.forEach(function (l) {
      cont.appendChild(el("button", {
        class: "lente", type: "button", "data-lente": l.id, "aria-pressed": "false",
        html: icono(ICONOS[l.id]) + "<span>" + l.nombre + "</span>",
        onclick: function () {
          estado.lente = l.id; aplicarLente();
          if (l.id === "necesidad") { limpiarSimulacion(); pintarNecesidad(); }
          else if (estado.seleccion && lenteActual().campo) pintarManzana(estado.seleccion);
        }
      }));
    });
  }
  function enlazarControles() {
    $("#modo-3d").addEventListener("click", function () {
      estado.tres_d = !estado.tres_d;
      this.setAttribute("aria-pressed", estado.tres_d ? "true" : "false");
      mapa.easeTo({ pitch: estado.tres_d ? 55 : 0, bearing: estado.tres_d ? -18 : 0, duration: 1000 });
      aplicarLente();
    });
    document.querySelectorAll("[data-capa]").forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on ? "true" : "false");
        var capas = { equipamientos: ["equipamientos"], obras: ["obras", "obras-halo"], comunas: ["comunas"] }[b.dataset.capa];
        capas.forEach(function (c) { mapa.setLayoutProperty(c, "visibility", on ? "visible" : "none"); });
      });
    });
    document.querySelectorAll(".pestana").forEach(function (t) {
      t.addEventListener("click", function () { mostrarPestana(t.id.replace("tab-", "")); });
    });
    $("#abrir-fuentes").addEventListener("click", function () { $("#fuentes").hidden = false; $("#fuentes [data-cerrar]").focus(); });
    $("#fuentes").addEventListener("click", function (e) { if (e.target.id === "fuentes" || e.target.hasAttribute("data-cerrar")) $("#fuentes").hidden = true; });

    var panel = $("#panel"), asa = $(".asa"), y0 = null;
    asa.addEventListener("click", function () {
      if (panel.classList.contains("colapsado")) panel.classList.remove("colapsado");
      else if (panel.classList.contains("expandido")) { panel.classList.remove("expandido"); panel.classList.add("colapsado"); }
      else panel.classList.add("expandido");
    });
    asa.addEventListener("pointerdown", function (e) { y0 = e.clientY; });
    window.addEventListener("pointerup", function (e) {
      if (y0 === null) return;
      var dy = e.clientY - y0; y0 = null;
      if (Math.abs(dy) < 30) return;
      panel.classList.remove("colapsado", "expandido");
      if (dy < -120) panel.classList.add("expandido");
      else if (dy > 120) panel.classList.add("colapsado");
      else if (dy > 0 && !panel.classList.contains("expandido")) panel.classList.add("colapsado");
    });
  }
  function mostrarPestana(nombre) {
    document.querySelectorAll(".pestana").forEach(function (t) { t.setAttribute("aria-selected", t.id === "tab-" + nombre ? "true" : "false"); });
    document.querySelectorAll(".contenido").forEach(function (c) { c.hidden = c.id !== "vista-" + nombre; });
    if (nombre === "secop") asegurarSecop();
    $("#panel").classList.remove("colapsado");
  }
  function pintarFuentes() {
    var m = datos.resumen.manifest, ul = $("#lista-fuentes");
    Object.keys(m).forEach(function (k) {
      var f = m[k];
      ul.appendChild(el("li", {}, [
        el("b", { texto: f.nombre || k }), el("br"),
        el("span", { class: "fuente", texto: (f.licencia || "") + " · registrado " + (f.registrado_en || "").slice(0, 10) + " · " }),
        f.url ? el("a", { href: f.url, target: "_blank", rel: "noopener noreferrer", texto: "origen" }) : null
      ]));
    });
    $("#corte").textContent = "Corte · " + new Date((datos.resumen.secop.corte || "2026-09-22") + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  }

  // ---------- Territorio ----------
  function aviso(texto) { return el("div", { class: "aviso", html: INFO + "<span>" + escapar(texto) + "</span>" }); }
  function cifra(etq, val) { return el("div", { class: "cifra" }, [el("span", { texto: etq }), el("b", { texto: val })]); }
  function anillo(pct, etq, color) {
    var p = Math.max(0, Math.min(100, pct || 0));
    var a = el("div", { class: "anillo" }, [el("div", { texto: pct == null ? "s. d." : num(p, 0) + "%" })]);
    a.style.background = "conic-gradient(" + color + " " + p + "%, rgba(147,190,255,0.14) 0)";
    return el("div", { class: "anillo-fila" }, [a, el("span", { texto: etq })]);
  }
  function barraDist(etq, valor, mediana, max) {
    var w = Math.min(100, (valor || 0) / max * 100), m = Math.min(100, mediana / max * 100);
    var color = valor == null ? "#93A6C4" : valor > 1000 ? COLORES.rosa : valor > mediana ? COLORES.ambar : COLORES.cian;
    var rel = el("div", { class: "relleno" }); rel.style.background = color; rel.style.width = "0%";
    var marca = el("div", { class: "marca-media", title: "Mediana de la ciudad" }); marca.style.left = m + "%";
    requestAnimationFrame(function () { requestAnimationFrame(function () { rel.style.width = w + "%"; }); });
    var v = el("span", { class: "mono", texto: valor == null ? "s. d." : num(valor) + " m" }); v.style.color = color;
    return el("div", { class: "barra-dist" }, [el("div", { class: "cab" }, [el("span", { texto: etq }), v]), el("div", { class: "pista" }, [rel, marca])]);
  }

  function pintarCiudad() {
    limpiarSeleccion();
    estado.comunaVista = null;
    if (mapa && mapa.getSource("comunas")) marcarComuna(null);
    var m = datos.resumen.resumen.municipio, v = $("#vista-territorio");
    v.innerHTML = "";
    var cont = el("div", { class: "aparecer" }, [
      el("div", { class: "rotulo", texto: "Cabecera municipal" }),
      el("h3", { texto: "Montería" }),
      el("div", { class: "subtitulo", texto: "Córdoba · " + num(m.manzanas) + " manzanas · 9 comunas OSM" }),
      herramientas([
        ["Simular equipamiento", abrirSimulador, true],
        ["Ficha PDF", function () { imprimirFicha("Montería · cabecera municipal"); }],
        ["CSV comunas", descargarComunas]
      ]),
      el("div", { class: "cifras" }, [cifra("Personas", num(m.personas)), cifra("Hogares", num(m.hogares)), cifra("Viviendas", num(m.viviendas))]),
      el("h4", { class: "rotulo", texto: "Cobertura de servicios" }),
      el("div", { class: "anillos" }, [
        anillo(100 - m.pct_sin_acueducto, "Con acueducto", COLORES.cian), anillo(100 - m.pct_sin_alcantarillado, "Con alcantarillado", COLORES.ambar),
        anillo(100 - m.pct_sin_recoleccion, "Con recolección", "#5EE6A8"), anillo(100 - m.pct_sin_internet, "Con internet", COLORES.rosa)
      ]),
      el("h4", { class: "rotulo", texto: "Personas a más de " + num(datos.resumen.resumen.umbral_distancia_m) + " m" }),
      barraPct("De salud", m.pct_personas_lejos_salud), barraPct("De educación", m.pct_personas_lejos_educacion), barraPct("De seguridad", m.pct_personas_lejos_seguridad),
      el("h4", { class: "rotulo", texto: "Comunas" })
    ]);
    datos.resumen.resumen.comunas.slice().sort(function (a, b) { return Number(a.comuna_id) - Number(b.comuna_id); }).forEach(function (c) {
      cont.appendChild(el("button", { class: "tarjeta", type: "button", onclick: function () { pintarComuna(c.comuna_id); } }, [
        el("div", { class: "titulo", texto: c.nombre }),
        el("div", { class: "meta", texto: num(c.personas) + " personas · " + num(c.pct_sin_alcantarillado, 1) + "% sin alcantarillado · " + num(c.pct_personas_lejos_salud, 0) + "% lejos de salud" })
      ]));
    });
    cont.appendChild(el("p", { class: "fuente", texto: "Seleccione una manzana en el mapa para ver su ficha. Censo DANE 2018; comunas de OpenStreetMap (no oficiales)." }));
    v.appendChild(cont);
  }
  function barraPct(etq, pct) {
    var rel = el("div", { class: "relleno" }); rel.style.width = "0%";
    rel.style.background = pct > 50 ? COLORES.rosa : pct > 20 ? COLORES.ambar : COLORES.cian;
    requestAnimationFrame(function () { requestAnimationFrame(function () { rel.style.width = Math.min(100, pct || 0) + "%"; }); });
    return el("div", { class: "barra-dist" }, [el("div", { class: "cab" }, [el("span", { texto: etq }), el("span", { class: "mono", texto: num(pct, 1) + "%" })]), el("div", { class: "pista" }, [rel])]);
  }
  function volver() { return el("button", { class: "chip", type: "button", "aria-pressed": "false", onclick: pintarCiudad, texto: "← Ciudad" }); }

  function pintarComuna(id) {
    limpiarSeleccion();
    marcarComuna(id);
    estado.comunaVista = id;
    var c = datos.resumen.resumen.comunas.filter(function (x) { return x.comuna_id === id; })[0];
    var f = datos.contexto.comunas.features.filter(function (x) { return x.properties.comuna_id === id; })[0];
    if (f) {
      var b = new maplibregl.LngLatBounds();
      var pols = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      pols.forEach(function (p) { p[0].forEach(function (q) { b.extend(q); }); });
      mapa.fitBounds(b, { padding: paddingMapa(), pitch: estado.tres_d ? 58 : 0, bearing: estado.tres_d ? -18 : 0, duration: 1600 });
    }
    var v = $("#vista-territorio"); v.innerHTML = "";
    var eq = c.equipamientos || {};
    v.appendChild(el("div", { class: "aparecer" }, [
      volver(),
      el("div", { class: "rotulo", texto: "Comuna · OpenStreetMap", style: "margin-top:12px" }),
      el("h3", { texto: c.nombre }),
      el("div", { class: "subtitulo", texto: num(c.manzanas) + " manzanas" }),
      herramientas([
        ["Ficha PDF", function () { imprimirFicha(c.nombre + " · Montería"); }],
        ["CSV equipamientos", function () { descargarEquipamientos(c); }],
        ["Compartir", compartir]
      ]),
      el("div", { class: "cifras" }, [cifra("Personas", num(c.personas)), cifra("Hogares", num(c.hogares)), cifra("Viviendas", num(c.viviendas))]),
      el("h4", { class: "rotulo", texto: "Cobertura de servicios" }),
      el("div", { class: "anillos" }, [
        anillo(100 - c.pct_sin_acueducto, "Con acueducto", COLORES.cian), anillo(100 - c.pct_sin_alcantarillado, "Con alcantarillado", COLORES.ambar),
        anillo(100 - c.pct_sin_recoleccion, "Con recolección", "#5EE6A8"), anillo(100 - c.pct_sin_internet, "Con internet", COLORES.rosa)
      ]),
      el("h4", { class: "rotulo", texto: "Personas a más de " + num(datos.resumen.resumen.umbral_distancia_m) + " m" }),
      barraPct("De salud", c.pct_personas_lejos_salud), barraPct("De educación", c.pct_personas_lejos_educacion), barraPct("De seguridad", c.pct_personas_lejos_seguridad),
      el("h4", { class: "rotulo", texto: "Equipamientos (OSM)" }),
      el("div", { class: "cifras" }, Object.keys(CATEGORIAS).map(function (k) { return cifra(CATEGORIAS[k], num(eq[k] || 0)); }))
    ]));
  }

  function limpiarSeleccion() {
    if (estado.seleccion && mapa) mapa.setFeatureState({ source: "manzanas", id: estado.seleccion.cod_dane }, { sel: false });
    estado.seleccion = null;
  }
  function seleccionarManzana(p) {
    limpiarSeleccion();
    estado.seleccion = p;
    mapa.setFeatureState({ source: "manzanas", id: p.cod_dane }, { sel: true });
    mostrarPestana("territorio");
    pintarManzana(p);
  }
  function pintarManzana(p) {
    var comuna = datos.resumen.resumen.comunas.filter(function (x) { return x.comuna_id === p.comuna_id; })[0];
    var med = estado.medianas, max = Math.max(1500, p.dist_salud_m || 0, p.dist_educacion_m || 0, p.dist_seguridad_m || 0);
    var l = lenteActual().campo ? lenteActual() : LENTES[1], val = p[l.campo];
    var v = $("#vista-territorio"); v.innerHTML = "";
    v.appendChild(el("div", { class: "aparecer" }, [
      volver(),
      el("div", { class: "rotulo", texto: "Manzana seleccionada", style: "margin-top:12px;color:#FFB900" }),
      el("h3", { texto: p.barrio ? "Cerca de " + p.barrio : "Manzana" }),
      el("div", { class: "subtitulo", texto: (comuna ? comuna.nombre : "Sin comuna") + " · DANE " + p.cod_dane }),
      el("div", { class: "cifras" }, [cifra("Personas", num(p.personas)), cifra("Hogares", num(p.hogares)), cifra("Estrato", p.estrato_modal ? num(p.estrato_modal) : "s. d.")]),
      el("div", { class: "tarjeta" }, [
        el("div", { class: "rotulo", texto: l.titulo }),
        el("div", { class: "mono", style: "font-size:22px;font-weight:600;margin-top:4px", texto: (val == null ? "s. d." : num(val, l.unidad === "%" ? 1 : 0)) + (l.unidad ? " " + l.unidad : "") }),
        el("div", { class: "meta", texto: "Mediana de la ciudad: " + num(med[l.id], l.unidad === "%" ? 1 : 0) + (l.unidad ? " " + l.unidad : "") })
      ]),
      el("h4", { class: "rotulo", texto: "Cobertura de servicios" }),
      el("div", { class: "anillos" }, [
        anillo(p.pct_sin_acueducto == null ? null : 100 - p.pct_sin_acueducto, "Con acueducto", COLORES.cian),
        anillo(p.pct_sin_alcantarillado == null ? null : 100 - p.pct_sin_alcantarillado, "Con alcantarillado", COLORES.ambar),
        anillo(p.pct_sin_recoleccion == null ? null : 100 - p.pct_sin_recoleccion, "Con recolección", "#5EE6A8"),
        anillo(p.pct_sin_internet == null ? null : 100 - p.pct_sin_internet, "Con internet", COLORES.rosa)
      ]),
      el("h4", { class: "rotulo", texto: "Distancia en línea recta · marca = mediana" }),
      barraDist("Salud", p.dist_salud_m, med.salud, max), barraDist("Educación", p.dist_educacion_m, med.educacion, max), barraDist("Seguridad", p.dist_seguridad_m, med.seguridad, max),
      aviso("El barrio es el punto de barrio OSM más cercano dentro de la comuna; es una referencia aproximada, no un límite oficial.")
    ]));
  }

  // ---------- Obras y PDM ----------
  var TIPOS_OBRA = { sede_educativa: "Sede educativa", via: "Vía", parque: "Parque", mitigacion: "Mitigación" };
  function mostrarObra(f) {
    var p = f.properties, posts = typeof p.posts === "string" ? JSON.parse(p.posts) : p.posts;
    var pdm = typeof p.pdm === "string" ? JSON.parse(p.pdm) : p.pdm;
    var c = f.geometry.coordinates;
    mapa.flyTo({ center: c, zoom: Math.max(mapa.getZoom(), 15), pitch: estado.tres_d ? 60 : 0, duration: 1400 });
    popup(c, "<b>" + escapar(p.nombre) + "</b><br><span style='color:#FFB900'>" + escapar(TIPOS_OBRA[p.tipo] || p.tipo) + "</span> · " + escapar(p.estado) +
      (pdm && pdm[0] ? "<br>PDM: " + escapar(pdm[0].indicador) + " (meta " + escapar(pdm[0].meta) + ")" : "") +
      (posts && posts[0] ? "<br><a href='" + escapar(posts[0]) + "' target='_blank' rel='noopener noreferrer'>Ver publicación</a>" : ""));
  }
  function pintarObras() {
    var v = $("#vista-obras"), cob = datos.resumen.instagram.cobertura, obras = datos.obras.features;
    var metas = {};
    obras.forEach(function (f) {
      (f.properties.pdm || []).forEach(function (m) {
        var k = m.indicador;
        metas[k] = metas[k] || { indicador: k, meta: m.meta, unidad: m.unidad, obras: 0 };
        metas[k].obras++;
      });
    });
    var cont = el("div", { class: "aparecer" }, [
      el("div", { class: "rotulo", texto: "Comunicación oficial · Instagram Alcaldía" }),
      el("h3", { texto: "Obras y metas del PDM" }),
      el("div", { class: "subtitulo", texto: cob.coverage_window.start + " → " + cob.coverage_window.end + (cob.coverage_window.partial ? " · cobertura parcial" : "") }),
      el("div", { class: "cifras" }, [cifra("Publicaciones", num(cob.posts.total)), cifra("Obras ubicadas", num(obras.length)), cifra("Entregas anunciadas", num(cob.communication_claims.delivery_claimed))]),
      el("h4", { class: "rotulo", texto: "Metas del PDM vinculadas" })
    ]);
    Object.keys(metas).forEach(function (k) {
      var m = metas[k], rel = el("div", { class: "relleno" });
      rel.style.width = "0%"; rel.style.background = "repeating-linear-gradient(135deg, rgba(255,185,0,0.55) 0 6px, rgba(255,185,0,0.2) 6px 12px)";
      requestAnimationFrame(function () { requestAnimationFrame(function () { rel.style.width = "100%"; }); });
      cont.appendChild(el("div", { class: "tarjeta" }, [
        el("div", { class: "titulo", texto: m.indicador }),
        el("div", { class: "pista", style: "margin-top:8px;height:8px" }, [rel]),
        el("div", { class: "meta mono", texto: "Meta " + num(Number(m.meta)) + (m.unidad ? " " + m.unidad : "") + " · " + m.obras + (m.obras === 1 ? " obra comunicada" : " obras comunicadas") + " · avance sin dato verificable" })
      ]));
    });
    cont.appendChild(aviso("La brecha solo se calcula cuando el PDM fija línea base y meta numérica y hay avance documentado. Hoy ninguna obra tiene evidencia documental aceptada."));
    cont.appendChild(el("h4", { class: "rotulo", texto: "Obras en el mapa" }));
    obras.forEach(function (f) {
      var p = f.properties;
      cont.appendChild(el("button", { class: "tarjeta", type: "button", onclick: function () { mostrarObra(f); } }, [
        el("div", { class: "titulo", texto: p.nombre }),
        el("div", { class: "meta", texto: (TIPOS_OBRA[p.tipo] || p.tipo) + " · ubicación por " + (p.precision || "").replace(/_/g, " ") }),
        el("span", { class: "etiqueta", texto: p.estado })
      ]));
    });
    cont.appendChild(el("h4", { class: "rotulo", texto: "Acciones y anuncios recientes" }));
    var etq = { public_action: "Acción pública", event_activity: "Evento", institutional_announcement: "Anuncio institucional" };
    datos.resumen.instagram.acciones.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).slice(0, 25).forEach(function (a) {
      cont.appendChild(el("div", { class: "tarjeta" }, [
        el("div", { class: "titulo", texto: etq[a.categoria] || a.categoria }),
        el("div", { class: "meta" }, [a.fecha + " · ", el("a", { href: a.url, target: "_blank", rel: "noopener noreferrer", texto: "Ver publicación" })])
      ]));
    });
    cont.appendChild(el("p", { class: "fuente", texto: "Comunicado por la Alcaldía; no equivale a verificación independiente." }));
    v.appendChild(cont);
  }

  // ---------- SECOP ----------
  function asegurarSecop() {
    if (estado.secop) return Promise.resolve();
    if (estado.cargandoSecop) return estado.cargandoSecop;
    $("#vista-secop").innerHTML = '<p class="subtitulo">Cargando proyectos de SECOP…</p>';
    estado.cargandoSecop = cargar("data/secop_proyectos.json").then(function (p) {
      estado.secop = p.sort(function (a, b) { return (b.f || "").localeCompare(a.f || ""); });
      pintarSecop();
    }).catch(function () { $("#vista-secop").innerHTML = '<p class="subtitulo">No se pudieron cargar los proyectos de SECOP.</p>'; });
    return estado.cargandoSecop;
  }
  function filtrarSecop() {
    var t = normalizar(estado.secopTexto);
    return estado.secop.filter(function (p) {
      return (!estado.secopAnio || p.a === estado.secopAnio) && (!estado.secopSector || p.s === estado.secopSector) &&
        (!t || normalizar(p.t + " " + p.e).indexOf(t) >= 0);
    });
  }
  function pintarSecop() {
    var v = $("#vista-secop"), r = datos.resumen.secop;
    v.innerHTML = "";
    var maxP = Math.max.apply(null, r.por_anio.map(function (a) { return a.proyectos; }));
    var graf = el("div", { class: "graf-anios", role: "group", "aria-label": "Proyectos por año" });
    r.por_anio.forEach(function (a) {
      var col = el("div", { class: "col" }); col.style.height = Math.max(3, a.proyectos / maxP * 90) + "px";
      graf.appendChild(el("button", {
        type: "button", "aria-pressed": estado.secopAnio === a.anio ? "true" : "false", title: a.anio + ": " + num(a.proyectos) + " proyectos · " + pesos(a.valor),
        onclick: function () { fijarAnio(estado.secopAnio === a.anio ? null : a.anio); }
      }, [col, el("span", { texto: "'" + a.anio.slice(2) })]));
    });
    var lista = filtrarSecop(), pag = estado.secopPagina, tam = 15, total = lista.length;
    var valor = lista.reduce(function (s, p) { return s + (p.v || 0); }, 0);
    var sector = el("select", { "aria-label": "Sector", onchange: function () { estado.secopSector = this.value; estado.secopPagina = 0; pintarSecop(); } },
      [el("option", { value: "", texto: "Todos los sectores" })].concat(Object.keys(SECTORES).map(function (k) {
        var o = el("option", { value: k, texto: SECTORES[k] }); if (k === estado.secopSector) o.selected = true; return o;
      })));
    var texto = el("input", { type: "search", placeholder: "Buscar objeto o entidad", "aria-label": "Buscar en SECOP", value: estado.secopTexto });
    texto.addEventListener("change", function () { estado.secopTexto = this.value; estado.secopPagina = 0; pintarSecop(); });
    var cont = el("div", {}, [
      el("div", { class: "rotulo", texto: "Contratación pública · SECOP I y II" }),
      el("h3", { texto: estado.secopAnio ? "Proyectos de obra " + estado.secopAnio : "Proyectos de obra" }),
      el("div", { class: "subtitulo", texto: num(r.contratos) + " contratos capturados · cobertura " + (r.cobertura === "partial" ? "parcial" : r.cobertura) }),
      el("div", { class: "cifras" }, [cifra("Proyectos", num(total)), cifra("Valor", pesos(valor)), cifra("Año", estado.secopAnio || "Todos")]),
      graf,
      el("div", { class: "filtros" }, [sector, texto])
    ]);
    lista.slice(pag * tam, pag * tam + tam).forEach(function (p) {
      cont.appendChild(el("div", { class: "tarjeta" }, [
        el("div", { class: "titulo", texto: (SECTORES[p.s] || p.s) + (p.i && p.i !== "por_clasificar" ? " · " + p.i.replace(/_/g, " ") : "") }),
        el("div", { class: "meta", texto: (p.e || "Entidad s. d.") + " · " + (p.f || "s. f.") + " · " + p.n + (p.n === 1 ? " contrato" : " contratos") }),
        el("div", { class: "meta" }, [el("span", { class: "mono", style: "color:#FBFAF6", texto: pesos(p.v) }), p.u ? " · " : "", p.u ? el("a", { href: p.u, target: "_blank", rel: "noopener noreferrer", texto: "Ver en SECOP" }) : null])
      ]));
    });
    var paginas = Math.max(1, Math.ceil(total / tam));
    cont.appendChild(el("div", { class: "paginacion" }, [
      el("button", { class: "chip", type: "button", "aria-pressed": "false", texto: "← Anterior", onclick: function () { if (estado.secopPagina > 0) { estado.secopPagina--; pintarSecop(); } } }),
      el("span", { texto: "Página " + (pag + 1) + " de " + paginas }),
      el("button", { class: "chip", type: "button", "aria-pressed": "false", texto: "Siguiente →", onclick: function () { if (estado.secopPagina < paginas - 1) { estado.secopPagina++; pintarSecop(); } } })
    ]));
    cont.appendChild(herramientas([["Descargar CSV (" + num(total) + ")", function () { descargarSecop(lista); }]]));
    cont.appendChild(aviso("Clasificación automática pendiente de revisión humana. SECOP no trae ubicación verificada, por eso estos proyectos aún no se dibujan en el mapa."));
    v.appendChild(cont);
  }
  function fijarAnio(anio) {
    estado.secopAnio = anio; estado.secopPagina = 0;
    var anios = datos.resumen.secop.por_anio.map(function (a) { return a.anio; });
    $("#tiempo-rango").value = anio ? anios.indexOf(anio) + 1 : 0;
    $("#tiempo-anio").textContent = anio || "Todos";
    if (estado.secop) pintarSecop();
  }
  function enlazarTiempo() {
    var anios = datos.resumen.secop.por_anio.map(function (a) { return a.anio; }), rango = $("#tiempo-rango");
    rango.max = anios.length;
    rango.addEventListener("input", function () {
      mostrarPestana("secop");
      asegurarSecop().then(function () { fijarAnio(Number(rango.value) ? anios[Number(rango.value) - 1] : null); });
    });
    $("#reproducir").addEventListener("click", function () {
      var boton = this;
      if (estado.reproduciendo) {
        clearInterval(estado.reproduciendo); estado.reproduciendo = null;
        boton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
        return;
      }
      mostrarPestana("secop");
      boton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
      asegurarSecop().then(function () {
        var i = 0;
        fijarAnio(anios[0]);
        estado.reproduciendo = setInterval(function () {
          i++;
          if (i >= anios.length) { boton.click(); fijarAnio(null); return; }
          fijarAnio(anios[i]);
        }, 1300);
      });
    });
  }

  // ---------- Buscador ----------
  var indice = [], elegido = 0;
  function construirIndice() {
    datos.contexto.barrios.features.forEach(function (f) { indice.push({ tipo: "Barrio", nombre: f.properties.nombre, coords: f.geometry.coordinates, zoom: 14.5 }); });
    datos.resumen.resumen.comunas.forEach(function (c) { indice.push({ tipo: "Comuna", nombre: c.nombre, comuna: c.comuna_id }); });
    datos.equipamientos.features.forEach(function (f) {
      if (f.properties.nombre) indice.push({ tipo: CATEGORIAS[f.properties.categoria] || "Equipamiento", nombre: f.properties.nombre, coords: f.geometry.coordinates, zoom: 16.5 });
    });
    datos.obras.features.forEach(function (f) { indice.push({ tipo: "Obra", nombre: f.properties.nombre, obra: f }); });
    indice.forEach(function (x) { x.clave = normalizar(x.nombre); });
  }
  function abrirBuscador() { $("#buscador").hidden = false; $("#q").value = ""; buscar(); $("#q").focus(); }
  function cerrarBuscador() { $("#buscador").hidden = true; }
  function buscar() {
    var q = normalizar($("#q").value.trim()), ul = $("#resultados");
    var res = q ? indice.filter(function (x) { return x.clave.indexOf(q) >= 0; })
      .sort(function (a, b) { return (a.clave.indexOf(q) === 0 ? 0 : 1) - (b.clave.indexOf(q) === 0 ? 0 : 1); }).slice(0, 12)
      : indice.filter(function (x) { return x.tipo === "Comuna"; });
    ul.innerHTML = ""; elegido = 0;
    if (!res.length) { ul.appendChild(el("li", { class: "vacio", texto: "Sin resultados para esa búsqueda." })); return; }
    res.forEach(function (x, i) {
      ul.appendChild(el("li", {}, [el("button", { type: "button", role: "option", "aria-selected": i === 0 ? "true" : "false", onclick: function () { ir(x); } },
        [el("span", { class: "tipo", texto: x.tipo }), el("span", { texto: x.nombre })])]));
    });
    ul._res = res;
  }
  function ir(x) {
    cerrarBuscador();
    if (x.comuna) { mostrarPestana("territorio"); pintarComuna(x.comuna); return; }
    if (x.obra) { mostrarPestana("obras"); mostrarObra(x.obra); return; }
    mapa.flyTo({ center: x.coords, zoom: x.zoom, pitch: estado.tres_d ? 60 : 0, duration: 1600 });
    popup(x.coords, "<b>" + escapar(x.nombre) + "</b><br><span style='color:#93A6C4'>" + escapar(x.tipo) + "</span>");
  }
  function enlazarBuscador() {
    $("#abrir-buscador").addEventListener("click", abrirBuscador);
    $("#q").addEventListener("input", buscar);
    $("#buscador").addEventListener("click", function (e) { if (e.target.id === "buscador") cerrarBuscador(); });
    $("#q").addEventListener("keydown", function (e) {
      var botones = document.querySelectorAll("#resultados button");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!botones.length) return;
        elegido = (elegido + (e.key === "ArrowDown" ? 1 : -1) + botones.length) % botones.length;
        botones.forEach(function (b, i) { b.setAttribute("aria-selected", i === elegido ? "true" : "false"); });
        botones[elegido].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && $("#resultados")._res && $("#resultados")._res[elegido]) {
        ir($("#resultados")._res[elegido]);
      }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); abrirBuscador(); }
      else if (e.key === "Escape") { cerrarBuscador(); $("#fuentes").hidden = true; }
    });
  }

  // ---------- Herramientas de trabajo: compartir, exportar, imprimir ----------
  function herramientas(acciones) {
    return el("div", { class: "herramientas" }, acciones.map(function (a) {
      return el("button", { class: "chip" + (a[2] ? " chip-destacado" : ""), type: "button", "aria-pressed": "false", texto: a[0], onclick: a[1] });
    }));
  }
  function aviso_breve(texto) {
    var t = $("#toast");
    t.textContent = texto; t.hidden = false;
    clearTimeout(estado.toast);
    estado.toast = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // La vista (lente, comuna, cámara, mapa base) viaja en la dirección para compartirla tal cual
  function guardarVistaURL() {
    if (!mapa) return;
    var c = mapa.getCenter();
    var partes = ["lente=" + estado.lente, "c=" + c.lng.toFixed(5) + "," + c.lat.toFixed(5), "z=" + mapa.getZoom().toFixed(2),
      "p=" + Math.round(mapa.getPitch()), "b=" + Math.round(mapa.getBearing())];
    if (estado.comunaVista) partes.push("comuna=" + estado.comunaVista);
    if (estado.base === "satelite") partes.push("base=satelite");
    if (estado.lente === "necesidad") partes.push("pesos=" + COMPONENTES.map(function (c) { return estado.pesos[c.id]; }).join(""));
    try { history.replaceState(null, "", "#" + partes.join("&")); } catch (e) { /* vista sin historial */ }
  }
  function leerVistaURL() {
    var h = {};
    location.hash.replace(/^#/, "").split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) h[p[0]] = decodeURIComponent(p[1] || ""); });
    if (h.pesos && /^[0-5]{8}$/.test(h.pesos)) {
      COMPONENTES.forEach(function (c, i) { estado.pesos[c.id] = Number(h.pesos[i]); });
      calcularIndice(); mapa.getSource("manzanas").setData(datos.manzanas);
    }
    if (h.lente && LENTES.some(function (l) { return l.id === h.lente; })) { estado.lente = h.lente; aplicarLente(); }
    if (h.lente === "necesidad" && !h.comuna) pintarNecesidad();
    if (h.base === "satelite") fijarBase("satelite");
    if (h.comuna) { pintarComuna(h.comuna); return; }
    if (h.c && h.z) {
      var c = h.c.split(",").map(Number);
      if (c.length === 2 && !isNaN(c[0]) && !isNaN(c[1])) mapa.jumpTo({ center: c, zoom: Number(h.z), pitch: Number(h.p) || 0, bearing: Number(h.b) || 0 });
    }
  }
  function compartir() {
    guardarVistaURL();
    var url = location.href;
    if (navigator.share && window.matchMedia("(max-width: 760px)").matches) {
      navigator.share({ title: document.title, url: url }).catch(function () {});
      return;
    }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
      aviso_breve("Enlace copiado: abre el mapa en esta misma vista");
    }).catch(function () { window.prompt("Copie este enlace:", url); });
  }

  function descargarCSV(nombre, columnas, filas) {
    var celda = function (v) { v = v == null ? "" : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var texto = "﻿" + [columnas.map(function (c) { return celda(c[0]); }).join(",")]
      .concat(filas.map(function (f) { return columnas.map(function (c) { return celda(c[1](f)); }).join(","); })).join("\n");
    var a = el("a", { href: URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" })), download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    aviso_breve("Descargado " + nombre);
  }
  var CORTE = function () { return datos.resumen.secop.corte || ""; };
  function descargarComunas() {
    descargarCSV("monteria_comunas_" + CORTE() + ".csv", [
      ["comuna_id", function (c) { return c.comuna_id; }], ["nombre", function (c) { return c.nombre; }],
      ["manzanas", function (c) { return c.manzanas; }], ["personas", function (c) { return c.personas; }],
      ["hogares", function (c) { return c.hogares; }], ["viviendas", function (c) { return c.viviendas; }],
      ["pct_sin_acueducto", function (c) { return c.pct_sin_acueducto; }], ["pct_sin_alcantarillado", function (c) { return c.pct_sin_alcantarillado; }],
      ["pct_sin_recoleccion", function (c) { return c.pct_sin_recoleccion; }], ["pct_sin_internet", function (c) { return c.pct_sin_internet; }],
      ["pct_personas_lejos_salud", function (c) { return c.pct_personas_lejos_salud; }], ["pct_personas_lejos_educacion", function (c) { return c.pct_personas_lejos_educacion; }],
      ["pct_personas_lejos_seguridad", function (c) { return c.pct_personas_lejos_seguridad; }],
      ["fuente", function () { return "Censo DANE 2018; comunas OpenStreetMap (no oficiales)"; }]
    ], datos.resumen.resumen.comunas);
  }
  function descargarEquipamientos(c) {
    var fs = datos.equipamientos.features.filter(function (f) { return f.properties.comuna_id === c.comuna_id; });
    descargarCSV("monteria_equipamientos_comuna_" + c.comuna_id + ".csv", [
      ["nombre", function (f) { return f.properties.nombre; }], ["categoria", function (f) { return CATEGORIAS[f.properties.categoria] || f.properties.categoria; }],
      ["tipo", function (f) { return f.properties.tipo; }], ["longitud", function (f) { return f.geometry.coordinates[0]; }],
      ["latitud", function (f) { return f.geometry.coordinates[1]; }], ["fuente", function () { return "OpenStreetMap"; }]
    ], fs);
  }
  function descargarSecop(lista) {
    descargarCSV("monteria_secop_proyectos" + (estado.secopAnio ? "_" + estado.secopAnio : "") + ".csv", [
      ["titulo", function (p) { return p.t; }], ["sector", function (p) { return SECTORES[p.s] || p.s; }], ["intervencion", function (p) { return p.i; }],
      ["valor_cop", function (p) { return p.v; }], ["fecha_firma", function (p) { return p.f; }], ["entidad", function (p) { return p.e; }],
      ["contratos", function (p) { return p.n; }], ["url_secop", function (p) { return p.u; }],
      ["nota", function () { return "Clasificación automática pendiente de revisión humana"; }]
    ], lista);
  }

  // Ficha imprimible: foto del mapa + contenido del panel, con estilo claro para PDF
  function fotoMapa() {
    return new Promise(function (ok) {
      mapa.once("render", function () {
        try { ok(mapa.getCanvas().toDataURL("image/png")); } catch (e) { ok(null); }
      });
      mapa.triggerRepaint();
    });
  }
  function imprimirFicha(titulo) {
    fotoMapa().then(function (img) {
      var r = $("#reporte");
      var cuerpo = $("#vista-territorio").cloneNode(true);
      cuerpo.removeAttribute("id");
      cuerpo.querySelectorAll("button.chip, .herramientas").forEach(function (b) { b.remove(); });
      r.innerHTML = "";
      r.appendChild(el("header", { class: "rep-cab" }, [
        el("img", { src: "assets/colombia_simbolo_azul.png", alt: "" }),
        el("div", {}, [el("strong", { texto: "Geovisor Montería · CIIAC" }), el("span", { texto: titulo })]),
        el("span", { class: "rep-fecha", texto: "Generado " + new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) })
      ]));
      if (img) r.appendChild(el("img", { class: "rep-mapa", src: img, alt: "Mapa de " + titulo }));
      r.appendChild(el("p", { class: "rep-lente", texto: "Lente del mapa: " + lenteActual().titulo + " · " + lenteActual().nota }));
      r.appendChild(cuerpo);
      r.appendChild(el("footer", { class: "rep-pie", texto: "Fuentes: Censo DANE 2018 por manzana; comunas, barrios y equipamientos de OpenStreetMap (no son límites ni registros oficiales); distancias en línea recta. Consulte la vista en línea: " + location.href }));
      setTimeout(function () { window.print(); }, 150);
    });
  }

  // ---------- Índice de necesidad por manzana ----------
  // Cada componente se normaliza a 0-1 (porcentajes /100; distancias /2 km con tope) y el
  // índice es su promedio ponderado ×100. Los pesos los ajusta quien consulta.
  var COMPONENTES = [
    { id: "alc", nombre: "Sin alcantarillado", campo: "pct_sin_alcantarillado", tipo: "pct" },
    { id: "acu", nombre: "Sin acueducto", campo: "pct_sin_acueducto", tipo: "pct" },
    { id: "rec", nombre: "Sin recolección de basuras", campo: "pct_sin_recoleccion", tipo: "pct" },
    { id: "int", nombre: "Sin internet", campo: "pct_sin_internet", tipo: "pct" },
    { id: "sal", nombre: "Lejos de salud", campo: "dist_salud_m", tipo: "dist" },
    { id: "edu", nombre: "Lejos de educación", campo: "dist_educacion_m", tipo: "dist" },
    { id: "seg", nombre: "Lejos de seguridad", campo: "dist_seguridad_m", tipo: "dist" },
    { id: "est", nombre: "Estrato bajo", campo: "estrato_modal", tipo: "estrato" }
  ];
  var PRESETS = {
    "Equilibrado": { alc: 3, acu: 3, rec: 2, int: 1, sal: 3, edu: 2, seg: 2, est: 2 },
    "Servicios básicos": { alc: 5, acu: 5, rec: 3, int: 0, sal: 0, edu: 0, seg: 0, est: 1 },
    "Acceso a equipamientos": { alc: 0, acu: 0, rec: 0, int: 0, sal: 5, edu: 4, seg: 3, est: 1 },
    "Brecha digital": { alc: 0, acu: 0, rec: 0, int: 5, sal: 0, edu: 2, seg: 0, est: 2 }
  };
  estado.pesos = Object.assign({}, PRESETS["Equilibrado"]);
  function normal(c, v) {
    if (v == null || isNaN(v)) return null;
    if (c.tipo === "pct") return Math.max(0, Math.min(1, v / 100));
    if (c.tipo === "dist") return Math.max(0, Math.min(1, v / 2000));
    return Math.max(0, Math.min(1, (6 - v) / 5));
  }
  function calcularIndice() {
    datos.manzanas.features.forEach(function (f) {
      var suma = 0, peso = 0;
      COMPONENTES.forEach(function (c) {
        var w = estado.pesos[c.id] || 0, v = normal(c, f.properties[c.campo]);
        if (!w || v == null) return;
        suma += w * v; peso += w;
      });
      f.properties.necesidad = peso ? Math.round(suma / peso * 1000) / 10 : null;
    });
  }
  var recalculo;
  function recalcularIndice() {
    clearTimeout(recalculo);
    recalculo = setTimeout(function () {
      calcularIndice();
      if (mapa && mapa.getSource("manzanas")) mapa.getSource("manzanas").setData(datos.manzanas);
      if (estado.seleccion) mapa.setFeatureState({ source: "manzanas", id: estado.seleccion.cod_dane }, { sel: true });
      calcularCortes();
      pintarRankingNecesidad();
      guardarVistaURL();
    }, 200);
  }
  function rankingNecesidad() {
    var porComuna = {}, alta = 0, personasAlta = 0;
    datos.manzanas.features.forEach(function (f) {
      var p = f.properties, n = p.necesidad;
      if (n == null) return;
      var k = p.comuna_id || "sin";
      porComuna[k] = porComuna[k] || { suma: 0, personas: 0, alta: 0 };
      porComuna[k].suma += n * (p.personas || 0); porComuna[k].personas += p.personas || 0;
      if (n >= 60) { alta++; personasAlta += p.personas || 0; porComuna[k].alta += p.personas || 0; }
    });
    var comunas = Object.keys(porComuna).filter(function (k) { return k !== "sin" && porComuna[k].personas; }).map(function (k) {
      return { id: k, nombre: nombreComuna(k), indice: porComuna[k].suma / porComuna[k].personas, alta: porComuna[k].alta };
    }).sort(function (a, b) { return b.indice - a.indice; });
    var manzanas = datos.manzanas.features.filter(function (f) { return f.properties.necesidad != null && f.properties.personas >= 20; })
      .sort(function (a, b) { return b.properties.necesidad - a.properties.necesidad; }).slice(0, 8);
    return { comunas: comunas, manzanas: manzanas, alta: alta, personasAlta: personasAlta };
  }
  function pintarNecesidad() {
    mostrarPestana("territorio");
    estado.comunaVista = null;
    var v = $("#vista-territorio"); v.innerHTML = "";
    var sliders = COMPONENTES.map(function (c) {
      var valor = el("span", { class: "mono", texto: String(estado.pesos[c.id]) });
      var rango = el("input", { type: "range", min: "0", max: "5", step: "1", value: String(estado.pesos[c.id]), "aria-label": "Peso de " + c.nombre });
      rango.addEventListener("input", function () {
        estado.pesos[c.id] = Number(rango.value); valor.textContent = rango.value;
        document.querySelectorAll("[data-preset]").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        recalcularIndice();
      });
      return el("label", { class: "peso" }, [el("span", { class: "peso-nombre", texto: c.nombre }), rango, valor]);
    });
    var presets = el("div", { class: "herramientas" }, Object.keys(PRESETS).map(function (k) {
      var activo = Object.keys(PRESETS[k]).every(function (c) { return PRESETS[k][c] === estado.pesos[c]; });
      return el("button", { class: "chip", type: "button", "data-preset": k, "aria-pressed": activo ? "true" : "false", texto: k, onclick: function () {
        estado.pesos = Object.assign({}, PRESETS[k]); pintarNecesidad(); recalcularIndice();
      } });
    }));
    v.appendChild(el("div", { class: "aparecer" }, [
      el("button", { class: "chip", type: "button", "aria-pressed": "false", texto: "← Ciudad", onclick: function () { pintarCiudad(); } }),
      el("div", { class: "rotulo", texto: "Priorización de inversión", style: "margin-top:12px;color:#FFB900" }),
      el("h3", { texto: "Índice de necesidad" }),
      el("div", { class: "subtitulo", texto: "Ajuste cuánto pesa cada carencia; el mapa y el ranking se actualizan al instante." }),
      presets,
      el("div", { class: "pesos" }, sliders),
      el("div", { id: "ranking-necesidad" }),
      herramientas([["CSV de manzanas priorizadas", descargarNecesidad], ["Ficha PDF", function () { imprimirFicha("Índice de necesidad · Montería"); }], ["Compartir", compartir]]),
      aviso("Índice relativo para comparar zonas de la cabecera, no una medida oficial de pobreza. Usa el Censo 2018 y distancias en línea recta; las distancias cuentan completas desde 2 km.")
    ]));
    pintarRankingNecesidad();
  }
  function pintarRankingNecesidad() {
    var cont = $("#ranking-necesidad");
    if (!cont) return;
    var r = rankingNecesidad(), maxC = r.comunas.length ? r.comunas[0].indice : 1;
    cont.innerHTML = "";
    cont.appendChild(el("div", { class: "cifras" }, [
      cifra("Manzanas prioridad alta (≥60)", num(r.alta)), cifra("Personas en ellas", num(r.personasAlta)),
      cifra("Promedio ciudad", num(cuantil(datos.manzanas.features.map(function (f) { return f.properties.necesidad; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; }), 0.5), 0))
    ]));
    cont.appendChild(el("h4", { class: "rotulo", texto: "Comunas por índice (ponderado por población)" }));
    r.comunas.forEach(function (c) {
      var rel = el("div", { class: "relleno" });
      rel.style.width = Math.max(4, c.indice / maxC * 100) + "%";
      rel.style.background = c.indice >= 50 ? COLORES.rosa : c.indice >= 30 ? COLORES.ambar : COLORES.cian;
      cont.appendChild(el("button", { class: "tarjeta", type: "button", onclick: function () { pintarComuna(c.id); } }, [
        el("div", { class: "cab-fila" }, [el("span", { class: "titulo", texto: c.nombre }), el("span", { class: "mono", texto: num(c.indice, 1) })]),
        el("div", { class: "pista", style: "margin-top:6px" }, [rel]),
        el("div", { class: "meta", texto: num(c.alta) + " personas en manzanas de prioridad alta" })
      ]));
    });
    cont.appendChild(el("h4", { class: "rotulo", texto: "Manzanas con mayor necesidad" }));
    r.manzanas.forEach(function (f, i) {
      var p = f.properties;
      cont.appendChild(el("button", { class: "tarjeta", type: "button", onclick: function () {
        var a = f.geometry.coordinates[0], x = 0, y = 0; a.forEach(function (q) { x += q[0]; y += q[1]; });
        mapa.flyTo({ center: [x / a.length, y / a.length], zoom: 15.5, pitch: estado.tres_d ? 60 : 0, duration: 1400 });
        seleccionarManzana(p);
      } }, [
        el("div", { class: "cab-fila" }, [el("span", { class: "titulo", texto: (i + 1) + ". Cerca de " + (p.barrio || "s. d.") }), el("span", { class: "mono", style: "color:#FF5C8A", texto: num(p.necesidad, 1) })]),
        el("div", { class: "meta", texto: nombreComuna(p.comuna_id) + " · " + num(p.personas) + " personas · DANE " + p.cod_dane })
      ]));
    });
  }
  function descargarNecesidad() {
    var filas = datos.manzanas.features.map(function (f) { return f.properties; }).filter(function (p) { return p.necesidad != null; })
      .sort(function (a, b) { return b.necesidad - a.necesidad; });
    var pesos = COMPONENTES.map(function (c) { return c.id + "=" + estado.pesos[c.id]; }).join(" ");
    descargarCSV("monteria_indice_necesidad.csv", [
      ["cod_dane", function (p) { return p.cod_dane; }], ["comuna", function (p) { return nombreComuna(p.comuna_id); }],
      ["barrio_referencia_osm", function (p) { return p.barrio; }], ["personas", function (p) { return p.personas; }],
      ["indice_necesidad", function (p) { return p.necesidad; }]
    ].concat(COMPONENTES.map(function (c) { return [c.campo, function (p) { return p[c.campo]; }]; }))
      .concat([["pesos", function () { return pesos; }]]), filas);
  }

  // ---------- Simulador: ¿cuántas personas ganan acceso con un nuevo equipamiento? ----------
  var SIM_TIPOS = { salud: { campo: "dist_salud_m", nombre: "salud" }, educacion: { campo: "dist_educacion_m", nombre: "educación" }, seguridad: { campo: "dist_seguridad_m", nombre: "seguridad" } };
  var centroides = null;
  function prepararCentroides() {
    if (centroides) return centroides;
    centroides = datos.manzanas.features.map(function (f) {
      var a = f.geometry.coordinates[0], x = 0, y = 0;
      a.forEach(function (q) { x += q[0]; y += q[1]; });
      return { lng: x / a.length, lat: y / a.length, p: f.properties };
    });
    return centroides;
  }
  function metros(a, b) {
    var R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function evaluarSitio(punto, tipo) {
    var campo = SIM_TIPOS[tipo].campo, umbral = datos.resumen.resumen.umbral_distancia_m, ganan = 0, manzanas = 0, cerca = 0;
    prepararCentroides().forEach(function (c) {
      var d = metros(punto, c);
      if (d > umbral) return;
      cerca += c.p.personas || 0;
      if ((c.p[campo] == null || c.p[campo] > umbral)) { ganan += c.p.personas || 0; manzanas++; }
    });
    return { ganan: ganan, manzanas: manzanas, cerca: cerca };
  }
  function sugerirSitios(tipo) {
    var campo = SIM_TIPOS[tipo].campo, umbral = datos.resumen.resumen.umbral_distancia_m;
    var candidatos = prepararCentroides().filter(function (c) { return c.p[campo] > umbral && c.p.personas > 0; });
    var paso = Math.max(1, Math.floor(candidatos.length / 350));
    var mejores = [];
    for (var i = 0; i < candidatos.length; i += paso) {
      var r = evaluarSitio(candidatos[i], tipo);
      mejores.push({ lng: candidatos[i].lng, lat: candidatos[i].lat, ganan: r.ganan, manzanas: r.manzanas, p: candidatos[i].p });
    }
    mejores.sort(function (a, b) { return b.ganan - a.ganan; });
    var elegidos = [];
    mejores.forEach(function (m) {
      if (elegidos.length < 3 && elegidos.every(function (e) { return metros(e, m) > 1500; })) elegidos.push(m);
    });
    return elegidos;
  }
  function circulo(centro, radio) {
    var pts = [], dLat = radio / 111320, dLng = radio / (111320 * Math.cos(centro.lat * Math.PI / 180));
    for (var i = 0; i <= 64; i++) { var a = i / 64 * 2 * Math.PI; pts.push([centro.lng + dLng * Math.cos(a), centro.lat + dLat * Math.sin(a)]); }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [pts] }, properties: {} };
  }
  function dibujarSimulacion(sitios) {
    var umbral = datos.resumen.resumen.umbral_distancia_m;
    var fc = { type: "FeatureCollection", features: [] };
    sitios.forEach(function (s, i) {
      fc.features.push(circulo(s, umbral));
      fc.features.push({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { n: String(i + 1) } });
    });
    if (!mapa.getSource("simulacion")) {
      mapa.addSource("simulacion", { type: "geojson", data: fc });
      mapa.addLayer({ id: "sim-area", type: "fill", source: "simulacion", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": COLORES.ambar, "fill-opacity": 0.12 } });
      mapa.addLayer({ id: "sim-borde", type: "line", source: "simulacion", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": COLORES.ambar, "line-width": 2, "line-dasharray": [2, 1.5] } });
      mapa.addLayer({ id: "sim-punto", type: "circle", source: "simulacion", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 9, "circle-color": COLORES.blanco, "circle-stroke-color": COLORES.ambar, "circle-stroke-width": 4 } });
    } else mapa.getSource("simulacion").setData(fc);
  }
  function limpiarSimulacion() {
    if (mapa.getSource("simulacion")) mapa.getSource("simulacion").setData({ type: "FeatureCollection", features: [] });
    estado.simulando = null;
    mapa.getCanvas().style.cursor = "";
  }
  function abrirSimulador() {
    estado.simulando = estado.simulando || "salud";
    mostrarPestana("territorio");
    pintarSimulador(null);
  }
  function pintarSimulador(resultado) {
    var tipo = estado.simulando, v = $("#vista-territorio"), umbral = datos.resumen.resumen.umbral_distancia_m;
    v.innerHTML = "";
    var selector = el("div", { class: "herramientas" }, Object.keys(SIM_TIPOS).map(function (k) {
      return el("button", { class: "chip", type: "button", "aria-pressed": k === tipo ? "true" : "false", texto: "Nuevo de " + SIM_TIPOS[k].nombre,
        onclick: function () { estado.simulando = k; limpiarSimulacion(); estado.simulando = k; pintarSimulador(null); } });
    }));
    var cuerpo = [
      el("button", { class: "chip", type: "button", "aria-pressed": "false", texto: "← Salir del simulador", onclick: function () { limpiarSimulacion(); pintarCiudad(); } }),
      el("div", { class: "rotulo", texto: "Simulador de inversión", style: "margin-top:12px;color:#FFB900" }),
      el("h3", { texto: "¿Dónde construir?" }),
      el("div", { class: "subtitulo", texto: "Haga clic en el mapa para ubicar un equipamiento y ver cuántas personas quedarían a menos de " + num(umbral) + " m." }),
      selector,
      el("button", { class: "tarjeta tarjeta-accion", type: "button", onclick: function () {
        var s = sugerirSitios(tipo);
        dibujarSimulacion(s);
        if (s.length) {
          var b = new maplibregl.LngLatBounds(); s.forEach(function (x) { b.extend([x.lng, x.lat]); });
          mapa.fitBounds(b, { padding: paddingMapa(), maxZoom: 14, duration: 1400 });
        }
        pintarSimulador({ sugeridos: s });
      } }, [el("div", { class: "titulo", texto: "✦ Sugerir los 3 mejores sitios" }), el("div", { class: "meta", texto: "Busca dónde un nuevo equipamiento de " + SIM_TIPOS[tipo].nombre + " beneficiaría a más personas que hoy están lejos." })])
    ];
    if (resultado && resultado.ganan != null) {
      cuerpo.push(el("div", { class: "tarjeta resultado-sim" }, [
        el("div", { class: "rotulo", texto: "Resultado del sitio elegido" }),
        el("div", { class: "cifra-grande mono", texto: num(resultado.ganan) }),
        el("div", { class: "meta", texto: "personas ganarían acceso a " + SIM_TIPOS[tipo].nombre + " a menos de " + num(umbral) + " m (" + num(resultado.manzanas) + " manzanas que hoy están lejos)." }),
        el("div", { class: "meta", texto: "En total viven " + num(resultado.cerca) + " personas dentro del radio." })
      ]));
    }
    if (resultado && resultado.sugeridos) {
      if (!resultado.sugeridos.length) cuerpo.push(aviso("No hay manzanas lejos de " + SIM_TIPOS[tipo].nombre + " con población registrada."));
      resultado.sugeridos.forEach(function (s, i) {
        cuerpo.push(el("button", { class: "tarjeta", type: "button", onclick: function () { mapa.flyTo({ center: [s.lng, s.lat], zoom: 14.5, duration: 1200 }); } }, [
          el("div", { class: "titulo", texto: "Sitio " + (i + 1) + " · cerca de " + (s.p.barrio || "sin barrio de referencia") }),
          el("div", { class: "meta mono", texto: num(s.ganan) + " personas ganan acceso · " + num(s.manzanas) + " manzanas" })
        ]));
      });
    }
    cuerpo.push(aviso("Estimación con población del Censo 2018 y distancia en línea recta desde el centro de cada manzana. Sirve para comparar alternativas, no reemplaza el estudio de predios, normas del POT ni capacidad del servicio."));
    v.appendChild(el("div", { class: "aparecer" }, cuerpo));
  }
  function clicSimulador(e) {
    if (!estado.simulando) return false;
    var p = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    var r = evaluarSitio(p, estado.simulando);
    dibujarSimulacion([p]);
    pintarSimulador(r);
    return true;
  }

  // ---------- Tutorial de primera visita ----------
  var PASOS = [
    ["Bienvenido al Geovisor Montería", "Explore la ciudad manzana por manzana con datos del Censo DANE, OpenStreetMap, obras comunicadas y SECOP. Le mostramos lo esencial en cuatro pasos."],
    ["Elija un lente", "La barra de la izquierda cambia lo que muestra el mapa: densidad, servicios, distancia a salud, educación o seguridad, y ambiente. La altura y el color de cada manzana siguen el valor."],
    ["Haga clic para ver fichas", "Toque una manzana o una etiqueta de comuna (C1 a C9) para ver su ficha. Desde la ficha puede descargar un PDF o un CSV y compartir la vista exacta."],
    ["Simule y pregunte", "Use «Simular equipamiento» para estimar a cuántas personas beneficia un nuevo puesto de salud, colegio o estación. Y pregunte al Asistente por cualquier dato del mapa."]
  ];
  function iniciarTutorial() {
    $("#abrir-ayuda").addEventListener("click", function () { mostrarPaso(0); });
    var visto = false;
    try { visto = localStorage.getItem("geovisor-tutorial") === "1"; } catch (e) { visto = false; }
    if (!visto && !location.hash) mostrarPaso(0);
  }
  function mostrarPaso(i) {
    var t = $("#tutorial");
    if (i >= PASOS.length) { t.hidden = true; try { localStorage.setItem("geovisor-tutorial", "1"); } catch (e) { /* sin almacenamiento */ } return; }
    t.hidden = false;
    t.querySelector(".tut-paso").textContent = "Paso " + (i + 1) + " de " + PASOS.length;
    t.querySelector("h2").textContent = PASOS[i][0];
    t.querySelector("p").textContent = PASOS[i][1];
    var sig = t.querySelector("[data-siguiente]");
    sig.textContent = i === PASOS.length - 1 ? "Empezar" : "Siguiente";
    sig.onclick = function () { mostrarPaso(i + 1); };
    t.querySelector("[data-omitir]").onclick = function () { mostrarPaso(PASOS.length); };
    sig.focus();
  }

  // ---------- Asistente ----------
  var LENTE_POR_CAMPO = {
    pct_sin_alcantarillado: "alcantarillado", pct_sin_acueducto: "acueducto", pct_sin_internet: "internet",
    pct_personas_lejos_salud: "salud", pct_personas_lejos_educacion: "educacion", pct_personas_lejos_seguridad: "seguridad",
    personas: "densidad", pct_sin_recoleccion: "densidad"
  };
  function iniciarAsistente() {
    if (!window.GeovisorChat) return;
    window.GeovisorChat.iniciar({
      datos: datos, escapar: escapar, CATEGORIAS: CATEGORIAS, SECTORES: SECTORES,
      irComuna: function (id) { mostrarPestana("asistente"); pintarComuna(id); },
      irPunto: function (c, nombre) {
        mapa.flyTo({ center: c, zoom: 14.5, pitch: estado.tres_d ? 60 : 0, duration: 1600 });
        popup(c, "<b>" + escapar(nombre) + "</b><br><span style='color:#93A6C4'>Barrio · punto OSM</span>");
      },
      fijarLente: function (campo) { estado.lente = campo ? (LENTE_POR_CAMPO[campo] || "densidad") : "ambiente"; aplicarLente(); },
      pestana: function (nombre) { mostrarPestana(nombre); },
      anioSecop: function (anio) { asegurarSecop().then(function () { fijarAnio(anio); }); },
      fuentes: function () { $("#fuentes").hidden = false; },
      necesidad: function () { estado.lente = "necesidad"; aplicarLente(); limpiarSimulacion(); return rankingNecesidad(); },
      abrirNecesidad: function () { pintarNecesidad(); mostrarPestana("asistente"); },
      inicio: function () { $("#vista-inicial").click(); mostrarPestana("asistente"); },
      vista: function () {
        return { lente: lenteActual().titulo, comuna: comunaSel, zoom: Math.round(mapa.getZoom() * 10) / 10,
          manzana: estado.seleccion ? { barrio: estado.seleccion.barrio, comuna: estado.seleccion.comuna_id, cod_dane: estado.seleccion.cod_dane } : null };
      }
    });
  }

  // ---------- Arranque ----------
  Promise.all([
    cargar("data/contexto.json"), cargar("data/manzanas.geojson"), cargar("data/equipamientos.geojson"),
    cargar("data/obras.geojson"), cargar("data/resumen.json")
  ]).then(function (r) {
    datos = { contexto: r[0], manzanas: r[1], equipamientos: r[2], obras: r[3], resumen: r[4] };
    calcularIndice();
    calcularCortes();
    pintarKpis(); pintarLentes(); enlazarControles(); pintarFuentes();
    pintarCiudad(); pintarObras(); enlazarTiempo(); construirIndice(); enlazarBuscador();
    crearMapa(); aplicarLente();
  }).catch(function (err) {
    $("#carga .carga-cuerpo p").textContent = "No se pudieron cargar los datos del visor.";
    console.error(err);
  });
})();
