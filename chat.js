// Asistente del geovisor: responde con los datos cargados en el visor y, si hay
// un servicio configurado en config.js (chatUrl), amplía la respuesta con Claude.
(function () {
  "use strict";

  var G, historial = [];
  var CONFIG = window.GEOVISOR_CONFIG || {};

  var METRICAS = [
    { claves: ["alcantarillado", "aguas negras", "saneamiento"], campo: "pct_sin_alcantarillado", texto: "viviendas sin alcantarillado", unidad: "%" },
    { claves: ["acueducto", "agua potable"], campo: "pct_sin_acueducto", texto: "viviendas sin acueducto", unidad: "%" },
    { claves: ["internet", "conectividad"], campo: "pct_sin_internet", texto: "viviendas sin internet", unidad: "%" },
    { claves: ["recoleccion", "basura", "residuos"], campo: "pct_sin_recoleccion", texto: "viviendas sin recolección de basuras", unidad: "%" },
    { claves: ["salud", "hospital", "clinica", "puesto de salud"], campo: "pct_personas_lejos_salud", texto: "personas a más de 1 km de un equipamiento de salud", unidad: "%", categoria: "salud" },
    { claves: ["educacion", "colegio", "escuela", "institucion educativa"], campo: "pct_personas_lejos_educacion", texto: "personas a más de 1 km de un equipamiento educativo", unidad: "%", categoria: "educacion" },
    { claves: ["seguridad", "policia", "cai", "estacion"], campo: "pct_personas_lejos_seguridad", texto: "personas a más de 1 km de un equipamiento de seguridad", unidad: "%", categoria: "seguridad" },
    { claves: ["poblacion", "habitantes", "personas", "gente"], campo: "personas", texto: "personas", unidad: "" }
  ];
  var CATEGORIAS = {
    salud: ["salud", "hospital", "clinica"], educacion: ["educacion", "colegio", "escuela"], seguridad: ["seguridad", "policia", "cai"],
    recreacion: ["parque", "recreacion", "cancha", "deporte"], abastecimiento: ["mercado", "abastecimiento", "plaza"],
    institucional: ["institucional", "alcaldia"], transporte: ["transporte", "terminal"]
  };
  var SUGERENCIAS = [
    "¿Dónde priorizar la inversión?",
    "¿Qué comuna tiene más viviendas sin alcantarillado?",
    "Resumen de la comuna 5",
    "¿Cuántos equipamientos de salud hay en la comuna 3?",
    "¿Qué obras comunicó la Alcaldía?",
    "Contratos de SECOP en 2024",
    "Muéstrame el río y los humedales"
  ];

  function norm(t) { return (t || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  // Coincidencia al inicio de palabra: evita que "barrio" active "rio" o "obras" active "obra s"
  function tiene(q, lista) {
    return lista.some(function (k) { return new RegExp("(^|[^a-z0-9])" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(q); });
  }
  function n(v, d) { return v == null || isNaN(v) ? "s. d." : Number(v).toLocaleString("es-CO", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }); }
  function valor(v, m) { return m.unidad === "%" ? n(v, 1) + "%" : n(v); }
  function comunas() { return G.datos.resumen.resumen.comunas.slice().sort(function (a, b) { return Number(a.comuna_id) - Number(b.comuna_id); }); }

  function detectarComuna(q) {
    var m = q.match(/comuna\s*(\d{1,2})/) || q.match(/\bc\s?(\d)\b/);
    if (!m) return null;
    return comunas().filter(function (c) { return c.comuna_id === String(Number(m[1])); })[0] || null;
  }
  function detectarBarrio(q) {
    var mejor = null;
    G.datos.contexto.barrios.features.forEach(function (f) {
      var nom = norm(f.properties.nombre);
      if (nom.length > 3 && q.indexOf(nom) >= 0 && (!mejor || nom.length > norm(mejor.properties.nombre).length)) mejor = f;
    });
    return mejor;
  }
  function detectarMetrica(q) { return METRICAS.filter(function (m) { return tiene(q, m.claves); })[0] || null; }
  function detectarCategoria(q) {
    return Object.keys(CATEGORIAS).filter(function (k) { return tiene(q, CATEGORIAS[k]); })[0] || null;
  }

  // ---------- Respuestas calculadas ----------
  function resumenComuna(c) {
    var eq = c.equipamientos || {};
    return {
      texto: "**" + c.nombre + "** (límite OSM, no oficial)\n" +
        "- " + n(c.personas) + " personas en " + n(c.manzanas) + " manzanas\n" +
        "- Sin alcantarillado: " + n(c.pct_sin_alcantarillado, 1) + "% · sin acueducto: " + n(c.pct_sin_acueducto, 1) + "% · sin internet: " + n(c.pct_sin_internet, 1) + "%\n" +
        "- Personas a más de 1 km de salud: " + n(c.pct_personas_lejos_salud, 1) + "% · de educación: " + n(c.pct_personas_lejos_educacion, 1) + "% · de seguridad: " + n(c.pct_personas_lejos_seguridad, 1) + "%\n" +
        "- Equipamientos OSM: " + n(eq.salud || 0) + " de salud, " + n(eq.educacion || 0) + " educativos, " + n(eq.seguridad || 0) + " de seguridad, " + n(eq.recreacion || 0) + " recreativos",
      fuente: "Censo DANE 2018 · OpenStreetMap",
      accion: function () { G.irComuna(c.comuna_id); }
    };
  }

  function resumenBarrio(f, metrica) {
    var nombre = f.properties.nombre;
    var ms = G.datos.manzanas.features.filter(function (m) { return m.properties.barrio === nombre; }).map(function (m) { return m.properties; });
    if (!ms.length) return { texto: "Encontré el barrio **" + nombre + "**, pero ninguna manzana tiene ese barrio como referencia más cercana.", accion: function () { G.irPunto(f.geometry.coordinates, nombre); } };
    var personas = 0, viv = 0, sinAlc = 0, sinAcu = 0, sinInt = 0, dist = [];
    ms.forEach(function (p) {
      personas += p.personas || 0; var v = p.viviendas || 0; viv += v;
      sinAlc += (p.pct_sin_alcantarillado || 0) * v; sinAcu += (p.pct_sin_acueducto || 0) * v; sinInt += (p.pct_sin_internet || 0) * v;
      if (p.dist_salud_m != null) dist.push(p.dist_salud_m);
    });
    dist.sort(function (a, b) { return a - b; });
    var texto = "**Alrededores de " + nombre + "** (" + n(ms.length) + " manzanas cuya referencia OSM más cercana es este barrio)\n" +
      "- " + n(personas) + " personas, " + n(viv) + " viviendas\n" +
      "- Sin alcantarillado: " + n(viv ? sinAlc / viv : null, 1) + "% · sin acueducto: " + n(viv ? sinAcu / viv : null, 1) + "% · sin internet: " + n(viv ? sinInt / viv : null, 1) + "%\n" +
      "- Distancia mediana a salud: " + n(dist[Math.floor(dist.length / 2)]) + " m en línea recta";
    if (metrica && metrica.campo === "personas") texto += "\n\nLa agrupación es aproximada: OSM solo trae el barrio como un punto.";
    return { texto: texto, fuente: "Censo DANE 2018 · OpenStreetMap", accion: function () { G.irPunto(f.geometry.coordinates, nombre); } };
  }

  function ranking(m, q) {
    // "más/menos" se refiere a lo que la persona nombra: "menos internet" pide la comuna con más
    // viviendas sin internet; "más viviendas sin alcantarillado" pide la mayor carencia.
    var menos = tiene(q, ["menos", "menor", "minimo"]), mejor = tiene(q, ["mejor"]), peor = tiene(q, ["peor"]);
    var negativa = tiene(q, ["sin", "lejos", "falta", "carece", "no tiene"]);
    var asc;
    if (m.campo === "personas") asc = menos;
    else if (negativa) asc = menos || mejor;
    else asc = !(menos || peor) && (tiene(q, ["mas", "mayor"]) || mejor);
    var orden = comunas().sort(function (a, b) { return asc ? a[m.campo] - b[m.campo] : b[m.campo] - a[m.campo]; });
    var primera = orden[0];
    return {
      texto: "La comuna con " + (asc ? "menor" : "mayor") + " proporción de **" + m.texto + "** es **" + primera.nombre + "** (" + valor(primera[m.campo], m) + ").\n\n" +
        orden.map(function (c, i) { return (i + 1) + ". " + c.nombre + ": " + valor(c[m.campo], m); }).join("\n") +
        "\n\nPromedio de la cabecera: " + valor(G.datos.resumen.resumen.municipio[m.campo], m) + ".",
      fuente: "Censo DANE 2018 · comunas OSM",
      accion: function () { G.fijarLente(m.campo); G.irComuna(primera.comuna_id); }
    };
  }

  function equipamientos(cat, c) {
    var fs = G.datos.equipamientos.features.filter(function (f) { return f.properties.categoria === cat && (!c || f.properties.comuna_id === c.comuna_id); });
    var nombres = fs.map(function (f) { return f.properties.nombre; }).filter(Boolean).slice(0, 8);
    return {
      texto: "Hay **" + n(fs.length) + " equipamientos de " + G.CATEGORIAS[cat].toLowerCase() + "** registrados en OpenStreetMap" + (c ? " en la " + c.nombre : " en la cabecera") + "." +
        (nombres.length ? "\n\nAlgunos: " + nombres.join(", ") + "." : "") +
        "\n\nOSM es colaborativo: puede faltar algún equipamiento o haber registros desactualizados.",
      fuente: "OpenStreetMap",
      accion: c ? function () { G.irComuna(c.comuna_id); } : null
    };
  }

  function obras(q) {
    var fs = G.datos.obras.features, metas = {};
    fs.forEach(function (f) { (f.properties.pdm || []).forEach(function (m) { metas[m.indicador] = (metas[m.indicador] || 0) + 1; }); });
    var cob = G.datos.resumen.instagram.cobertura;
    if (tiene(q, ["pdm", "meta", "plan de desarrollo"])) {
      return {
        texto: "Las obras comunicadas se vinculan a **" + Object.keys(metas).length + " metas del PDM**:\n" +
          Object.keys(metas).map(function (k) { return "- " + k + " (" + metas[k] + (metas[k] === 1 ? " obra" : " obras") + ")"; }).join("\n") +
          "\n\nNo hay avance documentado, así que el visor no calcula brechas.",
        fuente: "Instagram Alcaldía · PDM", accion: function () { G.pestana("obras"); }
      };
    }
    return {
      texto: "Entre el " + cob.coverage_window.start + " y el " + cob.coverage_window.end + " la Alcaldía publicó **" + n(cob.posts.total) + " publicaciones**; **" + fs.length + " obras** quedaron ubicadas en el mapa:\n" +
        fs.slice(0, 10).map(function (f) { return "- " + f.properties.nombre; }).join("\n") +
        (fs.length > 10 ? "\n- … y " + (fs.length - 10) + " más" : "") +
        "\n\nSon comunicaciones oficiales, no verificaciones independientes.",
      fuente: "Instagram Alcaldía", accion: function () { G.pestana("obras"); }
    };
  }

  function secop(q) {
    var r = G.datos.resumen.secop, m = q.match(/20(1[6-9]|2[0-6])/);
    if (m) {
      var a = r.por_anio.filter(function (x) { return x.anio === m[0]; })[0];
      if (!a) return { texto: "No hay proyectos de obra de SECOP con firma en " + m[0] + " en el inventario capturado." };
      var sect = Object.keys(a.sectores).sort(function (x, y) { return a.sectores[y] - a.sectores[x]; });
      return {
        texto: "En **" + a.anio + "** hay **" + n(a.proyectos) + " proyectos candidatos de obra** por unos **$" + n(a.valor / 1e9, 1) + " mil millones**.\n\nSectores: " +
          sect.map(function (s) { return (G.SECTORES[s] || s) + " (" + a.sectores[s] + ")"; }).join(", ") + ".",
        fuente: "SECOP I y II · clasificación automática pendiente de revisión",
        accion: function () { G.anioSecop(a.anio); }
      };
    }
    var mayor = r.por_anio.slice().sort(function (x, y) { return y.proyectos - x.proyectos; })[0];
    return {
      texto: "El inventario tiene **" + n(r.contratos) + " contratos** capturados y **" + n(r.proyectos) + " proyectos candidatos de obra** (cobertura parcial). El año con más proyectos es **" + mayor.anio + "** (" + n(mayor.proyectos) + ").\n\nPregúntame por un año, por ejemplo «SECOP en 2025».",
      fuente: "SECOP I y II", accion: function () { G.pestana("secop"); }
    };
  }

  function responderLocal(pregunta) {
    var q = norm(pregunta);
    var c = detectarComuna(q), b = detectarBarrio(q), m = detectarMetrica(q), cat = detectarCategoria(q);

    if (tiene(q, ["rio", "sinu", "humedal", "cienaga", "ambient", "ecosistema", "verde", "bosque", "caño", "cano"])) {
      return { texto: "Activé el lente **Ambiente**: aplana las manzanas y resalta el río Sinú, los cuerpos de agua, los humedales y las coberturas verdes.\n\nEsas coberturas vienen de OpenStreetMap y **no son los límites oficiales** de la estructura ecológica del POT. Haz clic sobre una cobertura para ver su nombre.", fuente: "OpenStreetMap", accion: function () { G.fijarLente(null); } };
    }
    if (tiene(q, ["prioridad", "priorizar", "necesidad", "invertir", "inversion", "focalizar", "vulnerab"])) {
      var r = G.necesidad();
      return {
        texto: "Activé el **índice de necesidad** con los pesos actuales (servicios, distancia a equipamientos y estrato). Comunas con mayor índice, ponderado por población:\n" +
          r.comunas.slice(0, 3).map(function (c, i) { return (i + 1) + ". " + c.nombre + ": " + n(c.indice, 1) + " puntos (" + n(c.alta) + " personas en manzanas de prioridad alta)"; }).join("\n") +
          "\n\nEn total hay **" + n(r.alta) + " manzanas de prioridad alta** con " + n(r.personasAlta) + " personas. En la pestaña Territorio puede ajustar los pesos y descargar el ranking.",
        fuente: "Censo DANE 2018 · OpenStreetMap · índice relativo, no oficial",
        accion: function () { G.abrirNecesidad(); }
      };
    }
    if (tiene(q, ["secop", "contrat", "licitacion"])) return secop(q);
    if (tiene(q, ["obra", "pdm", "plan de desarrollo", "instagram", "alcaldia comunic"])) return obras(q);
    if (cat && tiene(q, ["cuant", "donde", "lista", "cuales", "hay"])) return equipamientos(cat, c);
    if (m && !c && !b && tiene(q, ["mas", "mayor", "menos", "menor", "peor", "mejor", "ranking", "cual", "que comuna", "donde"])) return ranking(m, q);
    if (c) return resumenComuna(c);
    if (b) return resumenBarrio(b, m);
    if (tiene(q, ["fuente", "dato", "de donde", "confiable", "oficial"])) {
      return { texto: "Uso: **Censo DANE 2018** por manzana; **OpenStreetMap** para comunas, barrios, equipamientos y coberturas ambientales (no oficiales); **Instagram de la Alcaldía** para obras comunicadas, y **SECOP I y II** para la contratación. Las distancias son en línea recta.", fuente: "Fuentes del visor", accion: function () { G.fuentes(); } };
    }
    if (m || tiene(q, ["monteria", "ciudad", "general", "resumen"])) {
      var mu = G.datos.resumen.resumen.municipio;
      return { texto: "**Cabecera de Montería**\n- " + n(mu.personas) + " personas, " + n(mu.hogares) + " hogares, " + n(mu.manzanas) + " manzanas\n- Sin alcantarillado: " + n(mu.pct_sin_alcantarillado, 1) + "% · sin acueducto: " + n(mu.pct_sin_acueducto, 1) + "% · sin internet: " + n(mu.pct_sin_internet, 1) + "%\n- A más de 1 km de salud: " + n(mu.pct_personas_lejos_salud, 1) + "% de las personas", fuente: "Censo DANE 2018", accion: function () { G.inicio(); } };
    }
    return null;
  }

  // ---------- Contexto para Claude ----------
  function contexto() {
    var r = G.datos.resumen;
    return {
      municipio: r.resumen.municipio,
      comunas: r.resumen.comunas,
      umbral_distancia_m: r.resumen.umbral_distancia_m,
      obras: G.datos.obras.features.map(function (f) { return { nombre: f.properties.nombre, tipo: f.properties.tipo, estado: f.properties.estado, pdm: f.properties.pdm }; }),
      instagram: { ventana: r.instagram.cobertura.coverage_window, publicaciones: r.instagram.cobertura.posts.total },
      secop: { contratos: r.secop.contratos, proyectos: r.secop.proyectos, cobertura: r.secop.cobertura, por_anio: r.secop.por_anio },
      fuentes: Object.keys(r.manifest).map(function (k) { return r.manifest[k].nombre; }),
      vista: G.vista()
    };
  }
  function preguntarIA(pregunta, local) {
    return fetch(CONFIG.chatUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pregunta: pregunta, historial: historial.slice(-8), contexto: contexto(), calculo_local: local ? local.texto : null })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // ---------- Interfaz ----------
  function formato(t) {
    var h = G.escapar(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    var lineas = h.split("\n"), out = [], lista = null;
    lineas.forEach(function (l) {
      var item = l.match(/^(?:- |\d+\. )(.*)$/);
      if (item) { if (!lista) { lista = []; } lista.push("<li>" + item[1] + "</li>"); return; }
      if (lista) { out.push("<ul>" + lista.join("") + "</ul>"); lista = null; }
      if (l.trim()) out.push("<p>" + l + "</p>");
    });
    if (lista) out.push("<ul>" + lista.join("") + "</ul>");
    return out.join("");
  }
  function burbuja(rol, html, extra) {
    var cont = document.getElementById("chat-mensajes");
    var b = document.createElement("div");
    b.className = "msg msg-" + rol;
    b.innerHTML = html + (extra || "");
    cont.appendChild(b);
    cont.scrollTop = cont.scrollHeight;
    return b;
  }
  function pie(r, ia) {
    return "<div class=\"msg-pie\">" + (ia ? "Respuesta generada con IA (Claude) a partir de los datos del visor · " : "") +
      (r && r.fuente ? G.escapar(r.fuente) : "Datos del visor") + "</div>";
  }

  function enviar(texto) {
    texto = (texto || "").trim();
    if (!texto) return;
    var entrada = document.getElementById("chat-entrada");
    entrada.value = "";
    burbuja("usuario", "<p>" + G.escapar(texto) + "</p>");
    var local = responderLocal(texto);
    if (local && local.accion) local.accion();

    if (CONFIG.chatUrl) {
      var espera = burbuja("asistente", "<p class=\"escribiendo\"><span></span><span></span><span></span></p>");
      preguntarIA(texto, local).then(function (r) {
        espera.innerHTML = formato(r.respuesta || "") + pie(local, true);
        historial.push({ rol: "usuario", texto: texto }, { rol: "asistente", texto: r.respuesta || "" });
      }).catch(function () {
        espera.innerHTML = local ? formato(local.texto) + pie(local) : formato(ayuda());
      });
      return;
    }
    burbuja("asistente", local ? formato(local.texto) + pie(local) : formato(ayuda()));
    historial.push({ rol: "usuario", texto: texto }, { rol: "asistente", texto: local ? local.texto : "" });
  }
  function ayuda() {
    return "No encontré esa respuesta en los datos del visor. Puedo responder sobre **comunas**, **barrios**, **servicios** (acueducto, alcantarillado, internet, basuras), **distancia a salud, educación y seguridad**, **equipamientos**, **obras y metas del PDM**, **SECOP** y **ambiente**. Prueba con una de las sugerencias.";
  }

  function montar() {
    var v = document.getElementById("vista-asistente");
    v.innerHTML =
      "<div class=\"chat\">" +
      "<div id=\"chat-mensajes\" class=\"chat-mensajes\" aria-live=\"polite\"></div>" +
      "<div class=\"chat-sugerencias\" id=\"chat-sugerencias\"></div>" +
      "<form class=\"chat-form\" id=\"chat-form\">" +
      "<label class=\"sr\" for=\"chat-entrada\">Pregunta</label>" +
      "<input id=\"chat-entrada\" autocomplete=\"off\" placeholder=\"Pregúntale al mapa…\">" +
      "<button type=\"submit\" aria-label=\"Enviar\"><svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M4 12l16-8-6 16-2-7z\"/></svg></button>" +
      "</form></div>";
    burbuja("asistente", formato("Hola, soy el asistente del Geovisor. Pregúntame por una comuna, un barrio, los servicios, las obras, SECOP o el ambiente, y te llevo al lugar en el mapa.") +
      "<div class=\"msg-pie\">" + (CONFIG.chatUrl ? "Modo IA activo (Claude) · responde solo con los datos del visor" : "Responde con los datos cargados en el visor") + "</div>");
    var s = document.getElementById("chat-sugerencias");
    SUGERENCIAS.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "false"); b.textContent = t;
      b.addEventListener("click", function () { enviar(t); });
      s.appendChild(b);
    });
    document.getElementById("chat-form").addEventListener("submit", function (e) { e.preventDefault(); enviar(document.getElementById("chat-entrada").value); });
  }

  window.GeovisorChat = {
    iniciar: function (api) { G = api; montar(); },
    responderLocal: function (q) { return responderLocal(q); }
  };
})();
