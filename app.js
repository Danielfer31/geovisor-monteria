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
    ambiente: "M5 21c0-9 5-15 15-16-1 10-6 15-15 16zM5 21l8-8"
  };

  var LENTES = [
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
    capasBase().forEach(function (c) { mapa.addLayer(c, antesDe); });
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
    mapa.on("click", "manzanas", function (e) {
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
    return c ? c.nombre : "";
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
      if (mapa.queryRenderedFeatures(e.point, { layers: ["obras", "equipamientos", "manzanas"] }).length) return;
      var f = mapa.queryRenderedFeatures(e.point, { layers: CAPAS_ECO })[0];
      if (!f) return;
      var eco = ECO[f.layer.id.replace("eco-", "")];
      popup(e.lngLat, "<b>" + escapar(f.properties.name || eco.nombre) + "</b><br><span style='color:" + eco.borde + "'>" + escapar(eco.nombre) + "</span><br><span style='color:#93A6C4'>Cobertura OpenStreetMap · no es un límite oficial</span>");
    });

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
      mapa.setPaintProperty("manzanas", "fill-extrusion-opacity", l.campo ? 0.88 : 0.22);
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
        onclick: function () { estado.lente = l.id; aplicarLente(); if (estado.seleccion && lenteActual().campo) pintarManzana(estado.seleccion); }
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
    if (mapa && mapa.getSource("comunas")) marcarComuna(null);
    var m = datos.resumen.resumen.municipio, v = $("#vista-territorio");
    v.innerHTML = "";
    var cont = el("div", { class: "aparecer" }, [
      el("div", { class: "rotulo", texto: "Cabecera municipal" }),
      el("h3", { texto: "Montería" }),
      el("div", { class: "subtitulo", texto: "Córdoba · " + num(m.manzanas) + " manzanas · 9 comunas OSM" }),
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

  // ---------- Arranque ----------
  Promise.all([
    cargar("data/contexto.json"), cargar("data/manzanas.geojson"), cargar("data/equipamientos.geojson"),
    cargar("data/obras.geojson"), cargar("data/resumen.json")
  ]).then(function (r) {
    datos = { contexto: r[0], manzanas: r[1], equipamientos: r[2], obras: r[3], resumen: r[4] };
    calcularCortes();
    pintarKpis(); pintarLentes(); enlazarControles(); pintarFuentes();
    pintarCiudad(); pintarObras(); enlazarTiempo(); construirIndice(); enlazarBuscador();
    crearMapa(); aplicarLente();
  }).catch(function (err) {
    $("#carga .carga-cuerpo p").textContent = "No se pudieron cargar los datos del visor.";
    console.error(err);
  });
})();
