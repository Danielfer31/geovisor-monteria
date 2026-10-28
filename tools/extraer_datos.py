"""Extrae las capas embebidas en v1/index.html hacia data/ para el Geovisor v2.

Uso (desde la raíz del repositorio):
    python3 tools/extraer_datos.py

v1/index.html es la instantánea publicada del Geovisor v1. Este script no
consulta fuentes externas: solo separa, aligera y resume lo que ya trae esa
instantánea, para que la v2 cargue los datos en archivos independientes.
"""

import base64
import collections
import gzip
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "v1" / "index.html"
DESTINO = RAIZ / "data"
DECIMALES = 5

CAMPOS_MANZANA = [
    "cod_dane", "comuna_id", "personas", "viviendas", "hogares", "densidad_hab_ha",
    "estrato_modal", "pct_sin_acueducto", "pct_sin_alcantarillado", "pct_sin_recoleccion",
    "pct_sin_internet", "dist_salud_m", "dist_educacion_m", "dist_seguridad_m",
]


def redondear(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], DECIMALES), round(coords[1], DECIMALES)]
    return [redondear(c) for c in coords]


def aligerar(coleccion, campos=None):
    salida = []
    for f in coleccion["features"]:
        props = f.get("properties") or {}
        if campos:
            props = {k: props.get(k) for k in campos}
        salida.append({"type": "Feature", "geometry": {
            "type": f["geometry"]["type"], "coordinates": redondear(f["geometry"]["coordinates"]),
        }, "properties": props})
    return {"type": "FeatureCollection", "features": salida}


def anillos(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def centroide(geom):
    anillo = anillos(geom)[0][0]
    xs = [p[0] for p in anillo]
    ys = [p[1] for p in anillo]
    return [sum(xs) / len(xs), sum(ys) / len(ys)]


def anio(fecha):
    return fecha[:4] if fecha else None


def resumir_secop(inventario):
    proyectos = []
    por_anio = collections.defaultdict(lambda: collections.Counter())
    valor_anio = collections.Counter()
    for p in inventario["projects"]:
        contratos = p.get("contracts") or []
        valor = sum(c.get("value_cop") or 0 for c in contratos)
        fechas = sorted(c.get("signed_at") or c.get("start_at") or "" for c in contratos)
        fechas = [f for f in fechas if f]
        primero = contratos[0] if contratos else {}
        a = anio(fechas[0]) if fechas else None
        proyectos.append({
            "t": p.get("title"), "s": p.get("sector"), "i": p.get("intervention"),
            "v": valor, "a": a, "f": fechas[0][:10] if fechas else None,
            "e": primero.get("entity_name"), "u": primero.get("source_url"), "n": len(contratos),
        })
        if a:
            por_anio[a][p.get("sector")] += 1
            valor_anio[a] += valor
    anios = sorted(por_anio)
    return {
        "corte": inventario.get("cutoff_date"),
        "cobertura": inventario.get("coverage", {}).get("status"),
        "contratos": inventario.get("coverage", {}).get("contract_records"),
        "proyectos": len(proyectos),
        "por_anio": [{"anio": a, "proyectos": sum(por_anio[a].values()), "valor": valor_anio[a],
                      "sectores": dict(por_anio[a])} for a in anios],
    }, proyectos


def escribir(nombre, datos):
    ruta = DESTINO / nombre
    ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{nombre}: {ruta.stat().st_size:,} bytes")


def main():
    html = ORIGEN.read_text(encoding="utf-8")
    inicio = html.find('{"perimetro_urbano"')
    datos, _ = json.JSONDecoder().raw_decode(html, inicio)
    bloque = re.search(r'id="secop-inventario-comprimido"[^>]*>([^<]+)<', html).group(1)
    inventario = json.loads(gzip.decompress(base64.b64decode(bloque)))
    DESTINO.mkdir(exist_ok=True)

    barrios = aligerar(datos["barrios"], ["nombre", "comuna_id"])
    # OSM solo trae los barrios como puntos: a cada manzana se le asigna el punto
    # de barrio más cercano de su misma comuna, como referencia aproximada.
    puntos_barrio = [(f["properties"]["nombre"], f["properties"]["comuna_id"], f["geometry"]["coordinates"])
                     for f in barrios["features"]]
    manzanas = aligerar(datos["manzanas"], CAMPOS_MANZANA)
    for f in manzanas["features"]:
        c = centroide(f["geometry"])
        candidatos = [b for b in puntos_barrio if b[1] == f["properties"]["comuna_id"]] or puntos_barrio
        f["properties"]["barrio"] = min(candidatos, key=lambda b: (b[2][0] - c[0]) ** 2 + (b[2][1] - c[1]) ** 2)[0]

    escribir("contexto.json", {
        "perimetro": aligerar(datos["perimetro_urbano"], ["nombre"]),
        "comunas": aligerar(datos["comunas"], ["comuna_id", "nombre"]),
        "rio": aligerar(datos["rio_sinu"], ["nombre"]),
        "barrios": barrios,
    })
    escribir("manzanas.geojson", manzanas)
    escribir("equipamientos.geojson", aligerar(datos["equipamientos"], ["nombre", "categoria", "tipo", "comuna_id", "osm_id", "osm_tipo"]))

    obras = aligerar(datos["obras_instagram"])
    for f in obras["features"]:
        p = f["properties"]
        tipo, _, nombre = (p.get("title") or "").partition(": ")
        f["properties"] = {
            "nombre": nombre or p.get("title"), "tipo": tipo, "tema": p.get("tema_id"),
            "estado": p.get("review_label"), "comunicacion": p.get("communication_label"),
            "precision": p.get("precision_label"), "fecha": p.get("source_date"),
            "posts": [x["source_url"] for x in p.get("posts") or []],
            "pdm": [{"indicador": x.get("indicator_literal"), "meta": x.get("target_value"),
                     "unidad": x.get("target_unit"), "estado": x.get("status")} for x in p.get("pdm_links") or []],
        }
    escribir("obras.geojson", obras)

    acciones = datos["acciones_instagram"]
    secop_resumen, secop_proyectos = resumir_secop(inventario)
    escribir("resumen.json", {
        "resumen": datos["resumen"], "manifest": datos["manifest"],
        "instagram": {"cobertura": acciones["coverage"], "acciones": [
            {"url": a["source_url"], "fecha": (a.get("published_at") or "")[:10], "categoria": a.get("category"),
             "etiqueta": a.get("communication_label")} for a in acciones["actions"]]},
        "secop": secop_resumen,
    })
    escribir("secop_proyectos.json", secop_proyectos)


if __name__ == "__main__":
    main()
