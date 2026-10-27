# Geovisor de Montería

Geovisor urbano de Montería con la identidad de ColombIA · CIIAC (Centro Institucional de Inteligencia Artificial de Colombia).

[Ver el geovisor](https://danielfer31.github.io/geovisor-monteria/) · [Versión anterior (v1.0)](https://danielfer31.github.io/geovisor-monteria/v1/)

## Qué muestra

- **Mapa 3D por manzana** (Censo DANE 2018): ocho lentes —densidad, acueducto, alcantarillado, internet, distancia a salud, educación y seguridad, y estrato—. La altura y el color de cada manzana siguen el valor del lente activo.
- **Ficha de manzana y de comuna**: cobertura de servicios, distancias comparadas con la mediana de la ciudad y equipamientos.
- **Obras y PDM**: obras comunicadas por la Alcaldía en Instagram, ubicadas en el mapa y vinculadas a metas del Plan de Desarrollo.
- **SECOP**: proyectos candidatos de obra por año, sector y entidad, con línea de tiempo reproducible.
- **Buscador** (`Ctrl K`) de barrios, comunas, equipamientos y obras.

Las fuentes, licencias y límites de interpretación están en el botón **Fuentes** del visor. Las comunas y el perímetro vienen de OpenStreetMap y no son límites oficiales del POT; las distancias son en línea recta.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `app.css`, `app.js` | Interfaz del geovisor v2 |
| `data/` | Capas y resúmenes que carga el visor |
| `vendor/` | MapLibre GL JS 4.7.1 (licencia BSD-3, ver `vendor/LICENSE.txt`) |
| `v1/index.html` | Instantánea publicada de la v1.0, fuente de los datos |
| `tools/extraer_datos.py` | Regenera `data/` a partir de `v1/index.html` |

Para regenerar los datos tras exportar una nueva instantánea en `v1/index.html`:

```bash
python3 tools/extraer_datos.py
```

Para verlo localmente, sirva la carpeta con cualquier servidor estático (por ejemplo `python3 -m http.server`) y abra `http://localhost:8000`. El mapa base se carga desde CARTO y OpenStreetMap, por lo que requiere conexión a internet.

Atribución: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL), © [CARTO](https://carto.com/attributions), DANE.
