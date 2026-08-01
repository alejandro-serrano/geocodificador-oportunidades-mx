// Fichas de datos.
//
// Escala tipografica:
//   19px  veredicto del modelo (Sora)
//   16px  cuerpo: direcciones, botones, entradas
//   14px  secundario: municipio, entidad, metadatos
//   12px  rotulos en mayusculas
import { NIVELES, ORDEN_NIVELES, ACENTO, TEAL, tonos, svgIcono } from './colores.js'
import { formatearDistancia, formatearSegundos, etiquetaDeClase, conteoPorNivel } from './lib.js'

function Icono({ clase, color, tamano = 18 }) {
  return (
    <span
      className="inline-flex shrink-0"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgIcono(clase, color, tamano) }}
    />
  )
}

function Pin() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="10" r="2.6" fill="currentColor" />
    </svg>
  )
}

// Ficha de una direccion. La franja de color a la izquierda la ancla
// visualmente; los datos van en rejilla para poder leerlos de un vistazo.
export function FichaDireccion({ direccion, orden }) {
  const hayDistancia = direccion.distancia_km !== null && direccion.distancia_km !== undefined

  return (
    <div className="tarjeta flex overflow-hidden">
      <div
        className="w-[5px] shrink-0"
        style={{ background: `linear-gradient(180deg, ${ACENTO}, ${TEAL})` }}
      />
      <div className="min-w-0 flex-1 px-4 py-4">
        {(orden || hayDistancia) && (
          <div className="mb-2 flex items-center gap-2">
            {orden ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[11px] font-medium text-white">
                {orden}
              </span>
            ) : null}
            {hayDistancia && (
              <span className="text-[13px] font-medium" style={{ color: TEAL }}>
                a {formatearDistancia(direccion.distancia_km)}
              </span>
            )}
          </div>
        )}

        <p className="text-[15px] font-medium leading-relaxed text-[#1E2A45]">
          {direccion.direccion_completa}
        </p>

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {[
            ['Municipio', direccion.municipio],
            ['Entidad', direccion.estado],
            ['C.P.', direccion.cp],
          ].map(([r, v]) => (
            <div key={r} className="min-w-0">
              <div className="rotulo text-[10px]">{r}</div>
              <div className="truncate text-[13px] font-medium text-[#1E2A45]" title={v}>
                {v || '—'}
              </div>
            </div>
          ))}
        </div>

        <div
          className="coordenada mt-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-medium"
          style={{ backgroundColor: '#EAF1FB', color: '#17233F' }}
        >
          <span style={{ color: ACENTO }}>
            <Pin />
          </span>
          {direccion.lat.toFixed(6)}, {direccion.lon.toFixed(6)}
        </div>
      </div>
    </div>
  )
}

export function TarjetaPrediccion({ prediccion }) {
  const t = tonos(prediccion.nivel)
  const ancho = Math.min(Math.max(prediccion.confianza, 0), 100)

  return (
    <div className="tarjeta p-5" style={{ borderLeft: `5px solid ${t.base}` }}>
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: t.fondo, color: t.pin }}
        >
          <Icono clase={prediccion.clase} color={t.pin} tamano={26} />
        </span>
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: t.texto }}>
            {t.etiqueta}
          </div>
          <div className="titulo text-[19px] leading-tight text-[#1E2A45]">
            {etiquetaDeClase(prediccion.clase)}
          </div>
        </div>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: t.fondo }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${ancho}%`, background: `linear-gradient(90deg, ${t.base}, ${t.pin})` }}
        />
      </div>

      <div className="mt-2.5 flex justify-between text-[13px] font-medium text-[#5B6B85]">
        <span>Confianza {prediccion.confianza.toFixed(2)}%</span>
        <span className="coordenada text-[#68758D]">{formatearSegundos(prediccion.segundos)}</span>
      </div>
    </div>
  )
}

export function Leyenda({ historial }) {
  const conteo = conteoPorNivel(historial)
  return (
    <div className="tarjeta p-5">
      <h4 className="titulo mb-3.5 text-[14px] text-[#1E2A45]">Potencial de negocio</h4>
      {ORDEN_NIVELES.map((nivel) => {
        const t = NIVELES[nivel]
        const n = conteo[nivel] || 0
        return (
          <div key={nivel} className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: t.pin }} />
            <span className="flex-1 text-[14px] font-medium text-[#1E2A45]">{t.etiqueta}</span>
            <span className="text-[12.5px] text-[#68758D]">{t.umbral}</span>
            <span
              className="min-w-[26px] rounded-full px-2 py-0.5 text-center text-[12px] font-semibold text-white"
              style={{ backgroundColor: n > 0 ? t.pin : '#CBD3E0' }}
            >
              {n}
            </span>
          </div>
        )
      })}
      <div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-[12.5px] text-[#68758D]">
        <span className="flex items-center gap-2">
          <Icono clase="OXXO" color="#68758D" tamano={16} /> Conveniencia
        </span>
        <span className="flex items-center gap-2">
          <Icono clase="Abarrotes" color="#68758D" tamano={16} /> Abarrotes
        </span>
      </div>
    </div>
  )
}

export function TablaHistorial({ historial, alLimpiar, alSeleccionar }) {
  if (historial.length === 0) {
    return (
      <p className="text-[14px] leading-relaxed text-[#68758D]">
        Aún no has analizado ninguna ubicación. Busca una dirección o toca el mapa,
        y pulsa «Analizar potencial de negocio».
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {historial.map((h) => {
        const t = tonos(h.nivel)
        return (
          <button
            key={`${h.lat},${h.lon}`}
            onClick={() => alSeleccionar(h)}
            className="tarjeta flex items-center gap-3 px-4 py-3 text-left transition-shadow hover:shadow-md"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: t.fondo, color: t.pin }}
            >
              <Icono clase={h.clase} color={t.pin} tamano={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium text-[#1E2A45]">
                {h.direccion}
              </span>
              <span className="block truncate text-[12.5px] text-[#68758D]">{h.municipio}</span>
            </span>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white"
              style={{ backgroundColor: t.pin }}
            >
              {h.confianza.toFixed(0)}%
            </span>
          </button>
        )
      })}
      <button
        onClick={alLimpiar}
        className="rounded-[14px] border border-slate-200 py-2.5 text-[14px] font-medium text-[#5B6B85] hover:bg-slate-50"
      >
        Limpiar historial
      </button>
    </div>
  )
}
