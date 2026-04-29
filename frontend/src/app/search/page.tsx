import { redirect } from 'next/navigation'
import { searchPages, SearchResult } from '@/lib/crawler'

type SearchParams = Promise<{ q?: string; lucky?: string }>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams
  return { title: q ? `${q} - Google` : 'Google' }
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, lucky } = await searchParams

  if (!q?.trim()) redirect('/')

  const { results, total } = await searchPages(q, 10, 0)

  if (lucky === '1') {
    if (results[0]) redirect(results[0].url)
    redirect('/')
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 border-b border-gray-200">
        <a href="/" className="text-xl sm:text-2xl font-bold shrink-0 select-none">
          <span style={{ color: '#4285F4' }}>G</span>
          <span style={{ color: '#EA4335' }}>o</span>
          <span style={{ color: '#FBBC05' }}>o</span>
          <span style={{ color: '#4285F4' }}>g</span>
          <span style={{ color: '#34A853' }}>l</span>
          <span style={{ color: '#EA4335' }}>e</span>
        </a>
        <form method="GET" action="/search" className="flex gap-2 flex-1 min-w-0">
          <input
            type="text"
            name="q"
            defaultValue={q}
            autoComplete="off"
            className="flex-1 min-w-0 border border-gray-400 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="shrink-0 px-3 py-1.5 text-sm bg-[#f8f8f8] border border-[#d9d9d9] rounded hover:border-[#aaa] hover:bg-[#ebebeb]"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="px-4 sm:px-6 md:pl-40 pt-3 pb-10 max-w-2xl">
        <p className="text-xs text-gray-600 mb-4">
          Se encontraron aproximadamente{' '}
          <span className="font-medium">{total.toLocaleString('es-ES')}</span> resultados
        </p>

        {results.length === 0 ? (
          <NoResults query={q} />
        ) : (
          <ol className="flex flex-col gap-6">
            {results.map((r) => (
              <ResultItem key={r.hash} result={r} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function ResultItem({ result }: { result: SearchResult }) {
  const displayUrl = result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const snippet = result.topWords.map((w) => w.word).join(' · ')

  return (
    <li>
      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base sm:text-lg hover:underline break-words"
        style={{ color: '#1a0dab' }}
      >
        {displayUrl}
      </a>

      <p className="text-sm truncate" style={{ color: '#006621' }}>
        {displayUrl}
      </p>

      <p className="text-sm mt-0.5 break-words" style={{ color: '#545454' }}>
        {snippet}
      </p>

      <p className="text-xs mt-0.5" style={{ color: '#767676' }}>
        {result.inLinkCount > 0 && (
          <span>{result.inLinkCount} enlaces entrantes · </span>
        )}
        <span>relevancia: {result.score}</span>
      </p>
    </li>
  )
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="text-sm text-gray-700">
      <p>
        No se encontraron resultados para <strong>&ldquo;{query}&rdquo;</strong>.
      </p>
      <ul className="mt-3 list-disc pl-5 space-y-1 text-gray-600">
        <li>Comprueba que todas las palabras están bien escritas.</li>
        <li>Prueba con términos más generales.</li>
        <li>Prueba con menos palabras.</li>
      </ul>
    </div>
  )
}
