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

export function pagina(titulo, proyecto, cuerpo) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)} · Panel</title>
<style>body{font:15px system-ui;margin:0;padding:16px;max-width:1100px;margin-inline:auto;color:#1c1c1c;background:#fff}
@media(prefers-color-scheme:dark){body{color:#e8e8e8;background:#161616}th{background:#242424}td,th{border-color:#333}}
nav a{margin-right:14px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}
.aviso{opacity:.7}</style>
<nav><strong>${esc(proyecto)}</strong> · <a href="/">Inicio</a><a href="/glosario">Glosario</a><a href="/estandares">Estándares</a></nav>
<h1>${esc(titulo)}</h1>${cuerpo}</html>`;
}
