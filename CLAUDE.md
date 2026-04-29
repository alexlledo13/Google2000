# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

Compile:
```bash
javac -cp lib/jsoup-1.18.3.jar Main.java
```

Run:
```bash
java -cp .:lib/jsoup-1.18.3.jar Main
```

The program runs indefinitely. Stop it with Ctrl+C.

## Architecture

This is a multithreaded Java web crawler contained entirely in `Main.java`. The single dependency is `lib/jsoup-1.18.3.jar` for HTML parsing.

**Concurrency model:**
- 3 `ThreadReader` worker threads consume URLs from a `BlockingQueue<String>` (`urlQueue`)
- A `ScheduledExecutorService` polls the `IN/` directory every 5 seconds for new `.txt` files containing URLs to inject
- `processedUrls` (already crawled) and `activeUrls` (currently being crawled) are `ConcurrentHashMap`-backed sets used to deduplicate

**URL flow:**
1. `seeds.txt` is read at startup — one URL per line
2. Each URL is MD5-hashed; its output goes to `Raiz/<md5hash>/`
3. After crawling, extracted links are added back to the queue and also saved to `IN/<hash-char-dirs>/<hash>.txt` as a persistence mechanism
4. A page is only re-crawled if `lasttime.txt` in its directory is older than 3600 seconds

**`Raiz/<md5hash>/` directory contents per crawled URL:**
- `url.txt` — the original URL
- `content.html` — raw HTML response
- `lasttime.txt` — Unix epoch timestamp of last crawl
- `words.txt` — word frequencies (descending), stopwords filtered out
- `in_links.txt` — URLs that link to this page (appended as discovered)

**To inject URLs at runtime:** drop a `.txt` file (one URL per line) into the `IN/` directory. The scheduler picks it up within 5 seconds and deletes the file after reading.

**Stopwords:** `preposiciones.txt` — Spanish stopwords/prepositions filtered during word-frequency analysis.
