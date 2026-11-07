# Asistente con IA del Geovisor (Cloudflare Worker)

El geovisor es una página estática: no puede guardar una clave de API sin exponerla. Este Worker
recibe las preguntas del chat, añade un resumen de los datos del visor y responde con Claude.
Sin él, el asistente sigue funcionando con cálculos locales sobre los mismos datos.

## Desplegar

Requiere una cuenta de Cloudflare (el plan gratuito basta) y una clave de la API de Anthropic.

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # pega la clave cuando la pida
npx wrangler deploy
```

`wrangler deploy` imprime la dirección del servicio, por ejemplo
`https://geovisor-monteria-asistente.<tu-cuenta>.workers.dev`. Ponla en `config.js`:

```js
window.GEOVISOR_CONFIG = { chatUrl: "https://geovisor-monteria-asistente.<tu-cuenta>.workers.dev" };
```

## Seguridad y costo

- La clave vive solo como secreto del Worker; nunca llega al navegador.
- `ORIGENES_PERMITIDOS` (en `wrangler.toml`) limita qué sitios pueden usar el servicio.
- Cada pregunta envía el resumen de datos del visor (unos pocos miles de tokens, con caché de prompt)
  y usa esfuerzo bajo. Conviene fijar un límite de gasto mensual en la consola de Anthropic y, si el
  visor se hace público, activar una regla de límite de peticiones en Cloudflare.
- El modelo responde solo con los datos del visor y advierte sus límites (OSM no oficial, obras
  comunicadas, SECOP pendiente de revisión).
