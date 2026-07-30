# Plan de implementación · Geocodificador Inteligente v2

Documento de trabajo para construir una segunda versión del proyecto como
repositorio independiente, con backend Python y frontend React.

> **Estado: las cinco fases están completas.** Este documento se conserva como
> registro de las decisiones y de por qué se tomaron. El README describe cómo
> usar el resultado.

---

## 0. Reglas de esta versión

Estas dos reglas mandan sobre cualquier otra decisión del documento.

### La v1 no se toca

La aplicación Streamlit en `~/bdp/portable/notebooks/app_geocoder` **se queda
exactamente como está**. No se mueve, no se modifica, no se borra un solo
archivo. Es un entregable calificable y tiene que seguir arrancando.

La v2 vive en un repositorio aparte y **todos sus archivos son nuevos**. Cuando
este plan dice que un módulo "se parte de" otro, significa copiar y adaptar,
nunca mover.

### Simplicidad por encima de todo

El código tiene que poder leerse de corrido por alguien que llevó el curso. Eso
implica renunciar a herramientas que serían "mejores" pero exigen aprender algo
nuevo:

| En lugar de | Se usa | Por qué |
|---|---|---|
| FastAPI + Pydantic | **Flask** | Es el patrón exacto de `05_api.py`: `@app.route` y `jsonify` |
| TypeScript | **JavaScript** | Sin interfaces ni anotaciones; menos ruido |
| TanStack Query | **`fetch` + `useState`** | Una pantalla, cuatro llamadas: no necesita un gestor de caché |
| Zustand / Redux | **`useState` en `App.jsx`** | El estado cabe en un componente |
| Pydantic Settings | **`config.py` con `os.getenv`** | Igual que la v1, que ya funciona |
| `cachetools` | **`functools.lru_cache`** | Biblioteca estándar, una línea |

**Presupuesto de archivos:** 6 en el backend, 7 en el frontend. Si un archivo
pasa de ~150 líneas o hace falta un octavo, es señal de que algo se complicó.

---

## 1. Objetivo

Una interfaz moderna y usable desde el teléfono, con el backend separado del
frontend, sin cambiar nada del laboratorio de Big Data ni del modelo entrenado
en clase.

**Lo que cambia:** la capa de presentación y el empaquetado.
**Lo que no cambia:** Elasticsearch, HDFS, el modelo GBT, `05_api.py` y la v1.

---

## 2. Decisiones tomadas

| Tema | Decisión | Motivo |
|---|---|---|
| Repositorio | `geocodificador-oportunidades-mx`, privado | Coincide con el título del proyecto; se abre tras la calificación |
| Licencia | MIT, al hacerlo público | Sin `05_api.py` dentro: es material del curso |
| Backend | Flask | Mismo patrón que `05_api.py` |
| Frontend | Vite + React + JavaScript + Tailwind | Next.js no aporta nada aquí y complica Leaflet (rompe SSR) |
| Mapa | react-leaflet + tiles CARTO Voyager | Datos de OpenStreetMap, sin token ni cuenta |
| Diseño | Referencia Salesforce Maps | Panel lateral, mapa dominante, hoja inferior en móvil |
| Color | Codifica **potencial**, no clase | "¿Hay oportunidad aquí?" es más accionable que "¿qué es esto?" |
| Icono | Codifica **tipo de tienda** | Segundo canal, para no perder información |

### Sistema de color

Tres niveles, cortes en 85 % y 70 %. Cuatro tonos por familia, cada uno con un rol fijo.

| Nivel | Umbral | Pin | Base | Fondo | Texto |
|---|---|---|---|---|---|
| Alto | ≥ 85 % | `#248F6B` | `#2FA37B` | `#E8F6F0` | `#1B6B50` |
| Medio | 70 – 84 % | `#C9841E` | `#E9A23B` | `#FDF3E3` | `#8A5A12` |
| Bajo | < 70 % | `#D4574A` | `#E4695C` | `#FDEDEB` | `#96382F` |

- **Pin**: relleno del marcador, con icono blanco y anillo blanco de 2 px. Los tres superan 3:1 de contraste contra blanco.
- **Base**: barra de confianza y borde izquierdo de la tarjeta.
- **Fondo** y **texto**: interior de la ficha.

Iconos: tienda para conveniencia (OXXO), canasta para abarrotes.

> En un clasificador binario la confianza nunca baja de 50 %, así que el tramo
> rojo (50–70 %) es justo donde el modelo apenas discrimina. El color lo comunica.

---

## 3. Estructura del repositorio

```
geocodificador-oportunidades-mx/
├─ .gitignore
├─ README.md
├─ docs/
│  ├─ PLAN.md
│  └─ arquitectura.svg
├─ backend/
│  ├─ api.py             Flask: las 4 rutas y el arranque
│  ├─ es_client.py       consultas a Elasticsearch
│  ├─ ml_api.py          cliente de 05_api.py
│  ├─ scoring.py         niveles de confianza y clave de coordenada
│  ├─ config.py          endpoints y constantes
│  ├─ requirements.txt
│  ├─ static/            build del frontend (ignorado por git)
│  └─ tests/
└─ frontend/
   ├─ src/
   │  ├─ App.jsx         estado y composición
   │  ├─ api.js          las 4 llamadas al backend
   │  ├─ colores.js      tabla de la sección 2
   │  ├─ Mapa.jsx        react-leaflet, pines y popup
   │  ├─ Panel.jsx       búsqueda, resultados, leyenda
   │  ├─ Tarjetas.jsx    ficha de dirección y veredicto
   │  └─ HojaMovil.jsx   panel inferior en teléfono
   ├─ tailwind.config.js
   └─ package.json
```

### De qué archivo de la v1 se parte cada uno

Todos son **archivos nuevos**. La v1 permanece intacta en su carpeta.

| Archivo nuevo | Se parte de | Qué cambia |
|---|---|---|
| `backend/es_client.py` | `app_geocoder/es_client.py` | Copia casi literal; se quita un comentario sobre Streamlit |
| `backend/ml_api.py` | `app_geocoder/ml_api.py` | Copia literal |
| `backend/config.py` | `app_geocoder/config.py` | Copia, más la URL de escucha |
| `backend/scoring.py` | `app_geocoder/ui_utils.py` | Solo `interpretar_confianza` (a 3 niveles), `clave_coord` y `dentro_de_mexico` |
| `backend/api.py` | `05_api.py` (estilo) | Nuevo; sigue el mismo patrón de rutas |
| `frontend/src/colores.js` | `app.py` (constante `ESTILO_CLASE`) | Se parte en dos tablas: color por nivel, icono por clase |
| `frontend/src/api.js` | `app.py` (funciones de consulta) | Nuevo |
| `frontend/src/*.jsx` | `app.py` (presentación) | Nuevos; el layout cambia por completo |

De `ui_utils.py` **no se portan** `normalizar_clic` ni `es_clic_nuevo`: existían
solo para sobrevivir a los reruns de Streamlit. En React un clic es un clic.
`formatear_distancia` y `registrar_analisis` se reescriben en JavaScript, dentro
de los componentes que las usan.

---

## 4. Contrato del backend

Cuatro rutas. El backend decide el **nivel**; el frontend decide el **color**.
Así los umbrales viven en un solo sitio.

### `GET /api/health`

```json
{
  "elasticsearch": { "ok": true, "mensaje": "33,600,000 domicilios indexados" },
  "api_spark":     { "ok": false, "mensaje": "No hay servicio en http://localhost:5001/predict" }
}
```

### `GET /api/geocode?q=<texto>&size=5`

```json
{ "resultados": [ {
  "direccion_completa": "AVENIDA HEROE DE NACOZARI SUR 2301 ...",
  "cp": "20180", "municipio": "AGUASCALIENTES", "estado": "AGUASCALIENTES",
  "lat": 21.88, "lon": -102.296, "score": 48.2
} ] }
```

### `GET /api/reverse?lat=<n>&lon=<n>&size=3`

Igual, con `distancia_km` en vez de `score`, ordenado ascendente.

### `POST /api/predict`

```json
// entrada
{ "lat": 21.88, "lon": -102.296 }

// salida
{ "clase": "OXXO", "confianza": 87.34, "nivel": "alto",
  "lat": 21.88, "lon": -102.296, "segundos": 42.1 }
```

`nivel` es `"alto" | "medio" | "bajo"`. Los errores devuelven el código HTTP
correspondiente con `{"error": "..."}` y un mensaje accionable, igual que la v1.

---

## 5. Fases

### ✅ Fase 0 · Andamiaje del repositorio — 1.5 h

1. Clonar el repo creado en GitHub con template `.gitignore` de Python.
2. **Antes de crear nada**, ampliar el `.gitignore` con los bloques de datos,
   frontend, macOS y editor. Commit solo de eso.
3. Crear el árbol de carpetas de la sección 3.
4. Copiar `es_client.py` y `ml_api.py` desde la v1 a `backend/`.
5. `config.py` nuevo, partiendo del de la v1.
6. `README.md` semilla.

**Terminado cuando:** `git status` no lista ningún `.parquet` y la carpeta de la
v1 sigue igual que antes (verificable con `git status` en su propio repo, o
comparando fechas de modificación).

---

### ✅ Fase 1 · Backend Flask — 3 h

1. `requirements.txt`: `flask`, `flask-cors`, `elasticsearch`, `requests`.
2. `scoring.py`: `interpretar_confianza` con tres niveles (cortes 85 y 70),
   `clave_coord` y `dentro_de_mexico`.
3. `api.py` con las cuatro rutas, siguiendo el estilo de `05_api.py`:
   `@app.route`, validación con un `if`, `jsonify` de vuelta.
4. Caché de predicciones con `@lru_cache(maxsize=256)` sobre la coordenada
   redondeada a 6 decimales. Sin TTL: para una sesión de trabajo sobra.
5. `CORS(app)` en una línea, para poder desarrollar con dos servidores.

**Terminado cuando:** las cuatro rutas responden correctamente y los modos de
fallo que ya probamos en la v1 (HTTP 400 y 500 de la API de Spark, respuesta
no-JSON, campos faltantes, expiración) siguen dando mensajes accionables.

---

### ✅ Fase 2 · Frontend funcional — 7–9 h

Sin diseño todavía: primero que funcione.

1. `npm create vite@latest frontend -- --template react`, más Tailwind.
2. `api.js`: cuatro funciones `async` con `fetch`. Nada más.
3. `App.jsx`: el estado de la pantalla en `useState` — texto de búsqueda,
   resultados, vecinos, selección, predicción, historial.
4. `Mapa.jsx` con react-leaflet y tiles CARTO Voyager, centrado en México.
5. Búsqueda directa: input, llamada a `/api/geocode`, marcador y centrado.
6. Clic en el mapa: `onClick` de react-leaflet → `/api/reverse` → vecinos y
   polilíneas.
7. Botón de análisis → `/api/predict`, con estado de carga visible.
8. Caché de predicciones en el cliente: un `Map` a nivel de módulo, indexado por
   coordenada redondeada. Diez líneas.
9. Historial: un array en `useState`, con la regla de reemplazar en vez de
   duplicar cuando se reanaliza un punto.

**Terminado cuando:** hace todo lo que hace la v1, aunque se vea sin estilo.

---

### ✅ Fase 3 · Diseño y responsividad — 5–6 h

1. Tokens de color de la sección 2 en `tailwind.config.js` y `colores.js`.
2. Barra superior azul marino con los dos semáforos de servicios.
3. `Panel.jsx`: búsqueda, pestañas Resultado · Cercanas · Historial, leyenda.
4. Pines como `divIcon` de Leaflet: círculo del tono pin, icono blanco, anillo
   blanco de 2 px. El icono va como SVG en línea dentro del HTML del `divIcon`.
5. `Tarjetas.jsx`: ficha de dirección y veredicto, con la paleta por nivel.
6. `HojaMovil.jsx`: en pantallas estrechas el mapa ocupa todo y el panel se
   convierte en hoja inferior deslizable. Se resuelve con CSS y un `useState`
   de tres posiciones; sin librería de gestos.

**Terminado cuando:** coincide con la maqueta en escritorio y en teléfono, y el
icono sobre cada pin supera 3:1 de contraste.

---

### ✅ Fase 4 · Arranque y acceso desde el teléfono — 2–3 h

1. Instalar Node 20 LTS. **No viene en la distribución Portable del laboratorio.**
2. `vite build` con salida a `backend/static/`; Flask la sirve con
   `send_from_directory`. Un solo puerto, sin CORS en producción.
3. Levantar Flask con `host='0.0.0.0'`.
4. El frontend llama al backend por **IP local del Mac**, no por `localhost`:
   variable `VITE_API_BASE` leída en build.
5. Permitir el puerto en el firewall de macOS.
6. Documentar los comandos en el README con el mismo criterio que la v1: rutas
   completas, sin suponer qué `python3` está en el `PATH`.

**Terminado cuando:** la app se abre desde el teléfono en la misma red Wi-Fi y
la búsqueda y la predicción funcionan.

---

### ✅ Fase 5 · Pruebas y documentación — 3 h

1. Copiar las suites de la v1 que siguen aplicando (`es_client`, `ml_api`,
   umbrales) y adaptarlas a los tres niveles.
2. Añadir pruebas de las cuatro rutas con el cliente de pruebas de Flask.
3. README definitivo, con el mismo enfoque amigable que el de la v1.
4. Regenerar el diagrama de arquitectura en `docs/`.
5. Mover este plan a `docs/PLAN.md`.

**Terminado cuando:** `bash tests/run_all.sh` pasa en limpio y alguien sin
contexto puede levantar la app siguiendo solo el README.

---

## 6. Esfuerzo total

| Fase | Esfuerzo |
|---|---|
| 0 · Andamiaje | 1.5 h |
| 1 · Backend Flask | 3 h |
| 2 · Frontend funcional | 7–9 h |
| 3 · Diseño | 5–6 h |
| 4 · Arranque | 2–3 h |
| 5 · Pruebas y docs | 3 h |
| **Total** | **21–26 h** |

Menos que la estimación anterior: Flask y JavaScript quitan capas, y no hay que
migrar nada porque la v1 se queda donde está.

---

## 7. Riesgos y cosas que no mejoran

**La latencia de la inferencia es la misma.** Sigue siendo Spark recalculando
features contra el DENUE y el Censo nacional en cada punto nuevo. React no toca
ese cuello de botella. Mejorarlo de verdad es otro proyecto: precalcular las
features de una malla y que el endpoint solo busque el punto más cercano.

**Node no está en el laboratorio.** Es el único requisito nuevo que hay que
instalar aparte.

**Los tiles de CARTO tienen un plan gratuito** pensado para uso razonable.
Suficiente para un proyecto de curso; si algún día crece, hay que revisarlo.

**`JAVA_HOME` del laboratorio apunta mal.** `entorno_cli.sh` lo define como
`$BDPV5_ROOT/common_jdk`, pero en macOS el JDK está en
`common_jdk/zulu-11.jdk/Contents/Home`. Cualquier script que arranque Spark
tiene que corregirlo.

**Los datos nunca van al repo.** `geocoder_mexico_completo.parquet` pesa 886 MB
e `integrado_ne.parquet` 1.6 GB; GitHub rechaza archivos de más de 100 MB. Se
regeneran con los notebooks del curso.

**La v2 depende de la v1 para arrancar.** Ambas necesitan el mismo índice de
Elasticsearch y la misma API de Spark. No compiten: pueden convivir en puertos
distintos.

---

## 8. Diferencias con lo planeado

Lo que cambió durante la implementación, y por qué:

- **9 archivos en el frontend en vez de 7.** `formato.js` e `historial.js` se
  fusionaron en `lib.js` como estaba previsto, pero el diseño pidió `colores.js`
  y `HojaMovil.jsx`. `App.jsx` llegó a 265 líneas.
- **`api.py` llegó a 244 líneas**, por las rutas de estáticos y el bloque de
  arranque que anuncia la IP local.
- **Sin Vitest.** Las pruebas del frontend usan `node:assert` y se ejecutan con
  `node` a secas: una dependencia menos y el mismo resultado.
- **Se añadieron dos suites no previstas**: `test_estaticos.py`, porque servir
  el frontend desde Flask puede tapar las rutas `/api` en silencio, y
  `test_coherencia.mjs`, para comprobar que Python y JavaScript redondean las
  coordenadas igual.
- **Un bug encontrado por las pruebas**: `ml_api.salud()` y `predecir()` tenían
  `config.API_URL` como valor por defecto, que Python evalúa al importar. Ahora
  `api.py` pasa la URL explícitamente.

---

## 9. Antes de empezar la Fase 0

- [ ] Repo creado en GitHub, privado, con `.gitignore` de Python
- [ ] Clonado en local y ruta compartida para poder trabajar en él
- [ ] `.gitignore` ampliado y commiteado **antes** de crear archivos
- [ ] Node 20 LTS instalado (se necesita en la Fase 2)
- [ ] Confirmado que la carpeta de la v1 no se toca en ningún paso
