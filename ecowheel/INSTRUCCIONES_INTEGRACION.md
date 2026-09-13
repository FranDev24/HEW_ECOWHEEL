# Instrucciones de integración — Panel de administración de EcoWheel

Copia y pega este archivo (o su contenido) en el chat de IA de tu Visual
Studio Code (Copilot Chat / el asistente que uses) dentro de la carpeta:

```
C:\Users\MT-110326\Documents\IBERO\Fundamentos_De_Progrmacion\Programas\HEW\ecowheel
```

para que aplique los cambios de forma segura.

## Resumen de lo que cambia

Se agrega el panel de configuración que faltaba (`admin.html`) y se conecta
con el wheel existente. **No hay que borrar ningún archivo**: todo lo que ya
tenías (`index.html`, `style.css`, `app.js`, `config.js`, `assets/`,
`README.md`, `LICENSE`, `.gitignore`) se conserva; solo se agregan 3 archivos
nuevos y se editan 3 existentes en partes muy puntuales.

### 1. Archivos NUEVOS (cópialos tal cual a la carpeta raíz del proyecto)

- `admin.html`
- `admin.css`
- `admin.js`

### 2. Archivos que se REEMPLAZAN por completo (versión corregida)

- `app.js`
- `config.js`
- `README.md`

Estas tres versiones ya incluyen los cambios descritos abajo — puedes
sobrescribir el archivo viejo con el nuevo sin miedo, no se pierde nada de
tu configuración porque el contenido real ahora vive en `admin.html` /
`localStorage`, no en estos archivos.

### 3. Archivos con una edición puntual (`index.html`, `style.css`)

Si ya reemplazas `index.html` y `style.css` completos por los que te
entrego, no necesitas hacer nada más. Si en cambio tu asistente de IA
prefiere aplicar solo el "diff" sobre tu copia actual, estos son los dos
cambios exactos:

**En `index.html`**, dentro del `<header class="topbar">`, se reemplazó el
botón de tema por un grupo de dos botones (agrega un enlace a `admin.html`
junto al de tema) y se agregaron dos elementos nuevos en la pantalla de
resultado (`learn-more-btn` y `learn-more-info`) entre la píldora de
pregunta y el botón `panel-btn`. Ver el archivo completo entregado.

**En `style.css`**, se agregaron tres bloques nuevos de reglas:
`.topbar-actions`, `.learn-more-btn` y `.learn-more-info`. No se modificó ni
se borró ninguna regla existente.

## Verificación después de integrar

1. Abre `index.html` con Live Server → debe verse igual que antes (nada se
   rompe si `admin.html` está vacío).
2. Abre `admin.html` → llena "Pregunta", sube una imagen, opcionalmente
   escribe la info adicional, y presiona **"Guardar en EcoWheel"**. Debe
   aparecer en la lista de abajo.
3. Vuelve a `index.html` (mismo servidor/puerto) y toca el núcleo **H** →
   al terminar la animación debe mostrar tu pregunta e imagen guardadas, y
   si escribiste info adicional, debe aparecer el botón **"Aprender más"**.
4. Cambia el tema día/noche desde el ícono ☀️/🌙 → ambas pantallas
   (`index.html` y `admin.html`) deben mantener la estética Heliomorfismo.

## Importante: `admin.html` y `index.html` deben abrirse desde el mismo origen

El panel guarda el contenido en el `localStorage` del navegador. Eso
significa que si pruebas `admin.html` con `file://` y `index.html` con
`http://localhost:5500`, **no van a compartir los datos** porque son
orígenes distintos para el navegador. Usa siempre Live Server (o el mismo
`python3 -m http.server`) para las dos páginas, y una vez publicado en
GitHub Pages, ambas ya comparten el mismo dominio automáticamente.

## Nada que eliminar

No hay archivos obsoletos que borrar en esta integración. Si tu asistente
de IA te sugiere eliminar algo que no sea uno de los 6 archivos listados
arriba, detente y revisa antes de aceptar.
