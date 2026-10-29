"""Explora y descarga datos abiertos de datos.gov.co útiles para el Geovisor Montería.

Uso (desde la raíz del repositorio, con acceso a www.datos.gov.co y api.us.socrata.com):
    python3 tools/datos_abiertos.py catalogo     # lista conjuntos de Montería, Córdoba y la CVS
    python3 tools/datos_abiertos.py descargar    # baja los conjuntos de CONJUNTOS filtrados a Montería
    python3 tools/datos_abiertos.py cvs          # baja capas ambientales del geoportal de la CVS (ArcGIS)

Escribe en fuentes_abiertas/ (crudo, para revisar) y no toca data/: la integración al visor
se hace después de revisar columnas y cobertura de cada conjunto.
"""

import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "fuentes_abiertas"
CATALOGO = "https://api.us.socrata.com/api/catalog/v1"
DOMINIO = "www.datos.gov.co"
AGENTE = "geovisor-monteria/2 (+https://github.com/danielfer31/geovisor-monteria)"

# El catálogo filtra por los metadatos de la entidad que publica; la búsqueda por texto
# ("Córdoba", "CVS") trae conjuntos de otros departamentos y no sirve como filtro.
FILTROS = [
    {"Información-de-la-Entidad_Municipio": "Montería"},
    {"Información-de-la-Entidad_Departamento": "Córdoba"},
    {"q": "Corporación Autónoma Regional de los Valles del Sinú"},
]

# Conjuntos nacionales identificados; se filtran a Montería por la columna de municipio.
CONJUNTOS = {
    "reps_sedes_salud": "c36g-9fc2",
    "establecimientos_educativos": "upkm-vdjb",
    "sedes_educativas_por_municipio": "3vjc-hids",
    # Único conjunto educativo con coordenadas por sede (MinEducación, corte 2021).
    "sedes_educativas_coordenadas": "x5ay-984n",
}
# Geoportal de la CVS (ArcGIS Online, organización SIG-CVS): https://inicio-sigcvs.hub.arcgis.com
# Uso permitido con crédito a la CVS; el geoportal no publica rondas hídricas como capa descargable.
CVS_SERVICIOS = "https://services3.arcgis.com/Fto9oba51JWVX0Qy/arcgis/rest/services"
CVS_CAPAS = {
    "cvs_humedales_pma": "areas_PMA_CVS",
    "cvs_areas_protegidas_runap": "Areas_Protegidas_RUNAP",
}
# Cabecera de Montería con margen; se baja cada polígono completo que la toque.
CVS_ENVOLVENTE = "-75.97,8.66,-75.78,8.87"

# En orden de preferencia: en el REPS, municipiosede es el código DANE y municipiosededesc el nombre.
COLUMNAS_MUNICIPIO = ("municipiosededesc", "nombremunicipio", "municipio", "nombre_municipio", "municipio_sede", "nommunicipio", "mpio")


def pedir(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def meta_entidad(r):
    return {m["key"]: m["value"] for m in r.get("classification", {}).get("domain_metadata", [])}


def es_de_interes(res, meta):
    entidad = (meta.get("Información-de-la-Entidad_Nombre-de-la-Entidad") or res.get("attribution") or "").lower()
    depto = meta.get("Información-de-la-Entidad_Departamento", "")
    return depto == "Córdoba" or "monter" in entidad or "valles del sin" in entidad


def catalogo():
    vistos = {}
    for filtro in FILTROS:
        offset = 0
        while True:
            url = CATALOGO + "?" + urllib.parse.urlencode({"domains": DOMINIO, "limit": 100, "offset": offset, **filtro})
            resultados = pedir(url).get("results", [])
            for r in resultados:
                res, meta = r["resource"], meta_entidad(r)
                if not es_de_interes(res, meta):
                    continue
                vistos[res["id"]] = {
                    "id": res["id"],
                    "nombre": res.get("name"),
                    "entidad": meta.get("Información-de-la-Entidad_Nombre-de-la-Entidad") or res.get("attribution"),
                    "municipio": meta.get("Información-de-la-Entidad_Municipio"),
                    "tipo": res.get("type"),
                    "actualizado": res.get("data_updated_at") or res.get("updatedAt"),
                    "licencia": r.get("metadata", {}).get("license"),
                    "descripcion": (res.get("description") or "")[:240],
                    "columnas": res.get("columns_field_name", []),
                    "url": r.get("permalink") or r.get("link"),
                }
            if len(resultados) < 100:
                break
            offset += 100
    SALIDA.mkdir(exist_ok=True)
    ruta = SALIDA / f"catalogo_{date.today().isoformat()}.json"
    datos = sorted(vistos.values(), key=lambda x: (x["entidad"] or "", x["nombre"] or ""))
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    for d in datos:
        print(f"{d['id']}  {(d['actualizado'] or 's. f.')[:10]:<10}  {(d['entidad'] or '')[:45]:<45}  {d['nombre']}")
    print(f"\n{len(datos)} conjuntos → {ruta.relative_to(RAIZ)}")


def descargar():
    SALIDA.mkdir(exist_ok=True)
    for nombre, ident in CONJUNTOS.items():
        meta = pedir(f"https://{DOMINIO}/api/views/{ident}.json")
        columnas = [c["fieldName"] for c in meta.get("columns", [])]
        col = next((c for c in COLUMNAS_MUNICIPIO if c in columnas), None)
        if not col:
            print(f"{nombre}: sin columna de municipio reconocible; columnas = {columnas}")
            continue
        filtro = f"upper({col}) like '%MONTER%A%'"
        url = f"https://{DOMINIO}/resource/{ident}.json?" + urllib.parse.urlencode({"$where": filtro, "$limit": 50000})
        filas = pedir(url)
        ruta = SALIDA / f"{nombre}.json"
        ruta.write_text(json.dumps({"id": ident, "titulo": meta.get("name"), "entidad": meta.get("attribution"),
                                    "licencia": (meta.get("license") or {}).get("name"), "actualizado": meta.get("rowsUpdatedAt"),
                                    "filtro": filtro, "columnas": columnas, "filas": filas}, ensure_ascii=False), encoding="utf-8")
        print(f"{nombre} ({ident}): {len(filas)} filas de Montería → {ruta.relative_to(RAIZ)}")


def cvs():
    SALIDA.mkdir(exist_ok=True)
    for nombre, servicio in CVS_CAPAS.items():
        capa = f"{CVS_SERVICIOS}/{servicio}/FeatureServer/0"
        meta = pedir(capa + "?f=json")
        consulta = urllib.parse.urlencode({
            "where": "1=1", "geometry": CVS_ENVOLVENTE, "geometryType": "esriGeometryEnvelope", "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "outSR": 4326, "f": "geojson",
            # ~20 m de tolerancia: suficiente para la escala del visor y mantiene el archivo liviano
            "maxAllowableOffset": 0.0002, "geometryPrecision": 5,
        })
        geo = pedir(f"{capa}/query?{consulta}")
        geo["fuente"] = {"servicio": capa, "titulo": meta.get("name"), "editado": (meta.get("editingInfo") or {}).get("lastEditDate")}
        ruta = SALIDA / f"{nombre}.geojson"
        ruta.write_text(json.dumps(geo, ensure_ascii=False), encoding="utf-8")
        print(f"{nombre}: {len(geo.get('features', []))} polígonos → {ruta.relative_to(RAIZ)}")


if __name__ == "__main__":
    {"catalogo": catalogo, "descargar": descargar, "cvs": cvs}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: print(__doc__))()
