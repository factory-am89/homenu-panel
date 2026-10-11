// Funciones puras del panel: escapar HTML y pintar tablas. Sin dependencias.
export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Una lista de objetos, o un objeto de objetos, pasa a filas [{ id, ...campos }]. */
export function filas(datos) {
  if (Array.isArray(datos)) return datos.map((x, i) => ({ id: x.termino ?? x.id ?? i, ...x }));
  return Object.entries(datos ?? {}).map(([id, x]) => ({ id, ...x }));
}

const celda = (v) => (Array.isArray(v) ? v.join(", ") : typeof v === "object" && v !== null ? JSON.stringify(v) : v);

/** Tabla HTML con las columnas pedidas; todo lo que viene de fuera va escapado. */
export function tabla(lista, columnas) {
  const cab = columnas.map((c) => `<th>${esc(c)}</th>`).join("");
  const cuerpo = lista.map((f) => `<tr>${columnas.map((c) => `<td>${esc(celda(f[c]))}</td>`).join("")}</tr>`).join("");
  return `<table><thead><tr>${cab}</tr></thead><tbody>${cuerpo}</tbody></table>`;
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

export function pagina(titulo, proyecto, cuerpo) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Panel</title>
<style>body{font:15px system-ui;margin:0;padding:16px;max-width:1100px;margin-inline:auto;color:#1c1c1c;background:#fff}
@media(prefers-color-scheme:dark){body{color:#e8e8e8;background:#161616}th{background:#242424}td,th{border-color:#333}}
nav a{margin-right:14px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}
.aviso{opacity:.7}</style>
<nav><strong>${esc(proyecto)}</strong> · <a href="/">Inicio</a><a href="/glosario">Glosario</a><a href="/estandares">Estándares</a><a href="/agentes">Agentes</a><a href="/skills">Skills</a><a href="/encargos">Tipos de encargo</a><a href="/fondos">Fondos</a><a href="/entidades">Entidades</a><a href="/issues">Issues</a><a href="/coste">Coste</a></nav>
<h1>${esc(titulo)}</h1>${cuerpo}</html>`;
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
const enlace = (id, nombre) => `<a href="/entidades/${esc(id)}">${esc(nombre ?? id)}</a>`;

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
    return `<h3>${esc(titulo)} (${lista.length})</h3><ul>${lista.map((e) => `<li${e.id === id ? ' class="activa"' : ""}>${enlace(e.id, e.nombre)}</li>`).join("")}</ul>`;
  }).join("");
  const nombre = (x) => enlace(x, por.get(x)?.nombre ?? x);
  let centro;
  if (!id) {
    const cuenta = EJES.map(([eje, titulo]) => `<tr><td>${esc(titulo)}</td>${REGISTROS.map((r) => `<td>${entidades.filter((e) => e.eje === eje && e.registro === r).length}</td>`).join("")}</tr>`).join("");
    const todas = entidades.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((e) =>
      `<tr><td>${enlace(e.id, e.nombre)}</td><td>${esc(e.eje)}</td><td>${esc(e.registro)}</td><td>${esc(e.fuente_de_verdad)}</td></tr>`).join("");
    centro = `<p>${entidades.length} entidades y ${relaciones.length} relaciones. «Registro» dice cómo vive cada una hoy: <code>con_registro</code> (fichero propio con id y test), <code>parcial</code> o <code>sin_registro</code> (solo prosa o logs).</p>
<h2>Registro por eje</h2><table><thead><tr><th>Eje</th>${REGISTROS.map((r) => `<th>${r}</th>`).join("")}</tr></thead><tbody>${cuenta}</tbody></table>
<h2>Todas</h2><table><thead><tr><th>Entidad</th><th>Eje</th><th>Registro</th><th>Fuente hoy</th></tr></thead><tbody>${todas}</tbody></table>`;
  } else {
    const e = por.get(id);
    const sale = relaciones.filter((r) => r.a === id), llega = relaciones.filter((r) => r.b === id);
    const ficha = [["Eje", e.eje], ["Registro", e.registro], ["Fuente hoy", e.fuente_de_verdad], ["Formato de id", e.formato_id],
      ["Palabras prohibidas", (e.sinonimos_prohibidos ?? []).join(", ")], ["Nota", e.nota]]
      .filter(([, v]) => v).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
    const tr = (cols) => `<tr>${cols.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    const tablaRel = (cab, filasHtml) => filasHtml.length ? `<table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${filasHtml.join("")}</tbody></table>` : "<p>Ninguna.</p>";
    centro = `<p>${esc(e.definicion)}</p><table><tbody>${ficha}</tbody></table>
<h2>Relaciones que salen (${sale.length})</h2>${tablaRel(["Relación", "Con", "Campo donde se guarda"], sale.map((r) => tr([esc(r.relacion), nombre(r.b), esc(r.campo)])))}
<h2>Relaciones que llegan (${llega.length})</h2>${tablaRel(["Desde", "Relación", "Campo donde se guarda"], llega.map((r) => tr([nombre(r.a), esc(r.relacion), esc(r.campo)])))}`;
  }
  const estilo = `<style>.inv{display:flex;gap:24px;align-items:flex-start}.inv aside{flex:0 0 230px;border-right:1px solid #ddd;padding-right:12px}.inv aside ul{list-style:none;margin:0 0 8px;padding:0}.inv aside li{padding:2px 0}.inv aside h3{margin:12px 0 4px;font-size:13px;text-transform:uppercase;opacity:.7}.inv .activa a{font-weight:700}.inv main{flex:1;min-width:0}@media(max-width:700px){.inv{flex-direction:column}.inv aside{flex:none;border-right:0;padding-right:0}}</style>`;
  return { existe: true, titulo: id ? por.get(id).nombre : "Entidades", html: `${estilo}<div class="inv"><aside>${lateral}</aside><main>${centro}</main></div>` };
}
