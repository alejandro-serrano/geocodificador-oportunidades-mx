// Sistema visual de la aplicacion.
//
// Dos canales independientes, para que el mapa responda dos preguntas a la vez:
//
//   COLOR  = potencial de negocio (alto / medio / bajo)  ->  ¿hay oportunidad?
//   ICONO  = tipo de tienda (conveniencia / abarrotes)   ->  ¿de que tipo?
//
// El nivel lo decide el backend en scoring.nivel_de_confianza; aqui solo se
// traduce a color. Asi los umbrales viven en un unico sitio.

// Cuatro tonos por familia, cada uno con un papel fijo:
//   pin    relleno del marcador, con icono blanco encima
//   base   barra de confianza y borde izquierdo de la tarjeta
//   fondo  interior de la ficha
//   texto  texto sobre ese fondo
//
// Los tres tonos 'pin' superan 3:1 de contraste contra blanco, que es el
// minimo para que un icono se distinga.
export const NIVELES = {
  alto: {
    pin: '#248F6B',
    base: '#2FA37B',
    fondo: '#E8F6F0',
    texto: '#1B6B50',
    etiqueta: 'Potencial alto',
    umbral: '85% o más',
  },
  medio: {
    pin: '#C9841E',
    base: '#E9A23B',
    fondo: '#FDF3E3',
    texto: '#8A5A12',
    etiqueta: 'Potencial medio',
    umbral: '70% a 84%',
  },
  bajo: {
    pin: '#D4574A',
    base: '#E4695C',
    fondo: '#FDEDEB',
    texto: '#96382F',
    etiqueta: 'Potencial bajo',
    umbral: 'menos de 70%',
  },
}

export const ORDEN_NIVELES = ['alto', 'medio', 'bajo']

// Azul marino de la barra superior y los acentos de la interfaz.
export const MARINO = '#042C53'
export const MARINO_CLARO = '#B5D4F4'
export const ACENTO = '#185FA5'

// Gris neutro para las direcciones sin analizar y el punto consultado.
export const NEUTRO = '#5F5E5A'

export function tonos(nivel) {
  return NIVELES[nivel] ?? NIVELES.bajo
}

// --- Iconos ------------------------------------------------------------------
// Trazos simples, legibles a 16 px. Se insertan como SVG en linea dentro del
// divIcon de Leaflet: asi no dependen de ningun archivo de imagen, que es lo
// que rompe el marcador por defecto al empaquetar.
const TIENDA = '<path d="M3 9.5 L5 4 H19 L21 9.5"/><path d="M4.5 9.5 V20 H19.5 V9.5"/><path d="M9.5 20 V14.5 H14.5 V20"/>'
const CANASTA = '<path d="M4 9 H20 L18 20 H6 Z"/><path d="M8.5 9 L11 3.5"/><path d="M15.5 9 L13 3.5"/>'

export function trazoDeClase(clase) {
  return clase === 'OXXO' ? TIENDA : CANASTA
}

export function svgIcono(clase, color = '#fff', tamano = 17) {
  return (
    `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    trazoDeClase(clase) +
    '</svg>'
  )
}
