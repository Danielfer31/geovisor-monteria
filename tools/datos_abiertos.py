"""Explora y descarga datos abiertos de datos.gov.co útiles para el Geovisor Montería.

Uso (desde la raíz del repositorio, con acceso a www.datos.gov.co y api.us.socrata.com):
    python3 tools/datos_abiertos.py catalogo     # lista conjuntos de Montería, Córdoba y la CVS
    python3 tools/datos_abiertos.py descargar    # baja los conjuntos de CONJUNTOS filtrados a Montería

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

BUSQUEDAS = ["Montería", "Monteria", "Córdoba Colombia", "CVS Valles del Sinú", "Gobernación de Córdoba"]

# Conjuntos nacionales identificados; se filtran a Montería por la columna de municipio.
CONJUNTOS = {
    "reps_sedes_salud": "c36g-9fc2",
    "establecimientos_educativos": "upkm-vdjb",
    "sedes_educativas_por_municipio": "3vjc-hids",
}
COLUMNAS_MUNICIPIO = ("municipio", "nombre_municipio", "municipiosede", "municipio_sede", "nommunicipio", "mpio")


def pedir(url):
    req = urllib.request.Request(url, headers={"User-Agent": AGENTE, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def catalogo():
    vistos = {}
    for q in BUSQUEDAS:
        url = CATALOGO + "?" + urllib.parse.urlencode({"domains": DOMINIO, "q": q, "limit": 200})
        for r in pedir(url).get("results", []):
            res = r["resource"]
            vistos[res["id"]] = {
                "id": res["id"],
                "nombre": res.get("name"),
                "entidad": r.get("metadata", {}).get("domain") and res.get("attribution"),
                "tipo": res.get("type"),
                "actualizado": res.get("data_updated_at") or res.get("updatedAt"),
                "descripcion": (res.get("description") or "")[:240],
                "columnas": res.get("columns_field_name", []),
                "url": r.get("link"),
                "busqueda": q,
            }
    SALIDA.mkdir(exist_ok=True)
    ruta = SALIDA / f"catalogo_{date.today().isoformat()}.json"
    datos = sorted(vistos.values(), key=lambda x: (x["entidad"] or "", x["nombre"] or ""))
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    for d in datos:
        print(f"{d['id']}  {d['actualizado'] or 's. f.':<26}  {d['entidad'] or '':<40}  {d['nombre']}")
    print(f"\n{len(datos)} conjuntos → {ruta.relative_to(RAIZ)}")


def descargar():
    SALIDA.mkdir(exist_ok=True)
    for nombre, ident in CONJUNTOS.items():
        meta = pedir(f"https://{DOMINIO}/api/views/{ident}.json")
        columnas = [c["fieldName"] for c in meta.get("columns", [])]
        col = next((c for c in columnas if c.lower() in COLUMNAS_MUNICIPIO), None)
        if not col:
            print(f"{nombre}: sin columna de municipio reconocible; columnas = {columnas}")
            continue
        filtro = f"upper({col}) like '%MONTER%A%'"
        url = f"https://{DOMINIO}/resource/{ident}.json?" + urllib.parse.urlencode({"$where": filtro, "$limit": 50000})
        filas = pedir(url)
        ruta = SALIDA / f"{nombre}.json"
        ruta.write_text(json.dumps({"id": ident, "titulo": meta.get("name"), "actualizado": meta.get("rowsUpdatedAt"),
                                    "filtro": filtro, "columnas": columnas, "filas": filas}, ensure_ascii=False), encoding="utf-8")
        print(f"{nombre} ({ident}): {len(filas)} filas de Montería → {ruta.relative_to(RAIZ)}")


if __name__ == "__main__":
    {"catalogo": catalogo, "descargar": descargar}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: print(__doc__))()
