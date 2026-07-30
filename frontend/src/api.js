// Las cuatro llamadas al backend. Nada más.
//
// En desarrollo el frontend corre en el puerto 5173 y el backend en el 8000,
// asi que hay que decirle donde esta. En produccion se compila dentro de
// backend/static/ y comparte origen, por eso el valor por defecto es '' (rutas
// relativas). Para verlo desde el telefono, VITE_API_BASE debe apuntar a la IP
// local del Mac, no a localhost.
const BASE = import.meta.env?.VITE_API_BASE ?? ''

// Misma precision que scoring.clave_coord en el backend: 6 decimales ~ 11 cm.
// Tienen que coincidir, o la cache del cliente y la del servidor discreparian
// sobre que cuenta como "el mismo punto".
const DECIMALES = 6

async function pedir(ruta, opciones) {
  let respuesta
  try {
    respuesta = await fetch(BASE + ruta, opciones)
  } catch {
    throw new Error('No se pudo contactar el servidor. ¿Está corriendo api.py?')
  }

  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    // El backend siempre devuelve un mensaje accionable en 'error'.
    throw new Error(datos.error || `El servidor respondió ${respuesta.status}.`)
  }
  return datos
}

export function estadoServicios() {
  return pedir('/api/health')
}

export async function geocodificar(texto, size = 5) {
  const datos = await pedir(`/api/geocode?q=${encodeURIComponent(texto)}&size=${size}`)
  return datos.resultados
}

export function inverso(lat, lon, size = 3) {
  return pedir(`/api/reverse?lat=${lat}&lon=${lon}&size=${size}`)
}

// --- Cache de predicciones ---------------------------------------------------
// El backend ya memoiza, pero cachear aqui tambien evita el viaje de red: una
// ubicacion ya analizada aparece al instante. Importa para la demo, donde se
// vuelve varias veces sobre los mismos puntos.
const cachePredicciones = new Map()

function clave(lat, lon) {
  return `${lat.toFixed(DECIMALES)},${lon.toFixed(DECIMALES)}`
}

export async function predecir(lat, lon) {
  const k = clave(lat, lon)
  if (cachePredicciones.has(k)) return cachePredicciones.get(k)

  const prediccion = await pedir('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon }),
  })

  // Solo se guarda lo que salio bien: un error debe poder reintentarse.
  cachePredicciones.set(k, prediccion)
  return prediccion
}

export function estaCacheada(lat, lon) {
  return cachePredicciones.has(clave(lat, lon))
}
