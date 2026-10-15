// Funciones puras del panel: escapar HTML y pintar tablas. Sin dependencias.
import { CSS } from "./estilo.mjs";
export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Una lista de objetos, o un objeto de objetos, pasa a filas [{ id, ...campos }]. */
export function filas(datos) {
  if (Array.isArray(datos)) return datos.map((x, i) => ({ id: x.termino ?? x.id ?? i, ...x }));
  return Object.entries(datos ?? {}).map(([id, x]) => ({ id, ...x }));
}

const celda = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" && v !== null ? JSON.stringify(v) : v);

/** Envuelve una tabla en su caja: scroll contenido, cabecera fija y alcanzable con teclado. */
export const cajaTabla = (html, etiqueta = "Tabla de datos") =>
  `<div class="tabla-caja" role="region" aria-label="${esc(etiqueta)}" tabindex="0">${html}</div>`;

// Estados con insignia: valor -> variante. Todo valor desconocido sale neutro (y siempre con su texto).
const VARIANTE = {
  abierto: "informacion", cerrado: "exito", ok: "exito", falla: "error", si: "exito", no: "error", true: "exito", false: "error",
  con_registro: "exito", parcial: "aviso", sin_registro: "informacion",
};
const COLUMNAS_ESTADO = new Set(["estado", "aguanto", "registro"]);

/** Insignia de estado: texto siempre; el color es un refuerzo (WCAG 1.4.1). */
export const insignia = (valor) => {
  const v = String(valor ?? "");
  return `<span class="insignia i-${VARIANTE[v.toLowerCase()] ?? "neutro"}">${esc(v)}</span>`;
};

/** Aviso con variante (exito, aviso, error, informacion); la etiqueta evita que el color sea la única señal. */
const ETIQUETA_BANNER = { exito: "Hecho", aviso: "Aviso", error: "Error", informacion: "Información" };
export const banner = (variante, html) =>
  `<div class="banner b-${variante}" role="${variante === "error" ? "alert" : "note"}"><p><strong>${ETIQUETA_BANNER[variante]}.</strong> ${html}</p></div>`;

/** Nota discreta (texto suave). `html` ya va escapado por quien llama. */
export const nota = (html) => `<p class="nota">${html}</p>`;

/** Tarjetas de resumen: [{ etiqueta, valor, detalle? }]. */
export const tarjetas = (lista) =>
  `<dl class="tarjetas">${lista.map((t) => `<div class="tarjeta"><dt>${esc(t.etiqueta)}</dt><dd>${esc(t.valor)}${t.detalle ? `<span class="detalle">${esc(t.detalle)}</span>` : ""}</dd></div>`).join("")}</dl>`;

const esNumero = (v) => typeof v === "number" || (typeof v === "string" && /^-?[0-9][0-9.,]*$/.test(v));

/** Tabla HTML con las columnas pedidas; todo lo que viene de fuera va escapado. Columnas numéricas a la derecha. */
export function tabla(lista, columnas, etiqueta) {
  if (!lista.length) return `<p class="vacio">Sin filas todavía.</p>`;
  const num = new Set(columnas.filter((c) => lista.some((f) => f[c] !== "" && f[c] != null) && lista.every((f) => f[c] === "" || f[c] == null || esNumero(f[c]))));
  const cls = (c) => (num.has(c) ? ' class="num"' : "");
  const cab = columnas.map((c) => `<th scope="col"${cls(c)}>${esc(c.replace(/_/g, " "))}</th>`).join("");
  const dato = (c, f) => (COLUMNAS_ESTADO.has(c) && f[c] !== "" && f[c] != null ? insignia(celda(f[c])) : esc(celda(f[c])));
  const cuerpo = lista.map((f) => `<tr>${columnas.map((c) => `<td${cls(c)}>${dato(c, f)}</td>`).join("")}</tr>`).join("");
  return cajaTabla(`<table><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table>`, etiqueta);
}

const valorDe = (etiquetas, prefijo) =>
  (etiquetas ?? []).map((l) => l?.name ?? l).find((n) => n.startsWith(`${prefijo}:`))?.slice(prefijo.length + 1) ?? "";

/** Un issue de la API de GitHub pasa a una fila plana; `fondo` sale del bloque del encargo («fondo: #n»). */
export function filaIssue(i, repo) {
  return {
    n: i.number, tipo: valorDe(i.labels, "tipo"), estado: i.state === "closed" ? "cerrado" : "abierto",
    area: valorDe(i.labels, "area"), causa: valorDe(i.labels, "causa"), analisis: valorDe(i.labels, "analisis"),
    fondo: /^fondo:\s*#?(\d+)/m.exec(i.body ?? "")?.[1] ?? "", titulo: i.title,
    asignado: (i.assignees ?? []).map((a) => a.login).join(", "), url: `https://github.com/${repo}/issues/${i.number}`,
  };
}

/** Cuenta filas por dos claves: { fila: { columna: n } }. */
export function contar(lista, a, b) {
  const r = {};
  for (const x of lista) { const f = (r[x[a] || "(sin)"] ??= {}); f[x[b] || "(sin)"] = (f[x[b] || "(sin)"] ?? 0) + 1; }
  return r;
}

const sinComillas = (v) => v.trim().replace(/^(["'])(.*)\1$/, "$2");

/** Cabecera `---` de un .md: claves de primer nivel y, de `metadata:`, sus claves con un nivel de sangría. */
export function frontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto ?? "");
  const r = {};
  if (!m) return r;
  let bloque = null;
  for (const linea of m[1].split(/\r?\n/)) {
    const sub = /^\s+([\w-]+):\s*(.*)$/.exec(linea);
    if (sub && bloque) { r[sub[1]] = sinComillas(sub[2]); continue; }
    const k = /^([\w-]+):\s*(.*)$/.exec(linea);
    if (!k) continue;
    if (k[2] === "") bloque = k[1];
    else { bloque = null; r[k[1]] = sinComillas(k[2]); }
  }
  return r;
}

/** Filas de la primera tabla markdown que sigue a un encabezado (`## …texto…`). */
export function tablaMarkdown(texto, encabezado) {
  const lineas = (texto ?? "").split(/\r?\n/);
  const i = lineas.findIndex((l) => /^#{1,6}\s/.test(l) && l.includes(encabezado));
  if (i < 0) return [];
  const celdas = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const ini = lineas.findIndex((l, j) => j > i && l.trim().startsWith("|"));
  if (ini < 0) return [];
  const cab = celdas(lineas[ini]);
  const filas = [];
  for (let j = ini + 2; j < lineas.length && lineas[j].trim().startsWith("|"); j++) {
    const c = celdas(lineas[j]);
    filas.push(Object.fromEntries(cab.map((h, k) => [h, c[k] ?? ""])));
  }
  return filas;
}

/** Caducidad de una skill: 90 días desde `comprobado` (AAAA-MM-DD). Devuelve { caduca, dias } o vacío. */
export function caducidad(comprobado, hoy = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(comprobado ?? "")) return { caduca: "", dias: "" };
  const c = new Date(`${comprobado}T00:00:00Z`);
  const caduca = new Date(c.getTime() + 90 * 86_400_000);
  return { caduca: caduca.toISOString().slice(0, 10), dias: Math.ceil((caduca - hoy) / 86_400_000) };
}

const esNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * ¿Es un informe de `npm run fabrica -- --json`? Solo se acepta la forma que el panel sabe pintar:
 * agregados numéricos. Lo demás se rechaza con el motivo (nunca se guarda tal cual lo que llega).
 */
export function validarInforme(x) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: "no es un objeto" };
  if (!x.cobertura || !esNum(x.cobertura.sesiones)) return { ok: false, error: "falta cobertura.sesiones" };
  if (!x.eventos || !esNum(x.eventos.total) || typeof x.eventos.por_evento !== "object") return { ok: false, error: "falta eventos" };
  const s = x.sinIssue;
  if (!s || !esNum(s.minutos) || !esNum(s.coste_usd) || !s.tokens || !esNum(s.tokens.total)) return { ok: false, error: "falta sinIssue (minutos, coste_usd, tokens)" };
  return { ok: true };
}

/** Del informe, lo que se guarda: el propio informe más el día (Madrid) al que pertenece. */
export const diaDe = (fecha = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(fecha);

// Secciones del panel, agrupadas. Una sola lista: la navegación y la portada salen de aquí.
export const SECCIONES = [
  { grupo: "Conocimiento", items: [
    { href: "/glosario", nombre: "Glosario", para: "Las palabras del proceso, su definición y los sinónimos prohibidos." },
    { href: "/estandares", nombre: "Estándares", para: "Qué es hacer bien cada tarea de cada agente, y de dónde sale." },
    { href: "/agentes", nombre: "Agentes", para: "Quién construye y quién juzga, con sus planos, herramientas y modelo." },
    { href: "/skills", nombre: "Skills", para: "Los runbooks con su dueño y cuándo caducan, los más urgentes primero." },
    { href: "/encargos", nombre: "Tipos de encargo", para: "El pipeline de agentes que sigue cada tipo de encargo." },
  ] },
  { grupo: "Trabajo", items: [
    { href: "/fondos", nombre: "Fondos", para: "Los problemas de fondo con los encargos y casos que cuelgan de ellos, y su coste." },
    { href: "/issues", nombre: "Issues", para: "Fondos, casos, encargos y decisiones, abiertos y cerrados." },
    { href: "/coste", nombre: "Coste", para: "Horas, tokens y dólares estimados por encargo y por día." },
  ] },
  { grupo: "Mapa", items: [
    { href: "/entidades", nombre: "Entidades", para: "El mapa de entidades del proyecto y cómo se relacionan." },
    { href: "/diseno", nombre: "Diseño", para: "La biblioteca de diseño: meta-sistema, sistema de HoMenu y su estado." },
  ] },
  { grupo: "Otros repos", items: [
    { href: "/fabrica", nombre: "Factoría", para: "Los ficheros de la Factoría (CLAUDE.md, pasos de Pablo, intervenciones, estándares y agentes), tal cual están en GitHub." },
  ] },
];

/**
 * Documentos de una fuente de solo lectura (config/fabrica.json): los ficheros sueltos y, de cada carpeta, sus .md.
 * `listados`: {carpeta: [{type, name}] | null}; una carpeta sin listado (GitHub falló) no aporta nada.
 */
export function documentosDeFuente(cfg, listados) {
  const sueltos = (cfg.documentos ?? []).map((d) => ({ ...d }));
  const deCarpetas = (cfg.directorios ?? []).flatMap((c) => (listados[c.directorio] ?? [])
    .filter((f) => f.type === "file" && f.name.endsWith(".md"))
    .map((f) => ({ id: `${c.id}-${f.name.slice(0, -3).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, titulo: f.name, fichero: `${c.directorio}/${f.name}`, grupo: c.titulo })));
  return [...sueltos, ...deCarpetas];
}

const activa = (href, ruta) => ruta === href || ruta.startsWith(`${href}/`);

/** Cabecera común: marca, navegación agrupada y contenido. `ruta` marca el elemento activo (aria-current). */
export function pagina(titulo, proyecto, cuerpo, ruta = "") {
  const grupos = SECCIONES.map((g, i) => `<li class="grupo"><span class="etiqueta" id="grupo-${i}">${esc(g.grupo)}</span><ul aria-labelledby="grupo-${i}">${g.items.map((s) =>
    `<li><a href="${s.href}"${activa(s.href, ruta) ? ' aria-current="page"' : ""}>${esc(s.nombre)}</a></li>`).join("")}</ul></li>`).join("");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(titulo)} · ${esc(proyecto)}</title>
<style>${CSS}</style>
</head>
<body>
<a class="salto" href="#contenido">Saltar al contenido</a>
<header class="cabecera"><div class="cabecera-in">
<a class="marca" href="/"${ruta === "/" ? ' aria-current="page"' : ""}>${esc(proyecto)}</a>
<nav aria-label="Secciones"><ul class="nav">${grupos}</ul></nav>
</div></header>
<main class="contenido" id="contenido" tabindex="-1">
<h1>${esc(titulo)}</h1>
${cuerpo}
</main>
</body>
</html>`;
}

/** Portada: qué es el panel y una tarjeta con enlace por sección. */
export function portada(repo, rama) {
  const intro = nota(`Panel de la factoría: enseña, en solo lectura, cómo trabaja el proyecto. Lee <code>${esc(repo)}</code> (rama ${esc(rama)}) en GitHub y los informes de coste que envía el PC de Pablo. Cada sección dice de qué fichero sale.`);
  const grupos = SECCIONES.map((g) => `<h2>${esc(g.grupo)}</h2><ul class="portada">${g.items.map((s) =>
    `<li><a href="${s.href}"><strong>${esc(s.nombre)}</strong><span>${esc(s.para)}</span></a></li>`).join("")}</ul>`).join("");
  return `${intro}${grupos}`;
}

// "diseno → qa + revisor": los pasos de un tipo de encargo (ops/tipos-de-encargo.json) en una línea.
export function pasosTexto(tipo) {
  return (tipo.pasos ?? []).map((p) => {
    const ag = (p.agentes ?? []).join(" + ");
    const op = (p.opcional ?? []).map((o) => `[${o.agente} si ${o.si}]`).join(" ");
    return [ag, op].filter(Boolean).join(" ") + (p.nota ? ` (${p.nota})` : "");
  }).join(" → ") + (tipo.cierra_con ? ` → ${tipo.cierra_con}` : "");
}

// Cruza los fondos con sus encargos y casos (issues) y con lo medido por encargo (informe de fabrica).
// medidos: [{issue, minutos, coste_usd}]. Devuelve una fila por fondo, el de más coste primero.
export function porFondo(issues, medidos = []) {
  const m = new Map(medidos.map((e) => [e.issue, e]));
  const fondos = issues.filter((x) => x.tipo === "fondo");
  return fondos.map((f) => {
    const hijos = issues.filter((x) => x.fondo === String(f.n) && x.n !== f.n);
    const encargos = hijos.filter((x) => x.tipo === "encargo");
    const casos = hijos.filter((x) => x.tipo === "caso");
    const medidosDelFondo = encargos.map((x) => m.get(x.n)).filter(Boolean);
    return {
      n: f.n, titulo: f.titulo, estado: f.estado, causa: f.causa,
      encargos: encargos.length, encargos_abiertos: encargos.filter((x) => x.estado === "abierto").length,
      casos: casos.length, medidos: medidosDelFondo.length,
      horas: medidosDelFondo.reduce((s, e) => s + e.minutos, 0) / 60,
      coste_usd: medidosDelFondo.reduce((s, e) => s + e.coste_usd, 0),
    };
  }).sort((a, b) => b.coste_usd - a.coste_usd || b.encargos - a.encargos);
}

const EJES = [["puente", "Puentes"], ["horizontal", "Cómo trabajamos"], ["vertical", "El producto"]];
const REGISTROS = ["con_registro", "parcial", "sin_registro"];
const enlace = (id, nombre, activo = false) => `<a href="/entidades/${esc(id)}"${activo ? ' aria-current="page"' : ""}>${esc(nombre ?? id)}</a>`;

/**
 * Inventario de entidades (ops/entidades.json de MenuPlan): barra lateral con todas, agrupadas por eje,
 * y a la derecha el resumen o la ficha de una entidad con las relaciones que salen y que llegan, enlazadas.
 * `id` desconocido → existe: false (el servidor responde 404).
 */
export function entidadesVista(datos, id) {
  const entidades = datos?.entidades ?? [], relaciones = datos?.relaciones ?? [];
  const por = new Map(entidades.map((e) => [e.id, e]));
  if (id && !por.has(id)) return { existe: false, html: "" };
  const lateral = EJES.map(([eje, titulo]) => {
    const lista = entidades.filter((e) => e.eje === eje).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return `<span class="etiqueta">${esc(titulo)} (${lista.length})</span><ul>${lista.map((e) => `<li>${enlace(e.id, e.nombre, e.id === id)}</li>`).join("")}</ul>`;
  }).join("");
  const nombre = (x) => enlace(x, por.get(x)?.nombre ?? x);
  const tr = (cols) => `<tr>${cols.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  const tablaHtml = (cab, filasHtml, etiqueta) => cajaTabla(`<table><thead><tr>${cab.map((c) => `<th scope="col">${c}</th>`).join("")}</tr></thead><tbody>${filasHtml.join("")}</tbody></table>`, etiqueta);
  let centro;
  if (!id) {
    const de = (eje, r) => entidades.filter((e) => e.eje === eje && e.registro === r).length;
    const total = (r) => entidades.filter((e) => e.registro === r).length;
    const resumen = tarjetas([
      { etiqueta: "Entidades", valor: entidades.length }, { etiqueta: "Relaciones", valor: relaciones.length },
      ...REGISTROS.map((r) => ({ etiqueta: r, valor: total(r) })),
    ]);
    const cuenta = EJES.map(([eje, titulo]) => `<tr><td>${esc(titulo)}</td>${REGISTROS.map((r) => `<td class="num">${de(eje, r)}</td>`).join("")}</tr>`);
    const todas = entidades.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((e) =>
      `<tr><td>${enlace(e.id, e.nombre)}</td><td>${esc(e.eje)}</td><td>${insignia(e.registro)}</td><td>${esc(e.fuente_de_verdad)}</td></tr>`);
    centro = `${resumen}<p>${entidades.length} entidades y ${relaciones.length} relaciones. «Registro» dice cómo vive cada una hoy: <code>con_registro</code> (fichero propio con id y test), <code>parcial</code> o <code>sin_registro</code> (solo prosa o logs).</p>
<h2>Registro por eje</h2>${tablaHtml(["Eje", ...REGISTROS], cuenta, "Registro por eje")}
<h2>Todas</h2>${tablaHtml(["Entidad", "Eje", "Registro", "Fuente hoy"], todas, "Todas las entidades")}`;
  } else {
    const e = por.get(id);
    const sale = relaciones.filter((r) => r.a === id), llega = relaciones.filter((r) => r.b === id);
    const ficha = [["Eje", e.eje], ["Registro", e.registro], ["Fuente hoy", e.fuente_de_verdad], ["Formato de id", e.formato_id],
      ["Palabras prohibidas", (e.sinonimos_prohibidos ?? []).join(", ")], ["Nota", e.nota]]
      .filter(([, v]) => v).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${k === "Registro" ? insignia(v) : esc(v)}</td></tr>`).join("");
    const tablaRel = (cab, filasHtml, etiqueta) => filasHtml.length ? tablaHtml(cab, filasHtml, etiqueta) : `<p class="vacio">Ninguna.</p>`;
    centro = `<p>${esc(e.definicion)}</p>${cajaTabla(`<table><tbody>${ficha}</tbody></table>`, "Ficha de la entidad")}
<h2>Relaciones que salen (${sale.length})</h2>${tablaRel(["Relación", "Con", "Campo donde se guarda"], sale.map((r) => tr([esc(r.relacion), nombre(r.b), esc(r.campo)])), "Relaciones que salen")}
<h2>Relaciones que llegan (${llega.length})</h2>${tablaRel(["Desde", "Relación", "Campo donde se guarda"], llega.map((r) => tr([nombre(r.a), esc(r.relacion), esc(r.campo)])), "Relaciones que llegan")}`;
  }
  return { existe: true, titulo: id ? por.get(id).nombre : "Entidades", html: `<div class="inv"><aside class="lateral" aria-label="Entidades">${lateral}</aside><div class="inv-centro">${centro}</div></div>` };
}

// Desde MenuPlan#566 ops/entidades.json trae claves en inglés (entities, relations, axis, registry...).
// El panel enseña los términos de siempre; esta función traduce el registro a la forma que lee entidadesVista.
const EJE_ES = { bridge: "puente", horizontal: "horizontal", vertical: "vertical" };
const REGISTRO_ES = { with_registry: "con_registro", partial: "parcial", without_registry: "sin_registro" };
export function entidadesDeRegistro(r) {
  if (Array.isArray(r?.entidades)) return r; // forma antigua, ya traducida
  return {
    entidades: (r?.entities ?? []).map((e) => ({
      id: e.id, nombre: e.name, eje: EJE_ES[e.axis] ?? e.axis, registro: REGISTRO_ES[e.registry] ?? e.registry,
      fuente_de_verdad: e.source_of_truth, formato_id: e.id_format, definicion: e.note ?? "", nota: "",
      sinonimos_prohibidos: e.forbidden_synonyms ?? [],
    })),
    relaciones: (r?.relations ?? []).map((x) => ({ a: x.from, relacion: x.relation, b: x.to, campo: x.stored_in ?? x.stored_as })),
  };
}
