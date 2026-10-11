// Sistema de diseño del panel (perfil P2 del meta-sistema de MenuPlan: herramienta interna con datos).
// Sobrio y neutro, compacto, tema claro y oscuro, WCAG 2.2 AA. No comparte valores con HoMenu: solo la ley y la forma.
// Fuente única: los tokens de abajo. El CSS se genera de ellos y no hay ficheros estáticos (el contenedor es read_only).
// Regla: ningún color fuera de la sección de tokens (lo vigila panel.test.js).

// Colores semánticos por tema. Se nombran por rol, no por valor.
export const CLARO = {
  "superficie": "#f6f7f9", // fondo de la página
  "superficie-elevada": "#ffffff", // tarjetas, tablas, cabecera
  "superficie-hundida": "#eceff3", // cabecera de tabla, código, insignia neutra
  "resalte": "#f0f3f8", // fila bajo el cursor
  "texto": "#1a1d21",
  "texto-suave": "#4a5361", // notas y etiquetas
  "borde": "#d5dae1", // separadores (decorativo)
  "borde-control": "#727c8a", // borde de lo que se pulsa o se enfoca (mínimo 3:1)
  "acento": "#1d4ed8", // enlaces, elemento activo, botón principal
  "acento-texto": "#ffffff", // texto sobre el acento
  "foco": "#1d4ed8",
  "exito": "#166534", "exito-fondo": "#dcfce7",
  "aviso": "#7a4b06", "aviso-fondo": "#fdf0c9",
  "error": "#b42318", "error-fondo": "#fee4e2",
  "informacion": "#1e40af", "informacion-fondo": "#dbeafe",
  "sombra-1": "0 1px 2px rgba(16,24,40,.08)", // casi nula: la elevación la da el borde
};

export const OSCURO = {
  "superficie": "#0e1116",
  "superficie-elevada": "#161b22",
  "superficie-hundida": "#1f252d",
  "resalte": "#1a2029",
  "texto": "#e6e9ed",
  "texto-suave": "#a3adba",
  "borde": "#2c343e",
  "borde-control": "#6f7a89",
  "acento": "#79a6ff",
  "acento-texto": "#0b1220",
  "foco": "#79a6ff",
  "exito": "#86efac", "exito-fondo": "#12301f",
  "aviso": "#fcd34d", "aviso-fondo": "#36290a",
  "error": "#fca5a5", "error-fondo": "#3a1515",
  "informacion": "#93c5fd", "informacion-fondo": "#12284a",
  "sombra-1": "0 1px 2px rgba(0,0,0,.4)",
};

// Escala tipográfica: base 14 px y razón 1,2 (tercera menor). Dos pesos: 400 y 600.
const BASE = 0.875, RAZON = 1.2;
const paso = (n) => `${Math.round(BASE * RAZON ** n * 1000) / 1000}rem`;

// Valores que no cambian con el tema. Espaciado sobre rejilla de 4 px (esp-N = N x 4 px).
export const FIJOS = {
  "fuente": 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  "fuente-codigo": 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  "tam-pie": paso(-1), "tam-cuerpo": paso(0), "tam-h3": paso(1), "tam-h2": paso(2), "tam-h1": paso(3), "tam-cifra": paso(4),
  "peso-normal": "400", "peso-fuerte": "600",
  "lh-cuerpo": "1.5", "lh-titulo": "1.25", "lh-tabla": "1.4",
  "esp-1": "4px", "esp-2": "8px", "esp-3": "12px", "esp-4": "16px", "esp-6": "24px", "esp-8": "32px", "esp-12": "48px",
  "radio": "4px",
  "borde-ancho": "1px", "borde-fuerte": "2px", "borde-banner": "4px", "foco-ancho": "2px",
  "objetivo": "2rem", // objetivo de clic de 32 px (perfil P2: 24 a 32)
  "ancho-max": "1400px", "ancho-lateral": "15rem", "alto-lateral-movil": "14rem", "ancho-prosa": "75ch",
  "z-tabla-cabecera": "1", "z-salto": "100",
  "dur": "120ms", "curva": "ease-out",
};

const decl = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v};`).join("");

// Qué texto va sobre qué fondo y cuánto contraste exige (WCAG 1.4.3 texto 4,5; 1.4.11 controles y foco 3).
const FONDOS = ["superficie", "superficie-elevada", "superficie-hundida", "resalte"];
export const PAREJAS = [
  ...FONDOS.flatMap((f) => [["texto", f, 4.5], ["texto-suave", f, 4.5], ["acento", f, 4.5]]),
  ["acento-texto", "acento", 4.5],
  ...["superficie", "superficie-elevada", "superficie-hundida"].flatMap((f) => [["foco", f, 3], ["borde-control", f, 3]]),
  ...["exito", "aviso", "error", "informacion"].map((c) => [c, `${c}-fondo`, 4.5]),
];
// Tokens de color que no necesitan pareja (decorativos o no son color).
export const SIN_PAREJA = ["borde", "sombra-1"];

const TOKENS = [
  "/* tokens:inicio */",
  `/* tema:claro */:root{${decl(FIJOS)}${decl(CLARO)}color-scheme:light;}`,
  `@media (prefers-color-scheme:dark){/* tema:oscuro-sistema */:root:not([data-theme="claro"]){${decl(OSCURO)}color-scheme:dark;}}`,
  `/* tema:oscuro */:root[data-theme="oscuro"]{${decl(OSCURO)}color-scheme:dark;}`,
  "/* tokens:fin */",
].join(String.fromCharCode(10));

const COMPONENTES = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--superficie);color:var(--texto);font-family:var(--fuente);font-size:var(--tam-cuerpo);font-weight:var(--peso-normal);line-height:var(--lh-cuerpo)}
a{color:var(--acento);text-underline-offset:.2em}
a:hover{text-decoration-thickness:var(--borde-fuerte)}
:focus-visible{outline:var(--foco-ancho) solid var(--foco);outline-offset:2px}
::selection{background:var(--acento);color:var(--acento-texto)}

/* Enlace para saltar la cabecera: solo se ve al enfocarlo con teclado */
.salto{position:absolute;left:var(--esp-2);top:var(--esp-2);z-index:var(--z-salto);padding:var(--esp-2) var(--esp-3);background:var(--acento);color:var(--acento-texto);border-radius:var(--radio);transform:translateY(-200%)}
.salto:focus{transform:none}

/* Cabecera y navegación agrupada */
.cabecera{background:var(--superficie-elevada);border-bottom:var(--borde-ancho) solid var(--borde)}
.cabecera-in{max-width:var(--ancho-max);margin:0 auto;padding:0 var(--esp-4);display:flex;flex-wrap:wrap;align-items:flex-end;column-gap:var(--esp-6)}
.marca{display:inline-flex;align-items:center;min-height:calc(var(--objetivo) + var(--esp-4));font-size:var(--tam-h3);font-weight:var(--peso-fuerte);color:var(--texto);text-decoration:none;border-bottom:var(--borde-fuerte) solid transparent;margin-bottom:calc(-1 * var(--borde-ancho))}
.marca[aria-current="page"]{border-bottom-color:var(--acento)}
.cabecera-in nav{min-width:0;max-width:100%}
.nav{display:flex;gap:var(--esp-4);margin:0;padding:0;list-style:none;overflow-x:auto}
.grupo{display:flex;flex-direction:column;flex:none;padding-left:var(--esp-4);border-left:var(--borde-ancho) solid var(--borde)}
.grupo:first-child{border-left:0;padding-left:0}
.etiqueta{font-size:var(--tam-pie);font-weight:var(--peso-fuerte);letter-spacing:.06em;text-transform:uppercase;color:var(--texto-suave)}
.grupo .etiqueta{padding-top:var(--esp-2)}
.grupo ul{display:flex;margin:0;padding:0;list-style:none}
.nav a{display:inline-flex;align-items:center;min-height:var(--objetivo);padding:0 var(--esp-2);white-space:nowrap;color:var(--texto-suave);text-decoration:none;border-bottom:var(--borde-fuerte) solid transparent;transition:background-color var(--dur) var(--curva),color var(--dur) var(--curva)}
.nav a:hover{color:var(--texto);background:var(--resalte)}
.nav a[aria-current="page"]{color:var(--texto);font-weight:var(--peso-fuerte);border-bottom-color:var(--acento)}
.nav a:focus-visible,.marca:focus-visible{outline-offset:calc(-1 * var(--foco-ancho))}

/* Página */
.contenido{max-width:var(--ancho-max);margin:0 auto;padding:var(--esp-6) var(--esp-4) var(--esp-12)}
.contenido:focus{outline:none}
h1,h2,h3,h4{line-height:var(--lh-titulo);font-weight:var(--peso-fuerte);color:var(--texto)}
h1{font-size:var(--tam-h1);margin:0 0 var(--esp-4)}
h2{font-size:var(--tam-h2);margin:var(--esp-8) 0 var(--esp-3)}
h3{font-size:var(--tam-h3);margin:var(--esp-6) 0 var(--esp-2)}
h4{font-size:var(--tam-cuerpo);margin:var(--esp-4) 0 var(--esp-2)}
h2.t1{margin-top:0}
.contenido p{max-width:var(--ancho-prosa);margin:0 0 var(--esp-3)}
.contenido ul,.contenido ol{margin:0 0 var(--esp-3);padding-left:var(--esp-6)}
.contenido li{margin:var(--esp-1) 0}
hr{border:0;border-top:var(--borde-ancho) solid var(--borde);margin:var(--esp-6) 0}
blockquote{margin:0 0 var(--esp-3);padding:var(--esp-1) var(--esp-4);border-left:var(--borde-banner) solid var(--borde-control);color:var(--texto-suave)}
.nota{color:var(--texto-suave)}
.vacio{padding:var(--esp-4);border:var(--borde-ancho) dashed var(--borde-control);border-radius:var(--radio);color:var(--texto-suave)}

/* Código */
code{font-family:var(--fuente-codigo);font-size:1em;background:var(--superficie-hundida);padding:0 var(--esp-1);border-radius:var(--radio)}
pre{margin:0 0 var(--esp-4);padding:var(--esp-3);overflow:auto;background:var(--superficie-hundida);border:var(--borde-ancho) solid var(--borde);border-radius:var(--radio);line-height:var(--lh-cuerpo)}
pre code{padding:0;background:none}

/* Tablas: cabecera fija, filas cómodas, números a la derecha, scroll contenido */
.tabla-caja{overflow:auto;max-height:75vh;margin:0 0 var(--esp-4);background:var(--superficie-elevada);border:var(--borde-ancho) solid var(--borde);border-radius:var(--radio)}
table{width:100%;border-collapse:separate;border-spacing:0;font-variant-numeric:tabular-nums}
th,td{padding:var(--esp-2) var(--esp-3);text-align:left;vertical-align:top;line-height:var(--lh-tabla);border-bottom:var(--borde-ancho) solid var(--borde);overflow-wrap:break-word}
thead th{position:sticky;top:0;z-index:var(--z-tabla-cabecera);background:var(--superficie-hundida);font-weight:var(--peso-fuerte);white-space:nowrap}
tbody th{font-weight:var(--peso-fuerte);white-space:nowrap}
tbody tr:last-child>*{border-bottom:0}
tbody tr{transition:background-color var(--dur) var(--curva)}
tbody tr:hover>*{background:var(--resalte)}
.num{text-align:right;white-space:nowrap}

/* Insignias de estado: siempre con texto, el color es un refuerzo */
.insignia{display:inline-block;padding:0 var(--esp-2);font-size:var(--tam-pie);font-weight:var(--peso-fuerte);line-height:1.6;white-space:nowrap;border:var(--borde-ancho) solid currentColor;border-radius:var(--radio);color:var(--texto-suave);background:var(--superficie-hundida)}
.i-exito{color:var(--exito);background:var(--exito-fondo)}
.i-aviso{color:var(--aviso);background:var(--aviso-fondo)}
.i-error{color:var(--error);background:var(--error-fondo)}
.i-informacion{color:var(--informacion);background:var(--informacion-fondo)}

/* Avisos */
.banner{margin:0 0 var(--esp-4);padding:var(--esp-3) var(--esp-4);border:var(--borde-ancho) solid currentColor;border-left-width:var(--borde-banner);border-radius:var(--radio)}
.banner p{margin:0;max-width:none}
.banner code{background:none;color:inherit}
.b-exito{color:var(--exito);background:var(--exito-fondo)}
.b-aviso{color:var(--aviso);background:var(--aviso-fondo)}
.b-error{color:var(--error);background:var(--error-fondo)}
.b-informacion{color:var(--informacion);background:var(--informacion-fondo)}

/* Tarjetas de resumen (cifra grande con etiqueta) */
.tarjetas{display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:var(--esp-3);margin:0 0 var(--esp-6)}
.tarjeta{margin:0;padding:var(--esp-3) var(--esp-4);background:var(--superficie-elevada);border:var(--borde-ancho) solid var(--borde);border-radius:var(--radio)}
.tarjeta dt{font-size:var(--tam-pie);font-weight:var(--peso-fuerte);letter-spacing:.06em;text-transform:uppercase;color:var(--texto-suave)}
.tarjeta dd{margin:var(--esp-1) 0 0;font-size:var(--tam-cifra);font-weight:var(--peso-fuerte);line-height:var(--lh-titulo);font-variant-numeric:tabular-nums}
.tarjeta .detalle{display:block;font-size:var(--tam-pie);font-weight:var(--peso-normal);color:var(--texto-suave)}

/* Portada: tarjetas con enlace */
.contenido .portada{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:var(--esp-3);margin:0 0 var(--esp-6);padding:0;list-style:none}
.contenido .portada li{margin:0}
.portada a{display:block;height:100%;padding:var(--esp-3) var(--esp-4);color:var(--texto);text-decoration:none;background:var(--superficie-elevada);border:var(--borde-ancho) solid var(--borde);border-radius:var(--radio);transition:border-color var(--dur) var(--curva),background-color var(--dur) var(--curva)}
.portada a:hover{border-color:var(--acento);background:var(--resalte)}
.portada strong{display:block;color:var(--acento);font-size:var(--tam-h3)}
.portada span{color:var(--texto-suave)}

/* Dos columnas: barra lateral y documento (entidades y diseño) */
.inv{display:grid;grid-template-columns:var(--ancho-lateral) minmax(0,1fr);gap:var(--esp-6);align-items:start}
.lateral{position:sticky;top:var(--esp-4);max-height:calc(100vh - var(--esp-8));overflow:auto;padding-right:var(--esp-3);border-right:var(--borde-ancho) solid var(--borde)}
.lateral ul{list-style:none;margin:0 0 var(--esp-2);padding:0}
.lateral li{margin:0}
.lateral .etiqueta{display:block;margin:var(--esp-4) 0 var(--esp-1)}
.lateral .etiqueta:first-child{margin-top:0}
.lateral a{display:block;min-height:var(--objetivo);padding:var(--esp-1) var(--esp-2);line-height:var(--lh-tabla);color:var(--texto-suave);text-decoration:none;border-left:var(--borde-fuerte) solid transparent}
.lateral a:hover{color:var(--texto);background:var(--resalte)}
.lateral a[aria-current="page"]{color:var(--texto);font-weight:var(--peso-fuerte);border-left-color:var(--acento)}
.lateral li.n3 a{padding-left:var(--esp-6)}
.inv-centro{min-width:0}

@media (max-width:760px){ /* punto de ruptura: columna estrecha */
  .cabecera-in{padding:0 var(--esp-3)}
  .cabecera-in nav{width:100%}
  .nav{flex-direction:column;gap:0;overflow:visible}
  .grupo,.grupo:first-child{flex-direction:row;align-items:center;padding:0;border-left:0;border-top:var(--borde-ancho) solid var(--borde)}
  .grupo .etiqueta{flex:0 0 7.5rem;padding:0}
  .grupo ul{flex-wrap:wrap}
  .contenido{padding:var(--esp-4) var(--esp-3) var(--esp-8)}
  h1{font-size:var(--tam-h2)}
  .inv{grid-template-columns:minmax(0,1fr)}
  .lateral{position:static;max-height:var(--alto-lateral-movil);padding:0 0 var(--esp-2);border-right:0;border-bottom:var(--borde-ancho) solid var(--borde)}
}
@media (prefers-reduced-motion:reduce){
  :root{--dur:0ms}
  *,*::before,*::after{scroll-behavior:auto!important}
}
@media (forced-colors:active){
  .nav a[aria-current="page"],.lateral a[aria-current="page"]{text-decoration:underline}
}
`;

export const CSS = `${TOKENS}${COMPONENTES}`;
