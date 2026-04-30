import { getStats } from '@/lib/crawler'

export default async function Home() {
  const stats = await getStats()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen pb-24 px-4">
      {/* Demo notice */}
      <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-xs text-yellow-800 z-50">
        Esta es una demo del proyecto. El crawler corre en local, por lo que el buscador no devuelve resultados en este entorno.{' '}
        <a
          href="https://github.com/alexlledo13/Google2000"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium hover:text-yellow-900"
        >
          Ver código en GitHub
        </a>
      </div>
      {/* Logo */}
      <div className="mb-6 text-center">
        <span className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight select-none">
          <span style={{ color: '#4285F4' }}>G</span>
          <span style={{ color: '#EA4335' }}>o</span>
          <span style={{ color: '#FBBC05' }}>o</span>
          <span style={{ color: '#4285F4' }}>g</span>
          <span style={{ color: '#34A853' }}>l</span>
          <span style={{ color: '#EA4335' }}>e</span>
        </span>
      </div>

      {/* Search form */}
      <form method="GET" action="/search" className="flex flex-col items-center gap-4 w-full max-w-lg">
        <input
          type="text"
          name="q"
          autoFocus
          autoComplete="off"
          className="w-full border border-gray-400 rounded px-3 py-2 text-base focus:outline-none focus:border-blue-500"
        />
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="submit"
            className="px-4 py-1.5 text-sm bg-[#f8f8f8] border border-[#d9d9d9] rounded cursor-pointer hover:border-[#aaa] hover:bg-[#ebebeb]"
          >
            Buscar con Google
          </button>
          <button
            type="submit"
            name="lucky"
            value="1"
            className="px-4 py-1.5 text-sm bg-[#f8f8f8] border border-[#d9d9d9] rounded cursor-pointer hover:border-[#aaa] hover:bg-[#ebebeb]"
          >
            Voy a tener suerte
          </button>
        </div>
      </form>

      {/* Stats */}
      <p className="mt-6 text-xs text-gray-500 flex flex-wrap items-center justify-center gap-x-1 text-center">
        Buscando en{' '}
        <span className="font-medium text-black">
          {stats.totalIndexed.toLocaleString('es-ES')}
        </span>{' '}
        páginas indexadas de{' '}
        <span className="font-medium text-black">
          {stats.totalDiscovered.toLocaleString('es-ES')}
        </span>{' '}
        descubiertas
        <span className="relative group">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-400 text-gray-400 text-[9px] cursor-help leading-none">
            ?
          </span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 sm:w-72 bg-white border border-gray-300 shadow-md rounded p-2.5 text-gray-700 text-[11px] leading-relaxed hidden group-hover:block z-10 pointer-events-none">
            <strong className="block mb-1 text-black">¿Qué significa esto?</strong>
            <strong>Indexadas:</strong> páginas descargadas y analizadas por el spider — puedes buscar en ellas.<br />
            <strong>Descubiertas:</strong> URLs encontradas como enlaces durante el rastreo, pendientes de analizar.
          </span>
        </span>
      </p>
    </div>
  )
}
