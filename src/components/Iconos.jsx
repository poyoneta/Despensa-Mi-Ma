function Svg({ tam = 22, grosor = 2, children }) {
  return (
    <svg aria-hidden="true" width={tam} height={tam} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

export const IconoInicio = p => <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>
export const IconoCaja = p => <Svg {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><path d="M7 15h3" /></Svg>
export const IconoStock = p => <Svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></Svg>
export const IconoCamion = p => <Svg {...p}><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></Svg>
export const IconoEscanear = p => (
  <Svg {...p}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 8v8" /><path d="M11 8v8" /><path d="M14 8v8" /><path d="M17 8v8" />
  </Svg>
)
export const IconoMas = p => <Svg grosor={2.5} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
export const IconoCerrar = p => <Svg {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Svg>
export const IconoSubir = p => <Svg {...p}><path d="M7 17L17 7" /><path d="M8 7h9v9" /></Svg>
export const IconoSalir = p => <Svg {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H4" /></Svg>
export const IconoVolver = p => <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>
export const IconoEnviar = p => <Svg {...p}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
export const IconoRecibo = p => <Svg {...p}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6" /><path d="M9 12h6" /></Svg>
export const IconoLibreta = p => <Svg {...p}><path d="M5 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5z" /><path d="M9 3v18" /><path d="M12 8h4" /><path d="M12 12h4" /></Svg>
export const IconoGrafico = p => <Svg {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></Svg>
export const IconoMenu = p => <Svg {...p}><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></Svg>
export const IconoRayo = p => <Svg {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></Svg>
export const IconoArchivo = p => <Svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M12 18v-6" /><path d="M9 15l3 3 3-3" /></Svg>
export const IconoBuscar = p => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
