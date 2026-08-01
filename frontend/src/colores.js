// Sistema visual de la aplicacion.
//
// Dos canales independientes, para que el mapa responda dos preguntas a la vez:
//
//   COLOR  = potencial de negocio (alto / medio / bajo)  ->  ¿hay oportunidad?
//   ICONO  = tipo de tienda (conveniencia / abarrotes)   ->  ¿de que tipo?
//
// El nivel lo decide el backend en scoring.nivel_de_confianza; aqui solo se
// traduce a color. Asi los umbrales viven en un unico sitio.
//
// ---------------------------------------------------------------------------
//
// Todo parte del azul #4777B4 (H214 S43 L49). Los tres niveles conservan sus
// tonos originales -verde, ambar, coral- pero se generaron desde HSL con una
// saturacion cercana a la del azul, para que compartan caracter en vez de
// competir. Las luminosidades se eligieron por contraste medido, no a ojo:
//
//   pin   >= 3:1 contra blanco   (minimo para que se distinga un icono)
//   texto >= 4.5:1 sobre fondo   (minimo para texto normal)
//
// Los valores reales estan en la tabla de abajo; test_frontend.mjs los mide en
// cada ejecucion, asi que si alguien retoca un tono y baja del minimo, falla.

// Cuatro tonos por familia, cada uno con un papel fijo:
//   pin    relleno del marcador, con icono blanco encima
//   base   barra de confianza y borde izquierdo de la tarjeta
//   fondo  interior de la ficha
//   texto  texto sobre ese fondo
export const NIVELES = {
  alto: {
    pin: '#2B8265',    // 4.68:1 contra blanco
    base: '#3FAB87',
    fondo: '#ECF8F4',
    texto: '#20654E',  // 6.36:1 sobre su fondo
    etiqueta: 'Potencial alto',
    umbral: '85% o más',
  },
  medio: {
    pin: '#B58430',    // 3.33:1
    base: '#D29D41',
    fondo: '#FAF4EB',
    texto: '#70501A',  // 6.74:1
    etiqueta: 'Potencial medio',
    umbral: '70% a 84%',
  },
  bajo: {
    pin: '#BB4B3E',    // 5.01:1
    base: '#D26B60',
    fondo: '#FAECEB',
    texto: '#803128',  // 7.65:1
    etiqueta: 'Potencial bajo',
    umbral: 'menos de 70%',
  },
}

export const ORDEN_NIVELES = ['alto', 'medio', 'bajo']

// --- Azules -----------------------------------------------------------------
// ACENTO es el color de marca: botones, bordes activos, enlaces. Sobre el va
// texto blanco, asi que tiene que cumplir 4.5:1 (da 4.60).
export const ACENTO = '#4777B4'
export const ACENTO_HOVER = '#3B659B'

// Barra superior. Mismo tono que el acento, mucho mas profundo.
export const MARINO = '#213E63'
export const MARINO_CLARO = '#B4C9E4'

// Verde azulado de apoyo: acompana al azul en degradados y en las distancias.
// Se oscurecio respecto al tono del boceto (#0F8A9E, 4.08:1) para que el texto
// pequeno que lo usa alcance 4.5:1.
export const TEAL = '#0D7F91'        // 4.71:1 sobre blanco
export const TEAL_CLARO = '#0F8A9E'  // solo decorativo: degradados y filetes

// Grises de la interfaz.
export const TINTA = '#1E2A45'        // 14.26:1
export const TINTA_SUAVE = '#5B6B85'  //  5.40:1
export const TINTA_TENUE = '#68758D'  //  4.65:1 — el boceto usaba #8B96AA (2.98)
export const BORDE = '#E3E8F0'

// Gris neutro para las direcciones sin analizar y el punto consultado.
export const NEUTRO = '#5B6B85'

export function tonos(nivel) {
  return NIVELES[nivel] ?? NIVELES.bajo
}

// --- Iconos ------------------------------------------------------------------
// Trazos simples, legibles a tamaño pequeño. Se insertan como SVG en linea
// dentro del divIcon de Leaflet: asi no dependen de ningun archivo de imagen,
// que es lo que rompe el marcador por defecto al empaquetar.
const TIENDA = '<path d="M3 9.5 L5 4 H19 L21 9.5"/><path d="M4.5 9.5 V20 H19.5 V9.5"/><path d="M9.5 20 V14.5 H14.5 V20"/>'
const CANASTA = '<path d="M4 9 H20 L18 20 H6 Z"/><path d="M8.5 9 L11 3.5"/><path d="M15.5 9 L13 3.5"/>'

export function trazoDeClase(clase) {
  return clase === 'OXXO' ? TIENDA : CANASTA
}

export function svgIcono(clase, color = '#fff', tamano = 18) {
  return (
    `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    trazoDeClase(clase) +
    '</svg>'
  )
}
