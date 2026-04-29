import { NextRequest, NextResponse } from 'next/server'
import { searchPages } from '@/lib/crawler'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')?.trim()
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter: q' }, { status: 400 })
  }

  const { results, total } = await searchPages(q, limit, offset)

  return NextResponse.json({
    query: q,
    total,
    limit,
    offset,
    results,
  })
}
