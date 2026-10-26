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
export const IconoBuscar = p => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
