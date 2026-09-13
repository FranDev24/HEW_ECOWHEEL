/**
 * ECOWHEEL — Configuración de contenido (semilla / respaldo)
 * -------------------------------------------------
 * Desde que existe admin.html, el contenido real del wheel se
 * gestiona ahí (se guarda en localStorage bajo "ecowheel-rounds").
 * Este arreglo solo se usa como respaldo/semilla cuando todavía
 * no se ha guardado nada desde el panel de administración.
 *
 *   image     -> ruta a la imagen (colócala en /assets)
 *   question  -> texto que aparece en la píldora
 *   info      -> (opcional) texto que se revela con "Aprender más"
 *   action    -> texto del botón inferior
 */
const ECOWHEEL_ROUNDS = [
  {
    image: "assets/sample-1.svg",
    question: "¿Qué es un spin?",
    info: "",
    action: "1. Panel de Usuario"
  },
  {
    image: "assets/sample-2.svg",
    question: "¿Qué mide la resonancia magnética?",
    info: "",
    action: "1. Panel de Usuario"
  },
  {
    image: "assets/sample-3.svg",
    question: "¿Para qué sirve el helio líquido en un resonador?",
    info: "",
    action: "1. Panel de Usuario"
  }
];

// Tema inicial: "night" o "day"
const ECOWHEEL_DEFAULT_THEME = "night";

