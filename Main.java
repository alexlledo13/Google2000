import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

public class Main {
    private static final String SEEDS_FILE = "seeds.txt";
    private static final String IN_DIRECTORY = "IN";
    private static final String ROOT_FOLDER = "Raiz";
    private static final String preposicionesRuta = "preposiciones.txt";
    static final Set<String> processedUrls = ConcurrentHashMap.newKeySet();
    static final Set<String> activeUrls = ConcurrentHashMap.newKeySet();
    static final BlockingQueue<String> urlQueue = new LinkedBlockingQueue<>();  // Usamos BlockingQueue
    private static final ConcurrentHashMap<String, Object> fileLocks = new ConcurrentHashMap<>();

    // Método principal que inicia el programa
    public static void main(String[] args) {
        new File(IN_DIRECTORY).mkdir();
        new File(ROOT_FOLDER).mkdir();
        cargarURLs(SEEDS_FILE);

        // Hilos para procesar URLs
        ExecutorService executor = Executors.newFixedThreadPool(3);
        for (int i = 0; i < 3; i++) {
            executor.submit(new ThreadReader());
        }

        // Hilo para cargar URLs desde IN cada 5 segundos
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(() -> cargarURLsDesdeIN(), 0, 5, TimeUnit.SECONDS);

        // Mantener el programa activo
        try {
            executor.awaitTermination(Long.MAX_VALUE, TimeUnit.DAYS);
        } catch (InterruptedException e) {
            System.err.println("Error al esperar hilos: " + e.getMessage());
        } finally {
            executor.shutdownNow();
            scheduler.shutdownNow();
        }
    } // public static void main(String[] args) {

    // Carga URLs desde un archivo de semillas (seeds.txt)
    private static void cargarURLs(String fileName) {
        try (BufferedReader reader = new BufferedReader(new FileReader(fileName))) {
            String line;
            while ((line = reader.readLine()) != null) {
                agregarURLALaCola(line.trim());
            }
        } catch (IOException e) {
            System.err.println("Error al cargar seeds.txt: " + e.getMessage());
        }
    } // private static void cargarURLs(String fileName) {

    // Carga URLs desde archivos en el directorio IN (recursivo)
    private static void cargarURLsDesdeIN() {
        cargarURLsDesdeDirectorio(new File(IN_DIRECTORY));
    }

    private static void cargarURLsDesdeDirectorio(File dir) {
        File[] entries = dir.listFiles();
        if (entries == null) return;
        for (File entry : entries) {
            if (entry.isDirectory()) {
                cargarURLsDesdeDirectorio(entry);
            } else if (entry.isFile() && entry.getName().endsWith(".txt")) {
                try (BufferedReader reader = new BufferedReader(new FileReader(entry))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        String url = line.trim();
                        if (!url.isEmpty()) agregarURLALaCola(url);
                    }
                    entry.delete();
                } catch (IOException e) {
                    System.err.println("Error al leer archivo en IN/: " + e.getMessage());
                }
            }
        }
    }

    // Agrega una URL a la cola de procesamiento si no ha sido procesada o está activa
    private static void agregarURLALaCola(String url) {
        synchronized (processedUrls) {
            if (!processedUrls.contains(url) && !activeUrls.contains(url)) {
                urlQueue.add(url);  // Agregar a la cola bloqueante
            }
        }
    } // private static void agregarURLALaCola(String url) {

    // Crea una estructura de directorios basada en un hash MD5
    private static String crearDirectoriosIN(String hash) {
        String currentPath = IN_DIRECTORY;
        File rootDir = new File(currentPath);
        if (!rootDir.exists()) rootDir.mkdir();

        for (int i = 0; i < hash.length(); i++) {
            currentPath += "/" + hash.charAt(i);
            File directory = new File(currentPath);
            if (!directory.exists()) directory.mkdir();
        }
        return currentPath;
    } // private static String crearDirectoriosIN(String hash) {

    // Guarda un enlace en el directorio IN con una estructura basada en su hash MD5
    static void guardarEnlace(String enlace) {
        String md5Hash = md5(enlace);
        String dirPathIN = crearDirectoriosIN(md5Hash);
        guardarArchivo(dirPathIN + "/" + md5Hash + ".txt", enlace);
    } // private static void guardarEnlace(String enlace) {

    // Guarda contenido en un archivo
    static void guardarArchivo(String ruta, String contenido) {
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(ruta))) {
            writer.write(contenido);
        } catch (IOException e) {
            System.err.println("Error al guardar archivo: " + e.getMessage());
        }
    } // private static void guardarArchivo(String ruta, String contenido) {

    static void guardarArchivoAppend(String ruta, String contenido) {
        Object lock = fileLocks.computeIfAbsent(ruta, k -> new Object());
        synchronized (lock) {
            try (BufferedWriter writer = new BufferedWriter(new FileWriter(ruta, true))) {
                writer.write(contenido);
                writer.newLine();
            } catch (IOException e) {
                System.err.println("Error al guardar archivo (append): " + e.getMessage());
            }
        }
    }

    // Extrae el texto visible de un archivo HTML usando Jsoup
    static String extraerTextoHTML(String html) {
        Document document = Jsoup.parse(html); // Convierte el HTML en un documento DOM
        return document.text(); // Obtiene solo el texto visible
    } // private static String extraerTextoHTML(String html) {

    // Ordena un mapa de frecuencia de palabras en orden descendente
    static Map<String, Integer> ordenarFrecuenciaPalabras(Map<String, Integer> frecuenciaPalabras) {
        return frecuenciaPalabras.entrySet()
                .stream()
                .sorted((a, b) -> b.getValue().compareTo(a.getValue())) // Ordenar por frecuencia descendente
                .collect(LinkedHashMap::new, (map, entry) -> map.put(entry.getKey(), entry.getValue()), Map::putAll);
    } // private static Map<String, Integer> ordenarFrecuenciaPalabras(Map<String, Integer> frecuenciaPalabras) {

    // Cuenta la frecuencia de palabras en una lista
    static Map<String, Integer> contarFrecuenciaPalabras(List<String> palabras) {
        Map<String, Integer> frecuencia = new HashMap<>();
        for (String palabra : palabras) {
            frecuencia.put(palabra, frecuencia.getOrDefault(palabra, 0) + 1);
        } // for (String palabra : palabras) {
        return frecuencia;
    } // private static Map<String, Integer> contarFrecuenciaPalabras(List<String> palabras) {

    // Obtiene el código fuente de una URL
    static String getSourceCode(String url) {
        System.setProperty("https.protocols", "SSL3,TLSv1,TLSv1.1,TLSv1.2");

        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(15))
                    .GET()
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                return response.body();
            } else {
                System.err.println("Error al obtener " + url + ". Código de estado: " + response.statusCode());
                return "";
            }
        } catch (IOException | InterruptedException e) {
            System.err.println("Error en getSourceCode para " + url + ": " + e.getMessage());
            return "";
        }
    } // private static String getSourceCode(String url) {

    // Extrae enlaces de un contenido HTML
    static Set<String> extraerEnlaces(String htmlContent) {
        Set<String> enlaces = new HashSet<>();
        Document document = Jsoup.parse(htmlContent);
        Elements links = document.select("a[href]");

        for (Element link : links) {
            String href = link.attr("abs:href");
            if (!href.isEmpty()) {
                enlaces.add(href);
            }
        }
        return enlaces;
    } // private static Set<String> extraerEnlaces(String htmlContent) {

    // Calcula el hash MD5 de una cadena
    static String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
            return "";
        }
    } // private static String md5(String input) {

    // Asegura que una URL tenga un esquema (http:// o https://)
    static String asegurarEsquema(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return "https://" + url;
        }
        return url;
    } // private static String asegurarEsquema(String url) {

    // Carga palabras irrelevantes desde un archivo
    static Set<String> cargarPalabrasIrrelevantes(String filePath) throws IOException {
        Set<String> preposiciones = new HashSet<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            String palabra;
            while ((palabra = reader.readLine()) != null) {
                preposiciones.add(palabra.trim().toLowerCase());
            } // while ((palabra = reader.readLine()) != null) {
        } // try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
        return preposiciones;
    } // private static Set<String> cargarPalabrasIrrelevantes(String filePath) throws IOException {

    // Filtra palabras irrelevantes de un texto
    static List<String> procesarTexto(String texto, Set<String> preposiciones) {
        List<String> palabrasFiltradas = new ArrayList<>();
        String[] palabras = texto.toLowerCase().split("\\s+");

        for (String palabra : palabras) {
            if (!preposiciones.contains(palabra) && !palabra.isBlank()) {
                palabrasFiltradas.add(palabra);
            } // if (!preposiciones.contains(palabra) && !palabra.isBlank()) {
        } // for (String palabra : palabras) {
        return palabrasFiltradas;
    } // private static List<String> procesarTexto(String texto, Set<String> preposiciones) {

    static class ThreadReader implements Runnable {
        @Override
        public void run() {
            while (true) {
                try {
                    String url = Main.urlQueue.take();
                    if (Main.processedUrls.contains(url) || Main.activeUrls.contains(url)) continue;

                    Main.activeUrls.add(url);
                    System.out.println("Procesando: " + url);

                    String md5Hash = Main.md5(url);
                    String dirPathRaiz = Main.ROOT_FOLDER + "/" + md5Hash;
                    new File(dirPathRaiz).mkdirs();

                    Main.guardarArchivo(dirPathRaiz + "/url.txt", url);

                    File lastTimeFile = new File(dirPathRaiz + "/lasttime.txt");
                    boolean puedeDescargar = !lastTimeFile.exists() || Instant.now().getEpochSecond() - Long.parseLong(Files.readString(lastTimeFile.toPath())) >= 3600;

                    if (puedeDescargar) {
                        String content = Main.getSourceCode(Main.asegurarEsquema(url));
                        if (!content.isEmpty()) {
                            Main.guardarArchivo(dirPathRaiz + "/content.html", content);
                            Main.guardarArchivo(dirPathRaiz + "/lasttime.txt", String.valueOf(Instant.now().getEpochSecond()));

                            Set<String> preposiciones = Main.cargarPalabrasIrrelevantes(Main.preposicionesRuta);
                            String textoLimpio = Main.extraerTextoHTML(content);
                            List<String> palabrasProcesadas = Main.procesarTexto(textoLimpio, preposiciones);

                            Map<String, Integer> frecuenciaPalabras = Main.contarFrecuenciaPalabras(palabrasProcesadas);
                            Map<String, Integer> palabrasOrdenadas = Main.ordenarFrecuenciaPalabras(frecuenciaPalabras);

                            StringBuilder resultado = new StringBuilder();
                            palabrasOrdenadas.forEach((palabra, frecuencia) -> resultado.append(palabra).append(": ").append(frecuencia).append("\n"));
                            Main.guardarArchivo(dirPathRaiz + "/words.txt", resultado.toString());

                            Set<String> enlaces = Main.extraerEnlaces(content);
                            for (String enlace : enlaces) {
                                if (!Main.processedUrls.contains(enlace) && !Main.activeUrls.contains(enlace)) {
                                    Main.guardarEnlace(enlace);
                                    Main.agregarURLALaCola(enlace);
                                }
                                String enlaceHash = Main.md5(enlace);
                                String enlaceDirPath = Main.ROOT_FOLDER + "/" + enlaceHash;
                                new File(enlaceDirPath).mkdirs();
                                Main.guardarArchivoAppend(enlaceDirPath + "/in_links.txt", url);
                            }
                        }
                    }

                    Main.processedUrls.add(url);
                    Main.activeUrls.remove(url);

                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    System.err.println("Error general: " + e.getMessage());
                }
            }
        }
    }
} // public class Main {