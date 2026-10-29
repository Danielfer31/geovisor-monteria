"""Integra al visor las fuentes oficiales bajadas con tools/datos_abiertos.py.

Uso (desde la raíz, después de `datos_abiertos.py descargar` y `datos_abiertos.py cvs`):
    python3 tools/integrar_oficiales.py

Lee fuentes_abiertas/ (crudo, fuera del repositorio) y escribe:
    data/oficial_sedes_educativas.geojson  sedes MinEducación que no aparecen en OSM
    data/oficial_ambiente.geojson          humedales con PMA y áreas protegidas RUNAP de la CVS
    data/fuentes_oficiales.json            procedencia, licencias y resultado del cruce

Nombres para los equipamientos OSM sin nombre: solo se asignan si una fuente oficial de la misma
categoría tiene un punto a menos de UMBRAL_M y sus coordenadas son lo bastante precisas para
distinguir un predio de otro. Las coincidencias dudosas no se integran.
"""

import difflib
import json
import math
import re
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
        ],
        "no_disponibles": [
            "Alcaldía de Montería · Geoposicionamiento de instituciones educativas (ew4g-9n55) y Zonas Wifi (qyrr-zx9j): "
            "enlazados desde monteria.gov.co, pero datos.gov.co responde que ya no existen",
            "MinTIC · Zonas Digitales Urbanas (wg2u-d8ji): sin coordenadas y sin filas para Montería",
            "CVS · rondas hídricas: el geoportal no las publica como capa descargable",
        ],
        "cruce_sin_nombre": cruce,
    }

    if cruce["resueltos"]:
        (DATA / "equipamientos.geojson").write_text(json.dumps(equip, ensure_ascii=False), encoding="utf-8")
    (DATA / "oficial_sedes_educativas.geojson").write_text(json.dumps(sedes_geo, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "oficial_ambiente.geojson").write_text(json.dumps(amb, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (DATA / "fuentes_oficiales.json").write_text(json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Sin nombre en OSM: {len(sin_nombre)} · resueltos: {cruce['resueltos']} · dudosos descartados: {cruce['dudosos']}")
    for c in cruce["por_fuente"]:
        print(f"  {c['fuente']} ({c['categoria']}): {c['candidatos_osm']} candidatos, {c['resueltos']} resueltos · {c['motivo']}")
    print(f"MinEducación: {len(sedes)} sedes con coordenadas · {en_osm} ya en OSM · {len(faltan)} faltan → {len(celdas)} puntos publicados")
    print(f"CVS: {len(hum['features'])} humedales con PMA · {len(runap['features'])} áreas protegidas RUNAP")


if __name__ == "__main__":
    main()
