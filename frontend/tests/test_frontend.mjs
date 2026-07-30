// Pruebas de la logica del frontend.
//
// Dos partes:
//   1. Logica pura (historial, formato), sin red.
//   2. api.js contra el backend Flask real, levantado con Elasticsearch
//      simulado por servidor_de_prueba.py.
//
//   node test_frontend.mjs

import assert from 'node:assert/strict'
import { registrar, clave, HISTORIAL_MAX, conteoPorNivel,
         formatearDistancia, formatearSegundos, etiquetaDeClase } from '../src/lib.js'
import { NIVELES, ORDEN_NIVELES, tonos, svgIcono, trazoDeClase } from '../src/colores.js'

const ok = (msg) => console.log('OK', msg)

// ============================================================================
// 1. Historial
// ============================================================================
function pruebaHistorial() {
  const E = (lat, lon, clase = 'OXXO', confianza = 87, nivel = 'alto') => ({
    lat, lon, clase, confianza, nivel, municipio: 'ASIENTOS', direccion: `DIR ${lat}`,
  })

  // No muta la lista recibida
  const h0 = [E(21, -102)]
  registrar(h0, E(22, -102))
  assert.equal(h0.length, 1)
  ok('registrar es puro (no muta)')

  // El mas reciente encabeza
  let h = []
  for (const lat of [21, 22, 23]) h = registrar(h, E(lat, -102))
  assert.deepEqual(h.map((e) => e.lat), [23, 22, 21])
  ok('el analisis mas reciente encabeza el historial')

  // Reanalizar reemplaza, no duplica
  h = registrar(h, E(21, -102, 'Abarrotes', 63))
  assert.equal(h.length, 3)
  assert.equal(h[0].lat, 21)
  assert.equal(h[0].clase, 'Abarrotes')
  assert.equal(h.filter((e) => e.lat === 21).length, 1)
  ok('reanalizar un punto lo reemplaza y lo sube al frente')

  // Diferencia sub-milimetrica: mismo punto
  h = registrar(h, E(21.000000004, -102, 'OXXO', 90))
  assert.equal(h.length, 3)
  assert.equal(h.filter((e) => Math.abs(e.lat - 21) < 1e-6).length, 1)
  ok('coincide con el criterio de la cache: mismo punto, misma entrada')

  // Limite
  h = []
  for (let i = 0; i < 15; i++) h = registrar(h, E(20 + i, -102))
  assert.equal(h.length, HISTORIAL_MAX)
  assert.equal(h[0].lat, 34)
  assert.equal(h[h.length - 1].lat, 25)
  ok(`limite de ${HISTORIAL_MAX}: conserva los mas recientes`)

  // La clave usa 6 decimales, igual que el backend
  assert.equal(clave(21.88, -102.296), '21.880000,-102.296000')
  assert.notEqual(clave(21.88, -102.296), clave(21.881, -102.296))
  ok('clave con 6 decimales, igual que scoring.clave_coord')
}

// ============================================================================
// 2. Formato
// ============================================================================
function pruebaFormato() {
  const casos = [
    [null, '—'], [0, '0 m'], [0.0432, '43 m'], [0.9994, '999 m'],
    [1, '1.00 km'], [4.567, '4.57 km'], [12.34, '12.3 km'],
  ]
  for (const [km, esperado] of casos) {
    assert.equal(formatearDistancia(km), esperado, `${km}`)
  }
  ok(`formatearDistancia: ${casos.map(([k]) => formatearDistancia(k)).join(' · ')}`)

  assert.equal(formatearSegundos(0.0004), '0 ms')
  assert.equal(formatearSegundos(0.042), '42 ms')
  assert.equal(formatearSegundos(42.1), '42.1 s')
  ok('formatearSegundos distingue acierto de cache de llamada real')

  assert.equal(etiquetaDeClase('OXXO'), 'Tienda de conveniencia')
  assert.equal(etiquetaDeClase('Abarrotes'), 'Tienda de abarrotes')
  assert.equal(etiquetaDeClase('Otra'), 'Otra')
  ok('etiquetaDeClase traduce las dos clases del modelo')
}

// ============================================================================
// 3. api.js contra el backend real
// ============================================================================
async function pruebaApi(base) {
  process.env.VITE_API_BASE = base
  // api.js lee import.meta.env, que en node no existe: se le pasa la base
  // reescribiendo fetch para prefijar la URL.
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = (url, opciones) =>
    fetchOriginal(url.startsWith('http') ? url : base + url, opciones)

  const api = await import('../src/api.js')

  const salud = await api.estadoServicios()
  assert.equal(salud.elasticsearch.ok, true)
  assert.equal(salud.api_spark.ok, true)
  ok(`estadoServicios -> ${salud.elasticsearch.mensaje}`)

  const resultados = await api.geocodificar('Heroe de Nacozari 2301')
  assert.ok(resultados.length > 0)
  assert.match(resultados[0].direccion_completa, /^AV HEROE/)
  assert.equal(resultados[0].lat, 21.88)
  ok(`geocodificar -> ${resultados[0].direccion_completa.slice(0, 34)}`)

  const inv = await api.inverso(22.2381, -102.0891, 3)
  const distancias = inv.resultados.map((r) => r.distancia_km)
  assert.deepEqual(distancias, [...distancias].sort((a, b) => a - b))
  assert.equal(inv.fuera_de_mexico, false)
  ok(`inverso -> ${inv.resultados.length} vecinos, el mas cercano a ${formatearDistancia(distancias[0])}`)

  const fuera = await api.inverso(40.7128, -74.006, 3)
  assert.equal(fuera.fuera_de_mexico, true)
  ok('inverso marca los puntos fuera de Mexico')

  // --- Prediccion y cache ---
  assert.equal(api.estaCacheada(21.88, -102.296), false)
  const p1 = await api.predecir(21.88, -102.296)
  assert.equal(p1.clase, 'OXXO')
  assert.equal(p1.nivel, 'alto')
  assert.equal(api.estaCacheada(21.88, -102.296), true)
  ok(`predecir -> ${p1.clase} ${p1.confianza}% · nivel ${p1.nivel}`)

  // La segunda vez no debe salir a la red
  let peticiones = 0
  globalThis.fetch = (url, opciones) => {
    peticiones++
    return fetchOriginal(url.startsWith('http') ? url : base + url, opciones)
  }
  await api.predecir(21.88, -102.296)
  await api.predecir(21.880000004, -102.296000004)
  assert.equal(peticiones, 0, 'la cache del cliente debio evitar la red')
  ok('repetir un punto (o uno a 11 cm) no vuelve a salir a la red')

  await api.predecir(19.4326, -99.1332)
  assert.equal(peticiones, 1)
  ok('un punto nuevo si sale a la red')

  // --- Errores: mensaje accionable, no "undefined" ---
  try {
    await api.geocodificar('   ')
    assert.fail('debio fallar')
  } catch (e) {
    assert.match(e.message, /dirección/)
    ok(`error de busqueda vacia -> "${e.message}"`)
  }

  globalThis.fetch = fetchOriginal
}


// ============================================================================
// 4. Sistema de color
// ============================================================================
// Contraste WCAG entre dos colores. El minimo para un icono es 3:1.
function luminancia(hex) {
  const canal = (c) => {
    const v = parseInt(hex.slice(c, c + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
}

function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

function pruebaColores() {
  // El icono blanco tiene que leerse sobre los tres tonos de pin.
  for (const nivel of ORDEN_NIVELES) {
    const r = contraste(NIVELES[nivel].pin, '#FFFFFF')
    assert.ok(r >= 3, `icono blanco sobre el pin ${nivel}: ${r.toFixed(2)}:1, se necesita 3:1`)
    console.log(`OK icono blanco sobre pin ${nivel} -> ${r.toFixed(2)}:1`)
  }

  // El texto de cada ficha tiene que leerse sobre su fondo (4.5:1 para texto).
  for (const nivel of ORDEN_NIVELES) {
    const r = contraste(NIVELES[nivel].texto, NIVELES[nivel].fondo)
    assert.ok(r >= 4.5, `texto sobre fondo ${nivel}: ${r.toFixed(2)}:1`)
  }
  console.log('OK texto sobre fondo supera 4.5:1 en los tres niveles')

  // Los tres niveles se distinguen entre si.
  const pines = ORDEN_NIVELES.map((n) => NIVELES[n].pin)
  assert.equal(new Set(pines).size, 3)
  console.log('OK los tres niveles usan pines distintos')

  // tonos() nunca devuelve undefined, aunque el backend mande algo inesperado.
  assert.deepEqual(tonos('alto'), NIVELES.alto)
  assert.deepEqual(tonos('desconocido'), NIVELES.bajo)
  console.log('OK tonos() degrada a "bajo" ante un nivel inesperado')

  // El icono codifica la clase: son dos trazos distintos.
  assert.notEqual(trazoDeClase('OXXO'), trazoDeClase('Abarrotes'))
  const svg = svgIcono('OXXO', '#fff', 17)
  assert.match(svg, /^<svg /)
  assert.match(svg, /stroke="#fff"/)
  assert.ok(!svg.includes('<img'), 'el icono va en linea, sin depender de archivos')
  console.log('OK el icono distingue conveniencia de abarrotes, en SVG en linea')

  // Conteo por nivel para la leyenda
  const h = [
    { nivel: 'alto' }, { nivel: 'alto' }, { nivel: 'medio' }, { nivel: 'bajo' },
  ]
  assert.deepEqual(conteoPorNivel(h), { alto: 2, medio: 1, bajo: 1 })
  assert.deepEqual(conteoPorNivel([]), { alto: 0, medio: 0, bajo: 0 })
  console.log('OK conteoPorNivel alimenta la leyenda')
}

// ============================================================================
const base = process.argv[2] ?? 'http://127.0.0.1:8099'
console.log('── logica pura')
pruebaHistorial()
pruebaFormato()
pruebaColores()
console.log('\n── api.js contra el backend real')
await pruebaApi(base)
console.log('\nTODAS LAS PRUEBAS DEL FRONTEND PASARON')
