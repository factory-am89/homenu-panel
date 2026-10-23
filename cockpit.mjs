// Cockpit: qué sesiones del PC siguen vivas, a partir de lo que el PC envía cada minuto (cliente/enviar-sesiones.mjs).
// Es el único sitio de los umbrales de «sin señal». Funciones puras: la hora entra como argumento.
import { banner, esc, insignia, nota } from "./lib.mjs";

// Una sesión que lleva más de esto sin ficha nueva sale «sin señal». 15 min: el p99,9 de los huecos de una sesión viva
// medido en transcripts de la Fábrica y de MenuPlan fue 9,7 min (35 393 huecos).
export const SIN_SENAL_MIN = 15;
// Si el último envío del PC tiene más de esto, no se fía de ninguna sesión: la tarea del PC corre cada minuto.
export const PC_CALLADO_MIN = 3;

const FORMA_ID = /^[\w-]{6,80}$/;
const FORMA_RAMA = /^[\w./-]{1,100}$/;
const esHora = (x) => typeof x === "string" && !Number.isNaN(Date.parse(x));

/**
 * ¿Es la salida de `npm run sesiones -- --json` de la Fábrica? Se acepta solo la forma que el panel sabe pintar.
 * Devuelve { ok, error } o, si va bien, { ok, sesiones } con lo único que se guarda: id, rama, inicio, ultima.
 * La carpeta del PC y la ruta del registro no se guardan.
 */
export function validarSesiones(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: "no es un objeto" };
  if (!Array.isArray(x.sesiones)) return { ok: false, error: "falta sesiones (una lista)" };
  const sesiones = [];
  for (const [i, s] of x.sesiones.entries()) {
    const bien = s && typeof s === "object" && typeof s.id === "string" && FORMA_ID.test(s.id)
      && typeof s.rama === "string" && FORMA_RAMA.test(s.rama) && esHora(s.inicio) && esHora(s.ultima);
    if (!bien) return { ok: false, error: `sesiones[${i}]: se esperan id, rama, inicio y ultima con su forma` };
    sesiones.push({ id: s.id, rama: s.rama, inicio: s.inicio, ultima: s.ultima });
  }
  return { ok: true, sesiones };
}

const minutosDesde = (iso, ahora) => Math.max(0, Math.floor((ahora - Date.parse(iso)) / 60_000));
const hhmmMadrid = (ms) => new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(ms);

/** Estado de una sesión: «activa» o «sin señal» (con su motivo). `pcCallado` manda sobre la hora de la ficha. */
export function estadoDe(sesion, ahora, pcCallado) {
  if (pcCallado) return { estado: "sin señal", motivo: "el PC no envía" };
  const min = minutosDesde(sesion.ultima, ahora);
  if (min > SIN_SENAL_MIN) return { estado: "sin señal", motivo: "puede estar esperándote" };
  return { estado: "activa", motivo: "" };
}

/**
 * La página. `envio`: { recibido (ISO), sesiones } o null si nunca llegó nada.
 * Con el PC callado o sin envío, el aviso va arriba como error: nunca una lista vacía que parezca «no hay sesiones».
 */
export function vistaCockpit(envio, ahora = Date.now()) {
  if (!envio) return banner("error", "Aún no ha llegado ningún envío del PC: no sé qué sesiones hay. Se envía con <code>cliente/enviar-sesiones.mjs</code>.");
  const edad = minutosDesde(envio.recibido, ahora);
  const pcCallado = edad > PC_CALLADO_MIN;
  const aviso = pcCallado ? banner("error", `Sin noticias del PC desde las ${esc(hhmmMadrid(Date.parse(envio.recibido)))} (Madrid), hace ${edad} min. Las sesiones de abajo pueden haber terminado.`) : "";
  if (!envio.sesiones.length) return `${aviso}<p class="vacio">El PC no tiene ninguna sesión abierta.</p>${nota(`Último envío hace ${edad} min.`)}`;
  const tarjetas = envio.sesiones.map((s) => {
    const e = estadoDe(s, ahora, pcCallado);
    const min = minutosDesde(s.ultima, ahora);
    return `<li data-sesion="${esc(s.id)}" data-estado="${esc(e.estado)}"><strong>${esc(s.rama)}</strong> ${insignia(e.estado)}`
      + ` <span>última actividad hace ${min} min${e.motivo ? ` (${esc(e.motivo)})` : ""}</span></li>`;
  }).join("");
  return `${aviso}<ul>${tarjetas}</ul>${nota(`Último envío hace ${edad} min. «Sin señal» = más de ${SIN_SENAL_MIN} min sin actividad (con los datos de hoy no se distingue una sesión caída de una que te espera).`)}`;
}
