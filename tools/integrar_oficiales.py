"""Integra al visor las fuentes oficiales bajadas con tools/datos_abiertos.py.

Uso (desde la raíz, después de `datos_abiertos.py descargar`, `cvs`, `pot` y `vias`):
    python3 tools/integrar_oficiales.py
    python3 tools/integrar_oficiales.py vias   # solo vías y conexiones; actualiza el manifiesto existente

Lee fuentes_abiertas/ (crudo, fuera del repositorio) y escribe:
    data/oficial_sedes_educativas.geojson  sedes MinEducación que no aparecen en OSM
    data/oficial_ambiente.geojson          humedales con PMA y áreas protegidas RUNAP de la CVS
    data/corregimientos.geojson            límite municipal y centros poblados del POT por corregimiento
    data/vias_nacionales.geojson           red vial nacional (INVÍAS), concesiones y peajes alrededor de Montería
    data/conexiones.json                   corredores nacionales, destinos de la terminal y del aeropuerto
    data/fuentes_oficiales.json            procedencia, licencias y resultado del cruce

Nombres para los equipamientos OSM sin nombre: solo se asignan si una fuente oficial de la misma
categoría tiene un punto a menos de UMBRAL_M y sus coordenadas son lo bastante precisas para
distinguir un predio de otro. Las coincidencias dudosas no se integran.
"""

import difflib
import json
import math
import re
import sys
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CRUDO = RAIZ / "fuentes_abiertas"
DATA = RAIZ / "data"

UMBRAL_M = 75            # distancia máxima para dar por buena una coincidencia de nombre por cercanía
RADIO_NOMBRE_M = 1500    # búsqueda de la misma sede en OSM por nombre (cubre el redondeo de MinEducación)
# Cabecera y zona rural de Montería; descarta coordenadas en 0,0 o de otro municipio
LIMITES = (-76.35, 8.30, -75.55, 9.05)

GENERICAS = set("""
institucion educativa inst educ ie i e colegio escuela esc urbana urbano urb mixta mixto mix mx rural rur r sede
centro educativo ce de del la las los el y principal jardin infantil gimnasio gim liceo santa santo san nuestra senora
""".split())


def distancia_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    dx = (a[0] - b[0]) * 111320 * math.cos(lat)
    dy = (a[1] - b[1]) * 110540
    return math.hypot(dx, dy)


def fichas(nombre):
    t = unicodedata.normalize("NFD", nombre or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    return [w for w in t.split() if w not in GENERICAS and len(w) > 1]


def mismo_nombre(a, b):
    fa, fb = fichas(a), fichas(b)
    if not fa or not fb:
        return False
    iguales = sum(1 for x in fa if any(difflib.SequenceMatcher(None, x, y).ratio() >= 0.85 for y in fb))
    menor = min(len(fa), len(fb))
    # Todas las palabras distintivas del nombre más corto aparecen en el otro; con una sola palabra
    # distintiva («Esperanza», «Montería») se exige que ambos nombres se reduzcan a esa palabra
    return iguales == menor and (menor >= 2 or len(fa) == len(fb) == 1)


def precision_m(valores):
    """Error máximo por redondeo según los decimales publicados (medio paso de la cuadrícula)."""
    decimales = min(len(v.split(".")[1]) if "." in v else 0 for v in valores)
    return 0.5 * 10 ** -decimales * 111320 * math.sqrt(2), decimales


def leer(nombre):
    return json.loads((CRUDO / nombre).read_text(encoding="utf-8"))


def fecha(ts):
    if not ts:
        return None
    ts = ts / 1000 if ts > 1e11 else ts
    return datetime.fromtimestamp(ts, timezone.utc).date().isoformat()


# El POT escribe el mismo corregimiento como «GARZONES» y «LOS GARZONES»
UNIFICAR_CORREGIMIENTO = {"GARZONES": "LOS GARZONES"}
MINUSCULAS = {"de", "del", "la", "las", "los", "el", "y"}


def titulo(t):
    return " ".join(w.lower() if i and w.lower() in MINUSCULAS else w.capitalize() for i, w in enumerate(t.split()))


def centroide(geom):
    """Centroide por área del anillo exterior más grande (los centros poblados son polígonos simples)."""
    anillos = [p[0] for p in geom["coordinates"]] if geom["type"] == "MultiPolygon" else [geom["coordinates"][0]]
    def area_y_centro(r):
        a = cx = cy = 0.0
        for (x0, y0), (x1, y1) in zip(r, r[1:]):
            k = x0 * y1 - x1 * y0
            a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k
        return a / 2, (cx / (3 * a), cy / (3 * a)) if a else r[0]
    a, c = max((area_y_centro(r) for r in anillos), key=lambda t: abs(t[0]))
    return [round(c[0], 5), round(c[1], 5)]


def corregimientos(hoy):
    centros = leer("pot_centros_poblados.geojson")
    limite = leer("pot_limite_municipal.geojson")
    lim = limite["features"][0]
    feats = [{"type": "Feature", "geometry": lim["geometry"], "properties": {
        "capa": "limite", "nombre": lim["properties"]["MpNombre"], "norma": lim["properties"]["MpNorma"]}}]
    grupos = {}
    for f in centros["features"]:
        a = f["properties"]
        clave = UNIFICAR_CORREGIMIENTO.get(a["CORREGIMIE"].strip(), a["CORREGIMIE"].strip())
        nombre = a["NOMBRE"].strip()
        cabecera = nombre.startswith("Cgto ")
        p = {"capa": "centro", "nombre": re.sub(r"^(Cgto|Caserio) ", "", nombre),
             "tipo": "Cabecera de corregimiento" if cabecera else "Caserío", "jerarquia": a["Jerarquia"],
             "hectareas": a["hectareas"], "corregimiento": titulo(clave)}
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": p})
        grupos.setdefault(clave, []).append((p, centroide(f["geometry"])))
    for clave, ms in sorted(grupos.items()):
        orden = {"Principal": 0, "Intermedio": 1, "Secundario": 2}
        ms.sort(key=lambda m: (m[0]["tipo"] != "Cabecera de corregimiento", orden.get(m[0]["jerarquia"], 3), m[0]["nombre"]))
        # «CERRITO» se muestra como su cabecera, «El Cerrito»; «TRES PALMAS» no pasa a «3 Palmas»
        cab = ms[0][0]["nombre"] if ms[0][0]["tipo"] == "Cabecera de corregimiento" else ""
        nombre = cab if cab and not cab[0].isdigit() and fichas(cab)[-1:] == fichas(clave)[-1:] and len(cab) > len(clave) else titulo(clave)
        for m in ms:
            m[0]["corregimiento"] = nombre
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": ms[0][1]}, "properties": {
            "capa": "corregimiento", "nombre": nombre,
            "centros": [{"nombre": m[0]["nombre"], "tipo": m[0]["tipo"], "jerarquia": m[0]["jerarquia"],
                         "hectareas": m[0]["hectareas"], "punto": m[1]} for m in ms]}})
    fuente = {"id": "2536664f628c4b42b3422f894b053252",
              "nombre": "POT de Montería · Delimitación de centros poblados y límite municipal",
              "entidad": "Alcaldía de Montería (POT, Acuerdo 003 de 2021), publicado en ArcGIS Online por el proyecto APPA Córdoba",
              "licencia": "Sin licencia declarada; se cita a la Alcaldía como autora. El límite municipal advierte que no sirve "
                          "para ubicar puntos exactos ni calcular áreas",
              "actualizado": fecha(centros["fuente"].get("editado")), "descargado": hoy,
              "url": "https://www.arcgis.com/home/item.html?id=2536664f628c4b42b3422f894b053252",
              "uso": f"{len(grupos)} corregimientos y {len(centros['features'])} centros poblados (cabeceras y caseríos). "
                     "No hay límites oficiales de cada corregimiento publicados: se muestran sus centros poblados"}
    return {"type": "FeatureCollection", "features": feats}, fuente, len(grupos), len(centros["features"])


# ---------- Vías nacionales y conexiones ----------
# Lo que alcanza a verse en el visor (límite del municipio con el margen de maxBounds en app.js)
REGION_VISOR = (-76.65, 7.95, -75.25, 9.3)
DOMINIOS_INVIAS = {
    "administrador": {"1": "INVÍAS", "2": "ANI", "3": "Concesión departamental", "4": "FINDETER", "5": "Vía en desuso", "6": "INVÍAS (convenio)"},
    "categoria": {"1": "Primer orden", "2": "Segundo orden", "3": "Tercer orden"},
    "superficie": {"1": "Pavimentada", "2": "Sin pavimentar"},
    "calzada": {"1": "Sencilla", "2": "Doble"},
}
# Tramos oficiales encadenados desde Montería. Las longitudes salen de los postes de referencia (PR) de
# INVÍAS: en doble calzada la geometría trae las dos calzadas y su longitud se duplica. El hito es el
# lugar al final del tramo, tomado del nombre del sector. Ningún corredor incluye el recorrido urbano.
CORREDORES = [
    ("Ruta 21 · Cereté y Lorica", [("2103", "Montería - Cereté", "Cereté"), ("2103", "Paso Nacional por Cereté", None),
                                   ("2103", "Cereté - Lorica", "Lorica")]),
    ("Ruta 74 · Cereté y la Troncal de Occidente", [("2103", "Montería - Cereté", "Cereté"),
                                                    ("7402", "Cereté - Cruce Ruta 25 (La Ye)", "Cruce con la Troncal de Occidente (La Ye)")]),
    ("Ruta 23 · Planeta Rica", [("2310", "Planeta Rica - Montería", "Planeta Rica")]),
    ("Ruta 74 · Puerto Rey y Arboletes", [("7401", "Puerto Rey - Monteria", "Puerto Rey"), ("9002", "Arboletes – Puerto Rey", "Arboletes")]),
]
EMPALME_M = 1000  # distancia máxima entre tramos consecutivos de un corredor


def en_region(p):
    return REGION_VISOR[0] <= p[0] <= REGION_VISOR[2] and REGION_VISOR[1] <= p[1] <= REGION_VISOR[3]


def simplificar(linea, tol=0.00008):
    """Douglas-Peucker (~9 m): suficiente para la escala regional y reduce el archivo."""
    if len(linea) < 3:
        return linea
    (x0, y0), (x1, y1) = linea[0], linea[-1]
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy) or 1e-12
    i, dmax = 0, -1
    for k in range(1, len(linea) - 1):
        d = abs(dy * linea[k][0] - dx * linea[k][1] + x1 * y0 - y1 * x0) / n
        if d > dmax:
            i, dmax = k, d
    if dmax <= tol:
        return [linea[0], linea[-1]]
    return simplificar(linea[:i + 1], tol)[:-1] + simplificar(linea[i:], tol)


def pr(p, cual):
    return float(p.get(f"poste_de_referencia_{cual}") or 0) * 1000 + float(p.get(f"distancia_{cual}") or 0)


def texto_pr(m):
    return f"PR{int(m // 1000)}+{int(round(m % 1000)):03d}"


def km_pr(p):
    return round((pr(p, "final") - pr(p, "inicial")) / 1000, 1)


def sector_legible(s):
    s = (s or "").strip()
    return titulo(s.lower()) if s.isupper() else s


def municipio(m):
    nombre = titulo(m["nom_mpio"].lower()).replace("D.c.", "D.C.")
    return {"divipola": m["cod_mpio"], "nombre": nombre, "departamento": titulo(m["dpto"].lower()).replace("D.c.", "D.C.")}


def vias(hoy):
    red = leer("invias_red_vial.geojson")
    peajes = leer("invias_peajes.json")
    concesiones = leer("ani_concesiones_carreteras.geojson")
    aeropuertos = leer("ani_concesiones_aeroportuarias.geojson")
    divipola = {m["cod_mpio"]: m for m in leer("dane_divipola_municipios.json")["filas"]}
    terminal = leer("supertransporte_terminal_monteria.json")
    aereo = leer("aerocivil_origen_destino_monteria.json")

    # 1. Tramos de la red nacional que se ven en el visor (el conjunto repite 100 tramos idénticos)
    feats, vistos, por_clave = [], set(), {}
    for f in red["features"]:
        p, g = f["properties"], f["geometry"]
        if not g:
            continue
        clave = (p.get("codigo_tramo"), p.get("sector"), pr(p, "inicial"), pr(p, "final"), json.dumps(g["coordinates"][0][:2]))
        if clave in vistos:
            continue
        vistos.add(clave)
        por_clave.setdefault((p.get("codigo_tramo"), (p.get("sector") or "").strip()), []).append(f)
        # El visor no reproduce geometrías que la propia fuente declara tomadas de Google Maps (sus términos lo prohíben)
        if not any(en_region(q) for linea in g["coordinates"] for q in linea) or p.get("fuente") == "Google Maps":
            continue
        lineas = [[[round(x, 5), round(y, 5)] for x, y in simplificar(linea)] for linea in g["coordinates"] if len(linea) > 1]
        props = {"capa": "tramo", "codigo": p.get("codigo_tramo"), "ruta": (p.get("ruta") or "").strip() or None,
                 "nombre_ruta": p.get("nombre_ruta"), "sector": sector_legible(p.get("sector")), "km": km_pr(p),
                 "pr": f"{texto_pr(pr(p, 'inicial'))} a {texto_pr(pr(p, 'final'))}"}
        # «Por Defnir» es una errata de la fuente para «por definir»: se trata como vacío
        if p.get("fuente") and not p["fuente"].lower().startswith("por def"):
            props["fuente_geometria"] = p["fuente"]
        for campo, dominio in DOMINIOS_INVIAS.items():
            # «Por definir» y los vacíos se omiten: el visor no rellena atributos que la fuente no trae
            if dominio.get(p.get(campo)):
                props[campo] = dominio[p[campo]]
        feats.append({"type": "Feature", "geometry": {"type": "MultiLineString", "coordinates": lineas}, "properties": props})
    n_tramos = len(feats)

    for f in concesiones["features"]:
        a = f["properties"]
        g = f["geometry"]
        lineas = [g["coordinates"]] if g["type"] == "LineString" else g["coordinates"]
        feats.append({"type": "Feature", "geometry": {"type": "MultiLineString", "coordinates": [
            [[round(x, 5), round(y, 5)] for x, y in simplificar(l, 0.0002)] for l in lineas]}, "properties": {
            "capa": "concesion", "nombre": a["NOMBRE"].strip().rstrip("."), "generacion": a.get("GEN"),
            "ola": a.get("OLA_4G") if a.get("OLA_4G") not in (None, "No aplica") else None, "estado": a.get("ESTADO")}})

    n_peajes = 0
    for r in peajes["filas"]:
        punto = (r.get("point") or {}).get("coordinates")
        # Las columnas latitud/longitud traen errores (latitud repetida); se usa la geometría publicada
        if not punto or not en_region(punto):
            continue
        n_peajes += 1
        nombre = r["nombre_peaje"].strip()
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(punto[0], 5), round(punto[1], 5)]}, "properties": {
            "capa": "peaje", "nombre": titulo(nombre.lower()) if nombre.isupper() else nombre, "sector": r.get("sector"),
            "responsable": r.get("responsable"), "codigo": r.get("c_digo_tramo"),
            "administrador": DOMINIOS_INVIAS["administrador"].get(r.get("administrador")),
            "tarifa_i": int(float(r["categoria_i"])) if r.get("categoria_i") else None}})

    garzones = next(f for f in aeropuertos["features"] if "Montería" in f["properties"]["LISTA_AERO"])
    a = garzones["properties"]
    x, y = garzones["geometry"]["coordinates"][0]
    feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(x, 5), round(y, 5)]}, "properties": {
        "capa": "aeropuerto", "nombre": a["LISTA_AERO"], "proyecto": a.get("PROYECTO"), "contrato": a.get("CONTRATO"),
        "concesionario": re.sub(r"\s*\n\s*", " · ", a.get("CCNARIO") or "").strip() or None}})

    # 2. Corredores: tramos oficiales encadenados, con verificación de que se toquen
    corredores = []
    for nombre, pasos in CORREDORES:
        tramos, hitos, total, previo = [], [], 0.0, None
        for codigo, sector, hito in pasos:
            fs = por_clave.get((codigo, sector))
            if not fs:
                raise SystemExit(f"Corredor «{nombre}»: no está el tramo {codigo} «{sector}» en la red de INVÍAS")
            p = fs[0]["properties"]
            puntos = [q for f in fs for linea in f["geometry"]["coordinates"] for q in (linea[0], linea[-1])]
            if previo and min(distancia_m(a, b) for a in previo for b in puntos) > EMPALME_M:
                raise SystemExit(f"Corredor «{nombre}»: el tramo {codigo} «{sector}» no empalma con el anterior")
            previo = puntos
            km = km_pr(p)
            total += km
            tramos.append({"codigo": codigo, "sector": sector, "km": km,
                           "administrador": DOMINIOS_INVIAS["administrador"].get(p.get("administrador"))})
            if hito:
                hitos.append({"lugar": hito, "km": round(total, 1)})
        corredores.append({"nombre": nombre, "tramos": tramos, "hitos": hitos})
    km_hito = {" ".join(fichas(h["lugar"])): h["km"] for c in corredores for h in c["hitos"]}

    # 3. Destinos desde la terminal y el aeropuerto en el último año completo
    destinos = []
    for r in terminal["filas"]:
        m = divipola.get(r["municipio_destino_ruta"])
        if not m:
            continue
        d = {**municipio(m), "despachos": int(r["despachos"]), "pasajeros": int(r["pasajeros"])}
        if " ".join(fichas(d["nombre"])) in km_hito:
            d["km_red_nacional"] = km_hito[" ".join(fichas(d["nombre"]))]
        destinos.append(d)
    nacionales, internacionales = {}, {"pasajeros": 0, "destinos": 0}
    for r in aereo["filas"]:
        pas = int(float(r["pasajeros"]))
        if r["pais_destino"] != "COLOMBIA":
            internacionales["pasajeros"] += pas
            internacionales["destinos"] += 1
            continue
        d = nacionales.setdefault(r["destino"], {"codigo": r["destino"], "ciudad": titulo(r["ciudad_destino"].lower()).replace("D.c.", "D.C."), "pasajeros": 0})
        d["pasajeros"] += pas
    conexiones = {
        "generado": hoy,
        "corredores": corredores,
        "terminal": {"nombre": "Terminal de Transporte de Montería", "anio": terminal["anio"],
                     "despachos": sum(d["despachos"] for d in destinos), "pasajeros": sum(d["pasajeros"] for d in destinos),
                     "destinos": destinos},
        "aereo": {"nombre": a["LISTA_AERO"], "anio": aereo["anio"],
                  "pasajeros": sum(d["pasajeros"] for d in nacionales.values()) + internacionales["pasajeros"],
                  "nacionales": sorted(nacionales.values(), key=lambda d: -d["pasajeros"]), "internacionales": internacionales},
    }

    (DATA / "vias_nacionales.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "conexiones.json").write_text(json.dumps(conexiones, ensure_ascii=False, indent=1), encoding="utf-8")

    cc_by_sa = "CC BY-SA 4.0"
    ani_uso = concesiones["fuente"].get("licencia") or "Sin condiciones de uso declaradas"
    fuentes = [
        {"id": "ie7y-asdn", "nombre": "INVÍAS · Red vial nacional", "entidad": red["fuente"]["entidad"], "licencia": cc_by_sa,
         "actualizado": fecha(red["fuente"].get("actualizado")), "descargado": hoy, "url": "https://www.datos.gov.co/d/ie7y-asdn",
         "uso": f"{n_tramos} tramos alrededor de Montería. Longitudes según los postes de referencia (PR): en doble calzada la "
                "geometría incluye las dos calzadas y su longitud se duplica. Atributos «por definir» en la fuente no se muestran"},
        {"id": "68qj-5xux", "nombre": "INVÍAS · Peajes de la red vial nacional", "entidad": peajes["entidad"], "licencia": cc_by_sa,
         "actualizado": fecha(peajes.get("actualizado")), "descargado": hoy, "url": "https://www.datos.gov.co/d/68qj-5xux",
         "uso": f"{n_peajes} peajes alrededor de Montería con su tarifa de categoría I"},
        {"id": concesiones["fuente"]["item"], "nombre": "ANI · Concesiones carreteras y aeroportuarias",
         "entidad": concesiones["fuente"].get("credito") or "Agencia Nacional de Infraestructura", "licencia": ani_uso,
         "actualizado": fecha(concesiones["fuente"].get("editado")), "descargado": hoy,
         "url": f"https://www.arcgis.com/home/item.html?id={concesiones['fuente']['item']}",
         "uso": f"{len(concesiones['features'])} concesiones viales en la región con su estado, y la concesión del aeropuerto Los Garzones"},
        {"id": "eh75-8ah6", "nombre": "SuperTransporte · Despachos de pasajeros por carretera desde las terminales",
         "entidad": terminal["entidad"], "licencia": cc_by_sa, "actualizado": fecha(terminal.get("actualizado")), "descargado": hoy,
         "url": "https://www.datos.gov.co/d/eh75-8ah6",
         "uso": f"Destinos servidos desde la terminal de Montería en {terminal['anio']} ({len(destinos)} municipios)"},
        {"id": "gb6w-ynu4", "nombre": "Aerocivil · Tráfico origen-destino de pasajeros", "entidad": aereo["entidad"],
         "licencia": cc_by_sa, "actualizado": fecha(aereo.get("actualizado")), "descargado": hoy, "url": "https://www.datos.gov.co/d/gb6w-ynu4",
         "uso": f"Destinos de los pasajeros que salieron de Los Garzones en {aereo['anio']} (origen-destino, incluye viajes con conexión)"},
        {"id": "gdxc-w37w", "nombre": "DANE · DIVIPOLA, códigos de municipios", "entidad": "Departamento Administrativo Nacional de Estadística",
         "licencia": cc_by_sa, "actualizado": fecha(leer("dane_divipola_municipios.json").get("actualizado")), "descargado": hoy,
         "url": "https://www.datos.gov.co/d/gdxc-w37w", "uso": "Nombres de los municipios de destino de la terminal"},
    ]
    return fuentes, NOTAS_VIAS


NOTAS_VIAS = [
    "INVÍAS · distancias puerta a puerta: la red vial nacional no incluye los recorridos urbanos (el tramo a Cereté empieza "
    "al norte de la ciudad, cerca del aeropuerto), así que el visor solo suma las longitudes oficiales de los tramos",
    "Vía Montería – Tierralta y demás vías hacia el sur del municipio: no hacen parte de la red vial nacional de INVÍAS, y el "
    "inventario SINC de MinTransporte no trae ejes viales de Montería",
    "Peaje San Carlos (Concesión Ruta al Mar): está en el conjunto de peajes, pero su tramo (3306, Montería – San Carlos) "
    "no aparece en la red vial de INVÍAS",
    "POT de Montería · ejes viales, vías primarias, red secundaria y red terciaria propuesta: sin nombres de vía y sin licencia "
    "declarada; no se integran",
    "Terminal de transporte: ninguna fuente oficial abierta publica su ubicación; el visor usa el punto de OpenStreetMap",
    "INVÍAS · Variante Oriental de Sincelejo (25SCA): la fuente declara que su geometría viene de Google Maps; no se reproduce",
]


def main():
    equip = json.loads((DATA / "equipamientos.geojson").read_text(encoding="utf-8"))
    osm = equip["features"]
    sin_nombre = [f for f in osm if not f["properties"].get("nombre")]
    osm_edu = [f for f in osm if f["properties"]["categoria"] == "educacion" and f["properties"].get("nombre")]

    men = leer("sedes_educativas_coordenadas.json")
    reps = leer("reps_sedes_salud.json")
    sedes = []
    for r in men["filas"]:
        x, y = r.get("coordenada_x_sede"), r.get("coordenada_y_sede")
        if not x or not y:
            continue
        p = (float(x), float(y))
        if LIMITES[0] <= p[0] <= LIMITES[2] and LIMITES[1] <= p[1] <= LIMITES[3]:
            sedes.append((r, p))
    error_men, dec_men = precision_m([r["coordenada_x_sede"] for r, _ in sedes] + [r["coordenada_y_sede"] for r, _ in sedes])

    # 1. Nombres para equipamientos OSM sin nombre, por cercanía y categoría
    fuentes_punto = {"educacion": ("MinEducación", sedes, error_men)}
    cruce = {"umbral_m": UMBRAL_M, "sin_nombre": len(sin_nombre), "resueltos": 0, "dudosos": 0, "por_fuente": []}
    for cat, (fuente, puntos, error) in fuentes_punto.items():
        candidatos = [f for f in sin_nombre if f["properties"]["categoria"] == cat]
        resueltos = 0
        for f in candidatos:
            c = f["geometry"]["coordinates"]
            cerca = [r for r, p in puntos if distancia_m(c, p) <= UMBRAL_M]
            # Solo una sede a la distancia del umbral y coordenadas precisas; lo demás queda como dudoso
            if len(cerca) == 1 and error <= UMBRAL_M:
                f["properties"].update(nombre=cerca[0]["nombre_sede"].strip(), nombre_fuente=fuente)
                resueltos += 1
            elif cerca:
                cruce["dudosos"] += 1
        cruce["resueltos"] += resueltos
        cruce["por_fuente"].append({
            "fuente": fuente, "categoria": cat, "candidatos_osm": len(candidatos), "resueltos": resueltos,
            "motivo": f"coordenadas publicadas con {dec_men} decimales: error de hasta {error:,.0f} m, "
                      f"mayor que el umbral de {UMBRAL_M} m; no permite saber a qué predio corresponde" if error > UMBRAL_M else "",
        })
    cruce["por_fuente"].append({
        "fuente": "REPS (MinSalud)", "categoria": "salud",
        "candidatos_osm": sum(1 for f in sin_nombre if f["properties"]["categoria"] == "salud"),
        "resueltos": 0,
        "motivo": f"{len(reps['filas'])} sedes en Montería, solo con dirección: el REPS no publica coordenadas",
    })

    # 2. Sedes oficiales de MinEducación que no aparecen en OSM (comparación por nombre)
    en_osm, faltan = 0, []
    for r, p in sedes:
        nombres = {r["nombre_sede"], r["nombre_establecimiento"]} if r.get("principal") == "S" else {r["nombre_sede"]}
        cerca = [f for f in osm_edu if distancia_m(f["geometry"]["coordinates"], p) <= RADIO_NOMBRE_M]
        if any(mismo_nombre(n, f["properties"]["nombre"]) for n in nombres for f in cerca):
            en_osm += 1
        else:
            faltan.append((r, p))
    celdas = {}
    for r, p in faltan:
        celdas.setdefault(p, []).append(r)
    sedes_geo = {"type": "FeatureCollection", "features": [{
        "type": "Feature", "geometry": {"type": "Point", "coordinates": list(p)},
        "properties": {
            "n": len(rs), "zona": rs[0]["zona"].capitalize(),
            "sedes": [{"sede": r["nombre_sede"].strip(), "establecimiento": r["nombre_establecimiento"].strip(),
                       "sector": r["cte_id_sector"].capitalize(), "zona": r["zona"].capitalize(),
                       "matricula": int(r["total_matricula"]) if r.get("total_matricula", "").isdigit() else None,
                       "direccion": (r.get("direccion") or "").strip(), "codigo_dane": r["codigo_dane_sede"]}
                      for r in sorted(rs, key=lambda r: r["nombre_sede"])],
        }} for p, rs in sorted(celdas.items())]}

    # 3. Capas ambientales de la CVS
    hum = leer("cvs_humedales_pma.geojson")
    runap = leer("cvs_areas_protegidas_runap.geojson")
    amb = {"type": "FeatureCollection", "features": []}
    for f in hum["features"]:
        a = f["properties"]
        amb["features"].append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "capa": "humedal_pma", "nombre": a["nombre"].strip(),
            "detalle": f"Humedal o ciénaga con plan de manejo ambiental · {a['Area_Has']:,.0f} ha"}})
    for f in runap["features"]:
        a = f["properties"]
        amb["features"].append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "capa": "area_protegida", "nombre": a["nombre"].strip(),
            "detalle": f"{a['categoria']} · Resolución {a['resolucion']} · {a['hectareas_']:,.0f} ha · RUNAP"}})

    hoy = date.today().isoformat()
    corr, fuente_pot, n_corr, n_centros = corregimientos(hoy)
    fuentes_vias, notas_vias = vias(hoy) if (CRUDO / "invias_red_vial.geojson").exists() else ([], [])
    cvs_uso = ("Uso permitido citando a la CVS como autora (restricciones de uso del geoportal); "
               "geometrías simplificadas a ~20 m para el visor")
    manifiesto = {
        "generado": hoy,
        "fuentes": [
            {"id": "x5ay-984n", "nombre": "MinEducación · Sedes educativas de preescolar, básica y media (año 2019)",
             "entidad": "Ministerio de Educación Nacional", "licencia": "CC BY-SA 4.0", "actualizado": fecha(men.get("actualizado")),
             "descargado": hoy, "url": "https://www.datos.gov.co/d/x5ay-984n",
             "uso": f"{len(sedes)} sedes de Montería con coordenadas; {en_osm} coinciden por nombre con OSM y "
                    f"{len(faltan)} se muestran como capa oficial. Coordenadas con {dec_men} decimales: ubicación aproximada "
                    f"(±{error_men / 1000:.1f} km)".replace("0.", "0,")},
            {"id": "c36g-9fc2", "nombre": "MinSalud · Registro Especial de Prestadores y Sedes de Servicios de Salud (REPS)",
             "entidad": "Ministerio de Salud y Protección Social", "licencia": "CC BY-SA 4.0", "actualizado": fecha(reps.get("actualizado")),
             "descargado": hoy, "url": "https://www.datos.gov.co/d/c36g-9fc2",
             "uso": f"Revisado: {len(reps['filas'])} sedes en Montería sin coordenadas; no se integra al mapa"},
            {"id": "areas_PMA_CVS", "nombre": "CVS · Ciénagas y humedales con plan de manejo ambiental",
             "entidad": "Corporación Autónoma Regional de los Valles del Sinú y San Jorge (CVS)", "licencia": cvs_uso,
             "actualizado": fecha(hum["fuente"].get("editado")), "descargado": hoy,
             "url": "https://inicio-sigcvs.hub.arcgis.com", "uso": f"{len(hum['features'])} polígonos alrededor de Montería · lente Ambiente"},
            {"id": "Areas_Protegidas_RUNAP", "nombre": "CVS · Áreas protegidas inscritas en el RUNAP",
             "entidad": "CVS, con información del RUNAP (Parques Nacionales Naturales)", "licencia": cvs_uso,
             "actualizado": fecha(runap["fuente"].get("editado")), "descargado": hoy,
             "url": "https://inicio-sigcvs.hub.arcgis.com", "uso": f"{len(runap['features'])} polígonos alrededor de Montería · lente Ambiente"},
            fuente_pot,
        ] + fuentes_vias,
        "no_disponibles": [
            "Alcaldía de Montería · Geoposicionamiento de instituciones educativas (ew4g-9n55) y Zonas Wifi (qyrr-zx9j): "
            "enlazados desde monteria.gov.co, pero datos.gov.co responde que ya no existen",
            "MinTIC · Zonas Digitales Urbanas (wg2u-d8ji): sin coordenadas y sin filas para Montería",
            "CVS · rondas hídricas: el geoportal no las publica como capa descargable",
        ] + notas_vias,
        "cruce_sin_nombre": cruce,
    }

    if cruce["resueltos"]:
        (DATA / "equipamientos.geojson").write_text(json.dumps(equip, ensure_ascii=False), encoding="utf-8")
    (DATA / "oficial_sedes_educativas.geojson").write_text(json.dumps(sedes_geo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "oficial_ambiente.geojson").write_text(json.dumps(amb, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "corregimientos.geojson").write_text(json.dumps(corr, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "fuentes_oficiales.json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Sin nombre en OSM: {len(sin_nombre)} · resueltos: {cruce['resueltos']} · dudosos descartados: {cruce['dudosos']}")
    for c in cruce["por_fuente"]:
        print(f"  {c['fuente']} ({c['categoria']}): {c['candidatos_osm']} candidatos, {c['resueltos']} resueltos · {c['motivo']}")
    print(f"MinEducación: {len(sedes)} sedes con coordenadas · {en_osm} ya en OSM · {len(faltan)} faltan → {len(celdas)} puntos publicados")
    print(f"CVS: {len(hum['features'])} humedales con PMA · {len(runap['features'])} áreas protegidas RUNAP")
    print(f"POT: {n_corr} corregimientos · {n_centros} centros poblados")


def solo_vias():
    """Integra vías y conexiones sin rehacer las demás capas: reemplaza sus entradas en el manifiesto."""
    hoy = date.today().isoformat()
    fuentes, notas = vias(hoy)
    ruta = DATA / "fuentes_oficiales.json"
    manifiesto = json.loads(ruta.read_text(encoding="utf-8"))
    ids = {f["id"] for f in fuentes}
    manifiesto["generado"] = hoy
    manifiesto["fuentes"] = [f for f in manifiesto["fuentes"] if f["id"] not in ids] + fuentes
    manifiesto["no_disponibles"] = [n for n in manifiesto["no_disponibles"] if n not in notas] + notas
    ruta.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")
    for f in fuentes:
        print(f"{f['nombre']}: {f['uso']}")


if __name__ == "__main__":
    solo_vias() if sys.argv[1:] == ["vias"] else main()
