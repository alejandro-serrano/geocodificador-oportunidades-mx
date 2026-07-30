# Geocodificador de Oportunidades · México

Busca cualquiera de los 33.6 millones de domicilios de México en un mapa, y
estima con un modelo de aprendizaje automático si una ubicación tiene más
potencial para una tienda de conveniencia o para una tienda de abarrotes.

Funciona por completo en tu computadora: no envía nada a internet.

---

## Cómo está organizado

![Arquitectura](docs/arquitectura.svg)

```
backend/     Python + Flask · consulta Elasticsearch y llama al modelo
frontend/    React + Leaflet · el mapa y la interfaz
docs/        plan de implementación y diagrama de arquitectura
tests/       lanzador de toda la batería de pruebas
```

El backend expone cuatro rutas y el frontend las consume. El frontend se compila
a `backend/static/` y Flask lo sirve, así que **todo corre en un solo puerto**.

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | Estado de Elasticsearch y de la API de Spark |
| `GET /api/geocode?q=…` | Dirección en texto libre → coordenadas |
| `GET /api/reverse?lat=…&lon=…` | Coordenadas → direcciones más cercanas |
| `POST /api/predict` | Coordenadas → potencial de negocio |

---

## Cómo levantarlo

Este backend usa su **propio entorno virtual**, aislado del laboratorio. Solo
necesita cuatro paquetes (`flask`, `flask-cors`, `elasticsearch`, `requests`):
no toca Spark, se comunica con él por HTTP. Así, instalar dependencias aquí no
puede romper los cuadernos del curso.

### Una sola vez

Instala Node 20 LTS desde <https://nodejs.org> — no viene con el laboratorio.
Después:

```bash
cd ~/dev/geocodificador-oportunidades-mx

# Entorno virtual, usando el Python 3.10 del laboratorio como base
~/bdp/portable/python/bin/python3 -m venv .venv
.venv/bin/python3 -m pip install -r backend/requirements.txt

# Frontend
cd frontend && npm install && npm run build
```

El `build` deja el frontend compilado dentro de `backend/static/`.

> No hace falta «activar» nada: todos los comandos llaman a
> `.venv/bin/python3` por su ruta, así no hay estado que recordar.

### Cada vez

1. Abre **Big Data Lab** → **Servicios** → **Iniciar TODO**, y espera a que todos
   digan **Sano**.
2. *(Opcional, para el análisis de negocio)* levanta la API de Spark. **Esta sí
   usa el Python del laboratorio**, porque necesita PySpark y Sedona:

   ```bash
   cd ~/bdp/portable/notebooks
   JAVA_HOME=~/bdp/portable/common_jdk/zulu-11.jdk/Contents/Home ~/bdp/portable/python/bin/python3 05_api.py
   ```

3. Arranca la aplicación:

   ```bash
   cd ~/dev/geocodificador-oportunidades-mx
   .venv/bin/python3 backend/api.py
   ```

Abre <http://localhost:8000>.

### Qué intérprete usa cada cosa

| Proceso | Intérprete | Por qué |
|---|---|---|
| `backend/api.py` | `.venv/bin/python3` | Solo necesita Flask y el cliente de Elasticsearch |
| Pruebas | `.venv/bin/python3` | Las mismas dependencias |
| `05_api.py` *(del laboratorio)* | `~/bdp/portable/python/bin/python3` | Necesita PySpark, Sedona y el JDK |

### Desde el teléfono

Al arrancar, `api.py` imprime la dirección que hay que escribir en el teléfono:

```
En esta computadora : http://localhost:8000
Desde el teléfono   : http://192.168.1.10:8000
```

Solo necesitas que ambos estén en la misma red Wi-Fi. La primera vez, macOS
preguntará si permites conexiones entrantes: acepta.

No hace falta configurar nada más. Como el frontend se sirve desde el mismo
puerto que la API, las llamadas van al mismo origen y funcionan con cualquier
dirección.

### Para desarrollar

Con dos servidores, los cambios del frontend se recargan al instante:

```bash
cd frontend && cp .env.example .env.local   # una vez
npm run dev                                  # puerto 5173
```

En otra terminal, el backend como arriba. Aquí sí hace falta `VITE_API_BASE`,
porque son dos orígenes distintos.

---

### Si algo falla

**`ModuleNotFoundError: No module named 'flask'`.** Estás usando `python3` a
secas en vez del entorno virtual. Los comandos empiezan con `.venv/bin/python3`
justamente por eso. Si el entorno aún no existe, créalo con el bloque de «Una
sola vez».

**`ModuleNotFoundError: No module named 'pyspark'` al arrancar `05_api.py`.**
Ese script necesita el Python del laboratorio, no el entorno virtual de este
repositorio. Ver la tabla de intérpretes.

**`JAVA_HOME is not set` o `Java gateway process exited`.** Le falta el prefijo
`JAVA_HOME=…` al comando de `05_api.py`. Pega el bloque completo, las dos
líneas. El `entorno_cli.sh` del laboratorio define mal esa variable en macOS:
el JDK está en `common_jdk/zulu-11.jdk/Contents/Home`.

**La raíz devuelve 503 diciendo que falta compilar.** Ejecuta `npm run build`
dentro de `frontend/`. Las rutas `/api/…` funcionan igual mientras tanto.

---

## Qué necesita para funcionar

Esta aplicación no reemplaza al laboratorio de Big Data del curso: lo usa.

| Servicio | Puerto | Para qué |
|---|---|---|
| Elasticsearch | 9200 | Buscar direcciones en el índice `geocoder_mexico` |
| API de Spark (`05_api.py`) | 5001 | Predecir el potencial de negocio |
| HDFS | 9000 | De donde la API lee el modelo y los datos |

Si la API de Spark no está activa, **la búsqueda de direcciones sigue
funcionando**: solo se deshabilita el botón de análisis. La barra superior
muestra el estado de ambos servicios.

El índice se puebla una sola vez con los cuadernos `01_ProcesarDirecciones` y
`02_IndexacionGeoespacial` del laboratorio.

**Los datos no están en este repositorio.** El parquet de domicilios pesa
886 MB y los del DENUE y el Censo suman más de 2 GB; se regeneran con esos
cuadernos.

## Relación con la versión 1

Existe una primera versión construida con Streamlit, que se entrega como
proyecto final del curso y **permanece intacta** en el laboratorio. Esta versión
2 es un desarrollo aparte: separa el backend del frontend y rediseña la
interfaz. Ambas comparten los mismos servicios y pueden convivir.

## Pruebas

Corren **sin** Elasticsearch, HDFS ni Spark: Elasticsearch se simula y la API de
inferencia se sustituye por un servidor que reproduce sus modos de fallo
(HTTP 400 y 500, respuesta no-JSON, campos faltantes, expiración).

```bash
PY=.venv/bin/python3 bash tests/run_all.sh
```

Cinco suites:

| Suite | Qué comprueba |
|---|---|
| `test_scoring.py` | Umbrales en sus fronteras exactas y criterio de coordenada |
| `test_api.py` | Las cuatro rutas, sus códigos de error y la caché |
| `test_estaticos.py` | Que `/api/…` no lo absorba el servidor de archivos |
| `test_coherencia.mjs` | Que Python y JavaScript redondeen las coordenadas igual |
| `test_frontend.mjs` | Lógica, contraste de colores y `api.js` contra el backend real |

## Decisiones de diseño

**El color dice el potencial, el icono dice el tipo de tienda.** Son dos canales
independientes, así el mapa responde a la vez «¿hay oportunidad aquí?» y «¿de
qué tipo?». El nivel (alto / medio / bajo) lo calcula el backend, de modo que
los umbrales viven en un solo sitio.

**El análisis se dispara con un botón, no al seleccionar.** Cada predicción
ocupa Spark decenas de segundos recalculando features contra el DENUE y el
Censo nacional; lanzarla en cada clic haría la aplicación inservible.

**Tres cachés con el mismo criterio de coordenada.** Backend, cliente e
historial redondean a seis decimales (≈ 11 cm). Si discreparan, un punto podría
estar cacheado en un sitio y no en otro; hay una prueba que lo verifica
comparando ambos lenguajes sobre 5 000 coordenadas.

**Un fallo de la API nunca tumba la geocodificación.** Los códigos HTTP separan
la culpa: 400 si la petición está mal, 502 si falló la API de Spark, 503 si no
responde Elasticsearch.

## Créditos

Proyecto de la materia *Aprendizaje Automático para Grandes Volúmenes de Datos*,
Universidad Panamericana · Campus Aguascalientes.

El laboratorio de Big Data, los cuadernos del curso y la API de inferencia
(`05_api.py`) son material del **Dr. Abel Coronado** y no forman parte de este
repositorio.

Los datos del DENUE y del Censo de Población y Vivienda 2020 son del **INEGI**,
publicados bajo sus términos de libre uso.

## Licencia

MIT. Cubre únicamente el código de este repositorio.
