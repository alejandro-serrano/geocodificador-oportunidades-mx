// Utilidades puras: formato de presentacion e historial de analisis.
//
// Se separan de los componentes porque no dependen de React y asi se pueden
// probar sin montar nada.

// ============================================================================
// Formato
// ============================================================================

// Distancia legible: metros por debajo de 1 km, kilometros por encima.
export function formatearDistancia(km) {
  if (km === null || km === undefined) return '—'
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(2)} km`
  return `${km.toLocaleString('es-MX', { maximumFractionDigits: 1 })} km`
}

// Latencia legible: milisegundos por debajo de un segundo. Sirve para que se
// note la diferencia entre un acierto de cache y una llamada real a Spark.
export function formatearSegundos(s) {
  if (s === null || s === undefined) return '—'
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`
}

export const ETIQUETA_CLASE = {
  OXXO: 'Tienda de conveniencia',
  Abarrotes: 'Tienda de abarrotes',
}

export function etiquetaDeClase(clase) {
  return ETIQUETA_CLASE[clase] ?? clase
}

// ============================================================================
// Historial
// ============================================================================
export const HISTORIAL_MAX = 10
const DECIMALES = 6

// Mismo criterio de "el mismo punto" que la cache de api.js y que
// scoring.clave_coord en el backend. Los tres tienen que coincidir, o un punto
// podria estar cacheado en un sitio y no en otro.
export function clave(lat, lon) {
  return `${lat.toFixed(DECIMALES)},${lon.toFixed(DECIMALES)}`
}

// Anade un analisis, sin duplicados y con los mas recientes primero.
//
// Reanalizar una coordenada la REEMPLAZA en vez de duplicarla: analizar dos
// veces el mismo punto es una sola observacion, no dos.
//
// Devuelve un array nuevo; no muta el recibido.
export function registrar(historial, entrada, limite = HISTORIAL_MAX) {
  const k = clave(entrada.lat, entrada.lon)
  const resto = historial.filter((e) => clave(e.lat, e.lon) !== k)
  return [entrada, ...resto].slice(0, limite)
}

// Cuenta cuantas ubicaciones del historial hay en cada nivel de potencial.
export function conteoPorNivel(historial) {
  return historial.reduce(
    (acc, e) => ({ ...acc, [e.nivel]: (acc[e.nivel] ?? 0) + 1 }),
    { alto: 0, medio: 0, bajo: 0 },
  )
}
