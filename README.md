# Geovisor de Montería

Geovisor urbano de Montería con la identidad de ColombIA · CIIAC (Centro Institucional de Inteligencia Artificial de Colombia).

[Ver el geovisor](https://danielfer31.github.io/geovisor-monteria/) · [Versión anterior (v1.0)](https://danielfer31.github.io/geovisor-monteria/v1/)

## Qué muestra

- **Mapa 3D por manzana** (Censo DANE 2018): ocho lentes —densidad, acueducto, alcantarillado, internet, distancia a salud, educación y seguridad, y estrato—. La altura y el color de cada manzana siguen el valor del lente activo.
- **Ficha de manzana y de comuna**: cobertura de servicios, distancias comparadas con la mediana de la ciudad y equipamientos.
- **Obras y PDM**: obras comunicadas por la Alcaldía en Instagram, ubicadas en el mapa y vinculadas a metas del Plan de Desarrollo.
- **SECOP**: proyectos candidatos de obra por año, sector y entidad, con línea de tiempo reproducible.
- **Buscador** (`Ctrl K`) de barrios, comunas, equipamientos y obras.
- **Organización tipo Google Maps**: categorías de equipamientos para filtrar, selector Mapa/Satélite, escala, ubicación propia y lente **Ambiente** con río, humedales y coberturas verdes.
- **Capas oficiales** (se distinguen de OSM por el borde continuo o el aro hueco):
  - *Sedes educativas MinEducación* que no aparecen por nombre en OpenStreetMap (254 sedes en 191 puntos). La fuente publica las coordenadas con dos decimales, así que la ubicación es aproximada (hasta ~0,8 km).
  - *Humedales con plan de manejo* (5) y *áreas protegidas RUNAP* (2) del geoportal de la CVS, en el lente Ambiente.
- **Vías nacionales y conexiones** (capa oficial con línea continua, se apaga desde el botón *Vías nacionales INVÍAS*):
  - *Red vial nacional* de INVÍAS alrededor de Montería (29 tramos) con ruta, código y sector del tramo, entidad a cargo (INVÍAS, ANI o convenio), categoría, calzada y superficie cuando la fuente los trae. La longitud de cada tramo sale de los postes de referencia (PR): en doble calzada la geometría de INVÍAS incluye las dos calzadas y duplicaría la medida.
  - *Concesiones viales de la ANI* con su estado (operación, construcción, estructuración), *peajes* con su tarifa de categoría I y el *aeropuerto Los Garzones* con su concesión.
  - Sección *Conexiones* en el panel de ciudad: cuatro corredores (Cereté y Lorica, Cereté y la Troncal de Occidente, Planeta Rica, Puerto Rey y Arboletes) con la suma de las longitudes oficiales de sus tramos; destinos de la terminal de transporte en 2025 (SuperTransporte) y destinos de los pasajeros de Los Garzones en 2025 (Aerocivil). No son distancias puerta a puerta: la red nacional no incluye el recorrido dentro de las ciudades.
- **Zona rural**: los 28 corregimientos con sus 63 centros poblados (cabeceras y caseríos) delimitados en el POT y el límite municipal. Se recorren desde el panel (*Ver todo el municipio* y una ficha por corregimiento), el buscador o el mapa. No hay límites oficiales publicados de cada corregimiento, así que se muestran sus centros poblados; los datos por manzana del Censo solo cubren la cabecera.
- **Herramientas de trabajo**: ficha PDF de ciudad o comuna (imprimir → guardar como PDF), descarga CSV de comunas, equipamientos y proyectos SECOP, y enlace que conserva la vista exacta para compartir.
- **Índice de necesidad** (lente «Prioridad»): combina carencias de servicios, distancia a salud, educación y seguridad y estrato, con pesos ajustables y perfiles predefinidos; ranking de comunas ponderado por población, manzanas con mayor necesidad y descarga CSV. Es un índice relativo, no una medida oficial.
- **Simulador de inversión**: estima cuántas personas ganarían acceso a salud, educación o seguridad con un nuevo equipamiento en el punto elegido, y sugiere los tres mejores sitios.
- **Tutorial** de primera visita (botón `?` para repetirlo).
- **Asistente**: chat que responde con los datos del visor y lleva el mapa al lugar consultado. Con el servicio de `worker/` configurado en `config.js`, responde además con IA (Claude).

Las fuentes, licencias y límites de interpretación están en el botón **Fuentes** del visor. Las comunas y el perímetro vienen de OpenStreetMap y no son límites oficiales del POT; las distancias a equipamientos son en línea recta.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `app.css`, `app.js` | Interfaz del geovisor v2 |
| `chat.js`, `config.js` | Asistente y su configuración (`chatUrl`) |
| `worker/` | Servicio opcional del asistente con IA (Cloudflare Worker) |
| `data/` | Capas y resúmenes que carga el visor |
| `vendor/` | MapLibre GL JS 4.7.1 (licencia BSD-3, ver `vendor/LICENSE.txt`) |
| `v1/index.html` | Instantánea publicada de la v1.0, fuente de los datos |
| `tools/extraer_datos.py` | Regenera `data/` a partir de `v1/index.html` |
| `tools/datos_abiertos.py` | Consulta el catálogo de datos.gov.co y descarga los conjuntos y capas de la CVS, el POT, INVÍAS y la ANI a `fuentes_abiertas/` (fuera de git) |
| `tools/integrar_oficiales.py` | Cruza esas fuentes con los equipamientos OSM y escribe `data/oficial_*.geojson`, `data/corregimientos.geojson`, `data/vias_nacionales.geojson`, `data/conexiones.json` y `data/fuentes_oficiales.json` |

Para regenerar los datos tras exportar una nueva instantánea en `v1/index.html`:

```bash
python3 tools/extraer_datos.py
```

Para actualizar las capas oficiales (requiere acceso a www.datos.gov.co, api.us.socrata.com, www.arcgis.com, services.arcgis.com, services3.arcgis.com y services8.arcgis.com):

```bash
python3 tools/datos_abiertos.py catalogo    # lista conjuntos de entidades de Montería, Córdoba y la CVS
python3 tools/datos_abiertos.py descargar   # REPS, establecimientos y sedes educativas filtrados a Montería
python3 tools/datos_abiertos.py cvs         # humedales con PMA y áreas protegidas RUNAP
python3 tools/datos_abiertos.py pot         # centros poblados del POT y límite municipal
python3 tools/datos_abiertos.py vias        # red vial nacional, peajes, concesiones ANI, terminal y aeropuerto
python3 tools/integrar_oficiales.py         # cruce con OSM y archivos de data/
python3 tools/integrar_oficiales.py vias    # solo vías y conexiones, sin rehacer las demás capas
```

### Fuentes oficiales revisadas (corte 29 de octubre de 2026)

| Fuente | Licencia | Uso en el visor |
|---|---|---|
| [MinEducación · Sedes educativas (x5ay-984n)](https://www.datos.gov.co/d/x5ay-984n), año 2019 | CC BY-SA 4.0 | Capa de sedes que no están en OSM; ubicación aproximada |
| [MinSalud · REPS (c36g-9fc2)](https://www.datos.gov.co/d/c36g-9fc2), corte marzo 2026 | CC BY-SA 4.0 | Revisado; 784 sedes en Montería sin coordenadas, no se integra |
| [POT de Montería · centros poblados y límite municipal](https://www.arcgis.com/home/item.html?id=2536664f628c4b42b3422f894b053252) (Acuerdo 003 de 2021) | Sin licencia declarada; capas entregadas por la Alcaldía y publicadas por el proyecto APPA Córdoba | Corregimientos y centros poblados; el límite municipal no sirve para ubicar puntos exactos ni calcular áreas |
| [CVS · geoportal SIG-CVS](https://inicio-sigcvs.hub.arcgis.com): `areas_PMA_CVS` y `Areas_Protegidas_RUNAP` | Uso con crédito a la CVS (restricciones de uso del geoportal) | Lente Ambiente; geometrías simplificadas a ~20 m |
| [INVÍAS · Red vial (ie7y-asdn)](https://www.datos.gov.co/d/ie7y-asdn), actualizado 19 oct 2026 | CC BY-SA 4.0 | Capa de vías nacionales; longitudes por postes de referencia |
| [INVÍAS · Peajes (68qj-5xux)](https://www.datos.gov.co/d/68qj-5xux), actualizado 19 oct 2026 | CC BY-SA 4.0 | 9 peajes de la región; se usa la geometría publicada porque las columnas latitud/longitud traen errores |
| [ANI · Concesiones carreteras](https://www.arcgis.com/home/item.html?id=b29447e238b74f69954fcc3513178993) y [aeroportuarias](https://www.arcgis.com/home/item.html?id=27d4d5f324b44768a72390c7be87e4b3), edición enero 2024 | Uso público según la ANI; no reemplaza la información oficial que se solicite a la Agencia | Concesiones con su estado y concesión del aeropuerto Los Garzones |
| [SuperTransporte · Despachos desde terminales (eh75-8ah6)](https://www.datos.gov.co/d/eh75-8ah6), año 2025 | CC BY-SA 4.0 | Destinos de la terminal de Montería (33 municipios) |
| [Aerocivil · Tráfico origen-destino (gb6w-ynu4)](https://www.datos.gov.co/d/gb6w-ynu4), año 2025 | CC BY-SA 4.0 | Destinos de los pasajeros que salen de Los Garzones (incluye viajes con conexión) |
| [DANE · DIVIPOLA (gdxc-w37w)](https://www.datos.gov.co/d/gdxc-w37w) | CC BY-SA 4.0 | Nombres de los municipios de destino |

**Nombres para equipamientos sin nombre en OSM**: 0 de 160 resueltos. El cruce exige un punto oficial de la misma categoría a menos de 75 m; las coordenadas de MinEducación tienen hasta ~790 m de error por redondeo y el REPS no publica coordenadas, así que ninguna coincidencia es confiable. Los nombres no se toman de Google Maps porque sus términos lo prohíben.

**No integradas**: los conjuntos de la Alcaldía *Geoposicionamiento de instituciones educativas* (ew4g-9n55) y *Zonas Wifi* (qyrr-zx9j) siguen enlazados desde monteria.gov.co, pero datos.gov.co responde que ya no existen; *Zonas Digitales Urbanas* de MinTIC no trae coordenadas ni filas de Montería; la CVS no publica rondas hídricas como capa descargable. En vías: la vía a Tierralta y las demás hacia el sur del municipio no hacen parte de la red vial nacional de INVÍAS, y el inventario SINC de MinTransporte no trae ejes de Montería; el peaje San Carlos está publicado pero su tramo (3306) no aparece en la red de INVÍAS; las capas viales del POT (ejes, vías primarias, red secundaria y terciaria propuesta) no traen nombres ni licencia; ninguna fuente oficial abierta publica la ubicación de la terminal de transporte, así que se usa la de OpenStreetMap; y la Variante Oriental de Sincelejo se omite porque INVÍAS declara que su geometría viene de Google Maps. No se calculan distancias puerta a puerta porque la red nacional tiene vacíos dentro de las ciudades. Los conjuntos de 2016 de establecimientos educativos (upkm-vdjb, 3vjc-hids) no tienen coordenadas y el segundo no incluye Córdoba.

Para verlo localmente, sirva la carpeta con cualquier servidor estático (por ejemplo `python3 -m http.server`) y abra `http://localhost:8000`. El mapa base se carga desde CARTO y OpenStreetMap, por lo que requiere conexión a internet.

Atribución: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL), © [CARTO](https://carto.com/attributions), DANE, Ministerio de Educación Nacional, INVÍAS, SuperTransporte y Aerocivil (CC BY-SA 4.0), Agencia Nacional de Infraestructura (ANI), Corporación Autónoma Regional de los Valles del Sinú y San Jorge (CVS), Alcaldía de Montería (POT).
