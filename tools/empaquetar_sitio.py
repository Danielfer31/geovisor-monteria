"""Empaqueta el sitio estático del geovisor en un .zip listo para subir a cualquier hosting.

Uso (desde la raíz del repositorio):
    python3 tools/empaquetar_sitio.py [salida.zip]

Incluye solo lo que el sitio necesita para funcionar (páginas, estilos, scripts, datos,
tipografías y MapLibre). No incluye herramientas, el servicio del asistente ni fuentes crudas.
Todas las rutas son relativas: el contenido puede alojarse en la raíz o en una subcarpeta.
"""

import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INCLUIR = ["index.html", "app.css", "app.js", "chat.js", "config.js", "README.md", ".nojekyll", "assets", "data", "vendor", "v1"]


def main():
    salida = Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "geovisor-monteria-sitio.zip")
    n = 0
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for nombre in INCLUIR:
            ruta = RAIZ / nombre
            archivos = [ruta] if ruta.is_file() else sorted(p for p in ruta.rglob("*") if p.is_file())
            for f in archivos:
                z.write(f, f.relative_to(RAIZ).as_posix())
                n += 1
    print(f"{n} archivos, {salida.stat().st_size / 1e6:.1f} MB → {salida}")


if __name__ == "__main__":
    main()
