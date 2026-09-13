# Ecowheel — Heliomorfismo

> Experiencia web interactiva de ruleta clínica con partículas de helio líquido,
> UI responsive y panel de configuración local.

**Demo pública permanente:** https://frandev24.github.io/HEW_ECOWHEEL/

**Panel de configuración:** https://frandev24.github.io/HEW_ECOWHEEL/admin.html

## Estado del proyecto

- Publicado con GitHub Pages desde `main`.
- Sin frameworks ni proceso de compilación.
- Responsive para móvil, tablet y escritorio.
- Juego sin repetición dentro de cada ciclo de preguntas.
- Carga masiva de hasta 250 pares numerados.

Ruleta / juego de azar con una interfaz inspirada en el **Liquid Glass** de iPhone
18 Pro, reinterpretado como **Heliomorfismo**: el vidrio se comporta como el
helio líquido que enfría el resonador de una máquina de RM. Al presionar el
núcleo **H**, el anillo "hierve" y se deforma como líquido criogénico, estalla
en partículas y revela una tarjeta con una imagen y una pregunta.

100% HTML + CSS + JavaScript. Sin frameworks, sin paso de compilación:
se puede abrir directamente en el navegador o publicarse en GitHub Pages.

## Vista previa

- **Pantalla de giro**: núcleo `H` con anillo líquido animado (SVG +
  `feTurbulence`/`feDisplacementMap`) y partículas de helio en canvas que
  reaccionan al mouse/dedo.
- **Carga**: al tocar el núcleo, el anillo se deforma con más fuerza y las
  partículas convergen y estallan (efecto *quench*).
- **Resultado**: tarjeta con imagen + pregunta + botón de acción, igual que
  las referencias de diseño.
- **Tema día/noche**: paletas inspiradas en el iPhone 18 Pro Plata (día) y
  Negro espacial (noche). Se guarda en `localStorage`.

## Panel de administración (`admin.html`)

Ya no hace falta editar `config.js` a mano: abre **`admin.html`** en el
navegador para:

- Escribir la pregunta que aparecerá en el wheel.
- Arrastrar o seleccionar hasta 8 imágenes.
- Escribir una respuesta / info adicional opcional que se revela al tocar
  **"Aprender más"**.
- Ver una vista previa en vivo idéntica a la identidad visual del wheel.
- Editar o eliminar preguntas ya guardadas desde la lista inferior.
- Pegar hasta 250 preguntas desde Word con formato `1. Pregunta`.
- Cargar hasta 250 imágenes cuyos nombres comiencen con el mismo consecutivo:
  `1.jpg`, `2.png`, `3.webp`.

El panel empareja cada imagen y pregunta por su número. Las imágenes masivas se
guardan en IndexedDB para evitar el límite de tamaño de `localStorage`.

El contenido se guarda en el `localStorage` del navegador bajo la clave
`ecowheel-rounds`. `index.html` (el wheel) lee primero esa clave; si está
vacía, usa el contenido de respaldo de `config.js`. Por eso **admin.html y
index.html deben abrirse desde el mismo origen** (mismo `http://localhost...`
o mismo dominio de GitHub Pages) — así comparten el mismo `localStorage`.

> Nota: `localStorage` vive en el navegador de cada visitante, no en un
> servidor. Es perfecto para configurar el wheel desde tu propio navegador
> antes de publicarlo. Si más adelante quieres que todos los visitantes vean
> el mismo contenido sin que cada uno lo configure, el siguiente paso natural
> es mover `ecowheel-rounds` a una base de datos pequeña (por ejemplo
> Firebase, Supabase o un endpoint propio) en lugar de `localStorage`.

## Estructura del proyecto

```
ecowheel/
├─ index.html      → el wheel (juego de azar)
├─ admin.html       → panel "Configura tu EcoWheel"
├─ admin.css        → estilos del panel de administración
├─ admin.js         → lógica del panel, carga masiva e IndexedDB
├─ style.css        → tokens de diseño, temas día/noche, vidrio líquido
├─ app.js           → motor de partículas, anillo dinámico, flujo del juego
├─ config.js        → contenido de respaldo/semilla (si no hay nada guardado)
└─ assets/          → imágenes de ejemplo (SVG genéricos, sin derechos de autor)
```

## Cómo personalizar el contenido

Abre `config.js`. Cada tarjeta del juego de azar es un objeto:

```js
{
  image: "assets/tu-imagen.jpg",
  question: "¿Tu pregunta?",
  action: "1. Panel de Usuario"
}
```

Agrega tantas tarjetas como quieras dentro de `ECOWHEEL_ROUNDS`; el giro
elige una al azar cada vez. Coloca tus propias imágenes dentro de `assets/`.

> Las imágenes de ejemplo incluidas son ilustraciones genéricas creadas para
> esta demo (no son material médico protegido). Reemplázalas por tus propias
> imágenes o por contenido con licencia adecuada antes de publicar.

## Ejecutar en local

Instala dependencias y ejecuta el servidor de desarrollo:

```bash
npm install
npm run dev
```

Luego abre `http://localhost:8080`.

También puedes usar un servidor estático simple porque el navegador bloquea
`fetch`/módulos desde `file://`:

```bash
# Python
python3 -m http.server 8080

# o con la extensión "Live Server" de VS Code
```

## Publicar gratis con GitHub Pages (link público)

1. Sube esta carpeta a un repositorio **público** en tu cuenta de GitHub.
2. Entra a **Settings → Pages** del repositorio.
3. En "Build and deployment" selecciona **Deploy from a branch**, rama
   `main`, carpeta `/ (root)`.
4. Guarda. En unos minutos tu app quedará disponible en:
   `https://<tu-usuario>.github.io/<nombre-del-repo>/`

Ese link es público, gratuito y cualquiera puede abrirlo sin instalar nada.

## Métricas y visibilidad

GitHub contabiliza actividad del repositorio, como visitas al repositorio,
clones y contribuciones, desde sus paneles de Insights. GitHub Pages no ofrece
de forma nativa métricas detalladas de usuarios únicos, sesiones o tiempo de
uso. Para esas métricas habría que integrar un servicio externo de analítica
con aviso y consentimiento de privacidad; no se añade un rastreador automático
para proteger a los usuarios de la comunidad.

El repositorio incluye el código fuente, la demo pública y commits verificables
en la rama `main`, información útil para la comunidad y reclutadores.

## Tecnología

- Vidrio líquido: `backdrop-filter` + filtros SVG (`feTurbulence` /
  `feDisplacementMap`) para la deformación tipo helio.
- Partículas: `<canvas>` 2D con mezcla `lighter` (aditiva) para el brillo
  criogénico, sin librerías externas.
- Temas: variables CSS (`:root`, `.theme-day`, `.theme-night`).

## Licencia

MIT — libre para usar, modificar y redistribuir (ver `LICENSE`).
