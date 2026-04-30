# Google2000

Un motor de búsqueda web completo construido desde cero: un crawler multihilo en Java que indexa páginas de internet, y una interfaz web en Next.js para buscar sobre los datos indexados.

---

## Arquitectura general

```
Google2000/
├── Main.java          ← Crawler Java (backend de indexación)
├── seeds.txt          ← URLs de inicio
├── preposiciones.txt  ← Stopwords en español
├── lib/
│   └── jsoup-1.18.3.jar
├── Raiz/              ← Datos indexados (generado en runtime)
│   └── <md5hash>/
│       ├── url.txt
│       ├── content.html
│       ├── lasttime.txt
│       ├── words.txt
│       └── in_links.txt
├── IN/                ← Cola de URLs pendientes (generado en runtime)
└── frontend/          ← Interfaz web Next.js
    └── src/
        ├── app/
        │   ├── page.tsx          ← Página principal
        │   ├── search/page.tsx   ← Página de resultados
        │   └── api/
        │       ├── search/       ← API de búsqueda
        │       └── stats/        ← API de estadísticas
        └── lib/
            └── crawler.ts        ← Lector del índice en disco
```

---

## Cómo funciona

### 1. El Crawler (Java)

El crawler lee una lista de URLs semilla desde `seeds.txt` y las procesa en paralelo con **3 hilos trabajadores**:

1. Descarga el HTML de cada página
2. Extrae el texto visible y filtra stopwords (`preposiciones.txt`)
3. Calcula la frecuencia de cada palabra y la guarda en `words.txt`
4. Extrae todos los enlaces de la página y los añade a la cola
5. Registra qué páginas enlazan a cada URL (`in_links.txt`)

Cada URL se identifica por su **hash MD5** y sus datos se guardan en `Raiz/<md5hash>/`. Una página solo se re-rastrea si han pasado más de **3600 segundos** desde el último acceso.

**Para inyectar URLs en caliente** (sin reiniciar), coloca un `.txt` con URLs (una por línea) en el directorio `IN/`. El crawler lo detecta en menos de 5 segundos y lo procesa automáticamente.

### 2. La Interfaz Web (Next.js)

El frontend lee directamente los archivos generados por el crawler en `Raiz/`. Al hacer una búsqueda:

1. Carga el índice en memoria (o desde caché en disco)
2. Tokeniza la query y busca coincidencias en los `words.txt` de cada página indexada
3. Ordena los resultados por frecuencia de aparición del término
4. Muestra URL, palabras clave principales, fecha de último rastreo y número de enlaces entrantes

El índice se refresca automáticamente cada **60 segundos**.

---

## Instalación y uso

### Requisitos
- Java 11+
- Node.js 18+

### Crawler

```bash
# Compilar
javac -cp lib/jsoup-1.18.3.jar Main.java

# Ejecutar (correr indefinidamente, Ctrl+C para parar)
java -cp .:lib/jsoup-1.18.3.jar Main
```

Edita `seeds.txt` para definir las URLs de inicio (una por línea).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> El buscador requiere que el crawler haya indexado páginas previamente. Deja correr el crawler unos minutos antes de buscar.

---

## Datos por URL indexada

| Archivo | Contenido |
|---|---|
| `url.txt` | URL original |
| `content.html` | HTML completo descargado |
| `lasttime.txt` | Timestamp Unix del último rastreo |
| `words.txt` | Frecuencia de palabras (orden descendente) |
| `in_links.txt` | URLs que enlazan a esta página |

---

## Tecnologías

| Componente | Tecnología |
|---|---|
| Crawler | Java 11+, `java.net.http.HttpClient` |
| Parser HTML | [jsoup 1.18.3](https://jsoup.org/) |
| Concurrencia | `ExecutorService`, `BlockingQueue`, `ConcurrentHashMap` |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Búsqueda | Índice en memoria sobre archivos en disco |
