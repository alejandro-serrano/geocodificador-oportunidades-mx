import { useRef, useState } from 'react'

// Hoja inferior deslizable para telefono.
//
// El mapa ocupa toda la pantalla y el panel sube desde abajo, como en las apps
// de mapas. Tres posiciones fijas; se cambia arrastrando el tirador o tocandolo.
//
// Sin libreria de gestos: son dos eventos tactiles y un useState. Anadir una
// dependencia para esto no compensa.

const POSICIONES = [
  { id: 'minima', alto: '18%' },
  { id: 'media', alto: '55%' },
  { id: 'completa', alto: '92%' },
]

// Cuanto hay que arrastrar para saltar de posicion, en pixeles.
const UMBRAL_ARRASTRE = 60

export default function HojaMovil({ children }) {
  const [indice, setIndice] = useState(1) // arranca a media altura
  const [arrastre, setArrastre] = useState(0)
  const inicioY = useRef(null)

  function alEmpezar(e) {
    inicioY.current = e.touches[0].clientY
  }

  function alMover(e) {
    if (inicioY.current === null) return
    setArrastre(e.touches[0].clientY - inicioY.current)
  }

  function alSoltar() {
    if (inicioY.current === null) return
    // Arrastrar hacia arriba (delta negativo) sube una posicion.
    if (arrastre < -UMBRAL_ARRASTRE) setIndice((i) => Math.min(i + 1, POSICIONES.length - 1))
    else if (arrastre > UMBRAL_ARRASTRE) setIndice((i) => Math.max(i - 1, 0))
    inicioY.current = null
    setArrastre(0)
  }

  // Tocar el tirador cicla entre las tres posiciones: una alternativa al
  // gesto, por si arrastrar resulta incomodo.
  function alTocar() {
    setIndice((i) => (i + 1) % POSICIONES.length)
  }

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col rounded-t-2xl bg-white shadow-[0_-2px_16px_rgba(0,0,0,0.18)] transition-[height] duration-200"
      style={{ height: POSICIONES[indice].alto }}
    >
      <div
        onTouchStart={alEmpezar}
        onTouchMove={alMover}
        onTouchEnd={alSoltar}
        onClick={alTocar}
        role="button"
        tabIndex={0}
        aria-label="Cambiar el alto del panel"
        className="flex shrink-0 cursor-grab touch-none justify-center py-2.5"
      >
        <span className="h-1 w-10 rounded-full bg-slate-300" />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
