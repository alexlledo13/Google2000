import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const RAIZ = path.join(process.cwd(), '..', 'Raiz')
const IN_DIR = path.join(process.cwd(), '..', 'IN')

interface PageIndex {
  hash: string
  url: string
  words: Record<string, number>
  lastCrawled: number
  inLinkCount: number
}

const DISK_CACHE_FILE = path.join(process.cwd(), '.crawler-cache.json')

interface DiskCache {
  pages: PageIndex[]
  pendingUrls: number
  builtAt: number
}

// In-memory index rebuilt every 60 seconds; also persisted to disk
let indexCache: PageIndex[] | null = null
let cacheBuiltAt = 0
const CACHE_TTL_MS = 60_000

let cachedPendingUrls = 0
let pendingUrlsBuildRunning = false

function parseWords(raw: string): Record<string, number> {
  const words: Record<string, number> = {}
  for (const line of raw.split('\n')) {
    const colon = line.lastIndexOf(':')
    if (colon === -1) continue
    const word = line.slice(0, colon).trim()
    const count = parseInt(line.slice(colon + 1).trim(), 10)
    if (word && !isNaN(count)) words[word] = count
  }
  return words
}

// Use `find` to locate only the ~500 dirs that have words.txt instead of
// scanning all 18k+ discovered directories on every index build.
async function getIndexedHashes(): Promise<string[]> {
  const { stdout } = await execFileAsync('find', [RAIZ, '-name', 'words.txt', '-type', 'f'])
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((filePath) => path.basename(path.dirname(filePath)))
}

async function buildIndex(): Promise<PageIndex[]> {
  const hashes = await getIndexedHashes().catch(() => [] as string[])

  const results = await Promise.all(
    hashes.map(async (hash) => {
      const dir = path.join(RAIZ, hash)
      try {
        const [urlRaw, wordsRaw, lastTimeRaw, inLinksRaw] = await Promise.all([
          fs.readFile(path.join(dir, 'url.txt'), 'utf-8').catch(() => null),
          fs.readFile(path.join(dir, 'words.txt'), 'utf-8').catch(() => null),
          fs.readFile(path.join(dir, 'lasttime.txt'), 'utf-8').catch(() => null),
          fs.readFile(path.join(dir, 'in_links.txt'), 'utf-8').catch(() => null),
        ])

        if (!urlRaw || !wordsRaw) return null

        return {
          hash,
          url: urlRaw.trim(),
          words: parseWords(wordsRaw),
          lastCrawled: lastTimeRaw ? parseInt(lastTimeRaw.trim(), 10) : 0,
          inLinkCount: inLinksRaw ? inLinksRaw.split('\n').filter(Boolean).length : 0,
        } satisfies PageIndex
      } catch {
        return null
      }
    })
  )

  return results.filter((r): r is PageIndex => r !== null)
}

async function readDiskCache(): Promise<DiskCache | null> {
  try {
    const raw = await fs.readFile(DISK_CACHE_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeDiskCache(pages: PageIndex[], pendingUrls: number): void {
  const payload: DiskCache = { pages, pendingUrls, builtAt: Date.now() }
  fs.writeFile(DISK_CACHE_FILE, JSON.stringify(payload)).catch(() => {})
}

// Counts pending URLs in IN/ — slow (17s on macOS with 540k dirs).
// Runs only in background; never blocks a request.
function refreshPendingUrls(): void {
  if (pendingUrlsBuildRunning) return
  pendingUrlsBuildRunning = true
  execFileAsync('find', [IN_DIR, '-mindepth', '33', '-maxdepth', '33', '-name', '*.txt', '-type', 'f'])
    .then(({ stdout }) => {
      cachedPendingUrls = stdout.trim().split('\n').filter(Boolean).length
      if (indexCache) writeDiskCache(indexCache, cachedPendingUrls)
    })
    .catch(() => {})
    .finally(() => { pendingUrlsBuildRunning = false })
}

async function getIndex(): Promise<PageIndex[]> {
  if (indexCache && Date.now() - cacheBuiltAt < CACHE_TTL_MS) return indexCache

  // Try disk cache first — survives server restarts
  const disk = await readDiskCache()
  if (disk && Date.now() - disk.builtAt < CACHE_TTL_MS) {
    indexCache = disk.pages
    cacheBuiltAt = disk.builtAt
    cachedPendingUrls = disk.pendingUrls
    return indexCache
  }

  indexCache = await buildIndex()
  cacheBuiltAt = Date.now()
  writeDiskCache(indexCache, cachedPendingUrls)
  refreshPendingUrls() // background — doesn't block
  return indexCache
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  url: string
  hash: string
  score: number
  topWords: Array<{ word: string; count: number }>
  lastCrawled: number
  inLinkCount: number
}

export async function searchPages(
  query: string,
  limit = 10,
  offset = 0
): Promise<{ results: SearchResult[]; total: number }> {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!terms.length) return { results: [], total: 0 }

  const index = await getIndex()
  const scored: SearchResult[] = []

  for (const page of index) {
    let score = 0
    for (const term of terms) score += page.words[term] ?? 0
    if (score === 0) continue

    const topWords = Object.entries(page.words)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }))

    scored.push({
      url: page.url,
      hash: page.hash,
      score,
      topWords,
      lastCrawled: page.lastCrawled,
      inLinkCount: page.inLinkCount,
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return { results: scored.slice(offset, offset + limit), total: scored.length }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface CrawlerStats {
  totalDiscovered: number
  totalIndexed: number
  pendingUrls: number
}

export async function getStats(): Promise<CrawlerStats> {
  const [index, totalDiscovered] = await Promise.all([
    getIndex(),
    fs.readdir(RAIZ).then((d) => d.length).catch(() => 0),
  ])

  return {
    totalDiscovered,
    totalIndexed: index.length,
    pendingUrls: cachedPendingUrls,
  }
}
