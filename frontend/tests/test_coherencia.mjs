// Coherencia entre los tres sitios que deciden que es "el mismo punto".
//
//   1. backend/scoring.py     clave_coord      -> cache de lru_cache
//   2. frontend/src/api.js    clave interna    -> cache de peticiones
//   3. frontend/src/lib.js    clave            -> historial sin duplicados
//
// Si discreparan, un punto podria estar cacheado en un sitio y no en otro: se
// pediria de nuevo a Spark una prediccion que ya teniamos, o el historial
// mostraria dos entradas para el mismo lugar. Es el tipo de fallo que no da
// error, solo comportamiento raro.
//
// Esta prueba compara el redondeo de JavaScript contra el de Python usando el
// scoring.py de verdad, no una copia.
//
//   node test_coherencia.mjs

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { clave } from '../src/lib.js'

const PY = process.env.PY ?? 'python3'

// Coordenadas escogidas para tensionar el redondeo: fronteras del sexto
// decimal, medios exactos, negativos y valores del propio indice.
const CASOS = [
  [21.88, -102.296],
  [21.880000004, -102.296000004],
  [21.8800005, -102.2960005],
  [21.8800004999, -102.2960004999],
  [22.238153265000147, -102.089117747],
  [19.4326, -99.1332],
  [-0.0000001, -0.0000001],
  [32.5149, -117.0382],
  [14.999999949, -92.200000051],
  [21.9999995, -102.9999995],
]

function clavesPython(pares) {
  // Los pares van por entrada estandar, no por argumentos: con unos pocos
  // miles de coordenadas la linea de comandos supera el limite del sistema
  // y spawnSync falla con E2BIG.
  const guion = `
import sys, json
sys.path.insert(0, "../../backend")
import scoring
pares = json.loads(sys.stdin.read())
print(json.dumps(["%.6f,%.6f" % scoring.clave_coord(a, b) for a, b in pares]))
`
  const salida = execFileSync(PY, ['-c', guion], {
    cwd: new URL('.', import.meta.url).pathname,
    input: JSON.stringify(pares),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return JSON.parse(salida)
}

const enPython = clavesPython(CASOS)
const enJs = CASOS.map(([lat, lon]) => clave(lat, lon))

let discrepancias = 0
for (let i = 0; i < CASOS.length; i++) {
  if (enPython[i] !== enJs[i]) {
    discrepancias++
    console.log(`   ✖ ${CASOS[i]}  python=${enPython[i]}  js=${enJs[i]}`)
  }
}

assert.equal(
  discrepancias,
  0,
  `${discrepancias} coordenadas se redondean distinto en Python y JavaScript`,
)
console.log(`OK las ${CASOS.length} coordenadas dan la misma clave en Python y JavaScript`)

// Los pares que deben colapsar en la misma clave, colapsan en ambos lenguajes.
assert.equal(enJs[0], enJs[1], 'js: 11 cm deberia ser el mismo punto')
assert.equal(enPython[0], enPython[1], 'python: 11 cm deberia ser el mismo punto')
console.log('OK una diferencia de 11 cm colapsa en ambos lenguajes')

// Y los que no deben colapsar, no colapsan.
assert.notEqual(clave(21.88, -102.296), clave(21.881, -102.296))
console.log('OK una diferencia de 100 m no colapsa')

// --- Barrido -----------------------------------------------------------------
// Python redondea al par mas cercano y JavaScript no, asi que en teoria podrian
// discrepar en un empate exacto. En la practica no ocurre: un valor decimal
// arbitrario nunca cae exactamente en x.xxxxxx5 al representarse en binario.
// Este barrido lo comprueba en vez de darlo por hecho.
const aleatorias = []
for (let i = 0; i < 4000; i++) {
  aleatorias.push([14 + Math.random() * 19, -118 + Math.random() * 32])
}
// Casos adversarios: construidos para caer justo en el septimo decimal.
for (let i = 0; i < 1000; i++) {
  const dec = Math.floor(Math.random() * 1000000) / 1000000
  aleatorias.push([21 + dec + 0.0000005, -(102 + dec + 0.0000005)])
}

const pyBarrido = clavesPython(aleatorias)
let discrepan = 0
for (let i = 0; i < aleatorias.length; i++) {
  if (pyBarrido[i] !== clave(aleatorias[i][0], aleatorias[i][1])) discrepan++
}
assert.equal(discrepan, 0, `${discrepan} de ${aleatorias.length} coordenadas discrepan`)
console.log(`OK ${aleatorias.length} coordenadas mas (aleatorias y adversarias) coinciden`)

console.log('\nCOHERENCIA DE CACHES VERIFICADA')
