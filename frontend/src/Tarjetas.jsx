import { NIVELES, ORDEN_NIVELES, ACENTO, tonos, svgIcono } from './colores.js'
import { formatearDistancia, formatearSegundos, etiquetaDeClase, conteoPorNivel } from './lib.js'

// Icono como elemento de React, para la leyenda y las tarjetas.
function Icono({ clase, color, tamano = 16 }) {
  return (
    <span
      className="inline-flex shrink-0"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgIcono(clase, color, tamano) }}
    />
  )
}

export function FichaDireccion({ direccion, orden, compacta }) {
  return (
    <div
      className="border-l-[3px] bg-slate-50 px-3 py-2.5"
      style={{ borderColor: ACENTO }}
    >
      {direccion.distancia_km !== null && direccion.distancia_km !== undefined && (
        <span
          className="mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
          style={{ backgroundColor: ACENTO }}
        >
          a {formatearDistancia(direccion.distancia_km)}
        </span>
      )}
      <div className="text-[13px] font-medium leading-snug text-slate-900">
        {orden ? (
          <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-700 text-[10px] text-white">
            {orden}
          </span>
        ) : null}
        {direccion.direccion_completa}
      </div>
      {!compacta && (
        <dl className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
          <div>
            <span className="text-slate-500">Municipio:</span> {direccion.municipio}
          </div>
          <div>
            <span className="text-slate-500">Entidad:</span> {direccion.estado}
          </div>
          <div>
            <span className="text-slate-500">C.P.:</span> {direccion.cp}
          </div>
          <div className="font-mono" style={{ color: ACENTO }}>
            {direccion.lat.toFixed(6)}, {direccion.lon.toFixed(6)}
          </div>
        </dl>
      )}
    </div>
  )
}

export function TarjetaPrediccion({ prediccion }) {
  const t = tonos(prediccion.nivel)
  const ancho = Math.min(Math.max(prediccion.confianza, 0), 100)

  return (
    <div
      className="border-l-[3px] px-3 py-2.5"
      style={{ backgroundColor: t.fondo, borderColor: t.base }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-2 ring-white"
          style={{ backgroundColor: t.pin }}
        >
          <Icono clase={prediccion.clase} color="#fff" tamano={15} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: t.texto }}>
            {t.etiqueta}
          </div>
          <div className="text-[13px] font-medium leading-tight" style={{ color: t.texto }}>
            {etiquetaDeClase(prediccion.clase)}
          </div>
        </div>
      </div>

      <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: '#ffffff90' }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${ancho}%`, backgroundColor: t.base }}
        />
      </div>

      <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: t.texto }}>
        <span>Confianza {prediccion.confianza.toFixed(2)}%</span>
        <span className="opacity-75">{formatearSegundos(prediccion.segundos)}</span>
      </div>
    </div>
  )
}

// Leyenda de los tres niveles, con cuantas ubicaciones hay en cada uno.
export function Leyenda({ historial }) {
  const conteo = conteoPorNivel(historial)
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">
        Potencial de negocio
      </div>
      <ul className="divide-y divide-slate-100 border-y border-slate-100">
        {ORDEN_NIVELES.map((nivel) => {
          const t = NIVELES[nivel]
          return (
            <li key={nivel} className="flex items-center gap-2.5 py-1.5">
              <span
                className="h-4 w-4 shrink-0 rounded-full ring-2 ring-white"
                style={{ backgroundColor: t.pin }}
              />
              <span className="text-[12px] text-slate-800">{t.etiqueta}</span>
              <span className="ml-auto text-[11px] text-slate-400">{t.umbral}</span>
              <span className="w-4 text-right text-[11px] font-medium text-slate-600">
                {conteo[nivel] || ''}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Icono clase="OXXO" color="#5F5E5A" tamano={14} /> Conveniencia
        </span>
        <span className="flex items-center gap-1.5">
          <Icono clase="Abarrotes" color="#5F5E5A" tamano={14} /> Abarrotes
        </span>
      </div>
    </div>
  )
}

export function TablaHistorial({ historial, alLimpiar, alSeleccionar }) {
  if (historial.length === 0) {
    return (
      <p className="text-[12px] text-slate-500">
        Aún no has analizado ninguna ubicación. Busca una dirección o haz clic en
        el mapa, y pulsa «Analizar potencial de negocio».
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {historial.map((h) => {
        const t = tonos(h.nivel)
        return (
          <button
            key={`${h.lat},${h.lon}`}
            onClick={() => alSeleccionar(h)}
            className="flex items-center gap-2.5 border-l-[3px] px-2.5 py-2 text-left hover:brightness-95"
            style={{ backgroundColor: t.fondo, borderColor: t.base }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ring-white"
              style={{ backgroundColor: t.pin }}
            >
              <Icono clase={h.clase} color="#fff" tamano={13} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium" style={{ color: t.texto }}>
                {h.direccion}
              </span>
              <span className="block text-[11px]" style={{ color: t.texto, opacity: 0.8 }}>
                {h.municipio} · {h.confianza.toFixed(1)}%
              </span>
            </span>
          </button>
        )
      })}
      <button
        onClick={alLimpiar}
        className="border border-slate-300 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50"
      >
        Limpiar historial
      </button>
    </div>
  )
}
