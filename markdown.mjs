// Markdown mínimo para enseñar los documentos de diseño de MenuPlan: títulos, tablas, listas,
// citas, bloques de código y énfasis. Todo el texto se escapa antes de poner etiquetas.
import { esc } from "./lib.mjs";

export const ancla = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

function enLinea(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+|#[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

const celdas = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
const esSeparador = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-");

/** Devuelve { html, titulos: [{nivel, texto, id}] }. */
export function markdownAHtml(md) {
  const lineas = String(md).replace(/\r/g, "").split("\n");
  const out = [], titulos = [], usados = new Map();
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (/^```/.test(l)) {
      const bloque = [];
      for (i++; i < lineas.length && !/^```/.test(lineas[i]); i++) bloque.push(lineas[i]);
      i++;
      out.push(`<pre>${esc(bloque.join("\n"))}</pre>`);
    } else if (/^#{1,4}\s/.test(l)) {
      const nivel = /^#+/.exec(l)[0].length, texto = l.replace(/^#+\s*/, "");
      let id = ancla(texto);
      const n = usados.get(id) ?? 0;
      usados.set(id, n + 1);
      if (n) id += `-${n + 1}`;
      titulos.push({ nivel, texto, id });
      out.push(`<h${nivel} id="${id}">${enLinea(texto)}</h${nivel}>`);
      i++;
    } else if (l.trim().startsWith("|") && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const cab = celdas(l);
      const cuerpo = [];
      for (i += 2; i < lineas.length && lineas[i].trim().startsWith("|"); i++) cuerpo.push(celdas(lineas[i]));
      out.push(`<table><thead><tr>${cab.map((c) => `<th>${enLinea(c)}</th>`).join("")}</tr></thead><tbody>${cuerpo.map((f) => `<tr>${f.map((c) => `<td>${enLinea(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    } else if (/^\s*([-*]|\d+[.)])\s/.test(l)) {
      const orden = /^\s*\d/.test(l), items = [];
      for (; i < lineas.length && (/^\s*([-*]|\d+[.)])\s/.test(lineas[i]) || (/^\s{2,}\S/.test(lineas[i]) && items.length)); i++) {
        if (/^\s*([-*]|\d+[.)])\s/.test(lineas[i])) items.push(lineas[i].replace(/^\s*([-*]|\d+[.)])\s+/, ""));
        else items[items.length - 1] += ` ${lineas[i].trim()}`;
      }
      out.push(`<${orden ? "ol" : "ul"}>${items.map((x) => `<li>${enLinea(x)}</li>`).join("")}</${orden ? "ol" : "ul"}>`);
    } else if (/^>\s?/.test(l)) {
      const cita = [];
      for (; i < lineas.length && /^>\s?/.test(lineas[i]); i++) cita.push(lineas[i].replace(/^>\s?/, ""));
      out.push(`<blockquote>${enLinea(cita.join(" "))}</blockquote>`);
    } else if (!l.trim()) {
      i++;
    } else if (/^---+$/.test(l.trim())) {
      out.push("<hr>");
      i++;
    } else {
      const parrafo = [];
      for (; i < lineas.length && lineas[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*]|\d+[.)])\s)/.test(lineas[i]) && !lineas[i].trim().startsWith("|"); i++) parrafo.push(lineas[i].trim());
      if (parrafo.length) out.push(`<p>${enLinea(parrafo.join(" "))}</p>`);
      else i++; // línea que no encaja en nada: se salta para no quedarse en bucle
    }
  }
  return { html: out.join("\n"), titulos };
}

/**
 * Biblioteca de diseño: barra lateral con los documentos y, del abierto, sus apartados; a la derecha el documento.
 * `docs`: [{id, titulo, fichero}]. `actual`: id o undefined (portada). `md`: texto del documento abierto.
 */
export function bibliotecaDiseno(docs, actual, md) {
  const abierto = docs.find((d) => d.id === actual);
  const lista = `<h3>Documentos</h3><ul>${docs.map((d) => `<li${d.id === actual ? ' class="activa"' : ""}><a href="/diseno/${esc(d.id)}">${esc(d.titulo)}</a></li>`).join("")}</ul>`;
  let indice = "", centro;
  if (abierto) {
    const { html, titulos } = markdownAHtml(md);
    indice = `<h3>En este documento</h3><ul>${titulos.filter((t) => t.nivel === 2 || t.nivel === 3).map((t) => `<li class="n${t.nivel}"><a href="#${t.id}">${esc(t.texto)}</a></li>`).join("")}</ul>`;
    centro = `<p class="aviso">Sale de <code>${esc(abierto.fichero)}</code> (rama staging de MenuPlan).</p>${html}`;
  } else {
    centro = `<p>La biblioteca de diseño: el meta-sistema (leyes N0, bloques N1, perfiles N2), el sistema de HoMenu y su estado. Cada documento se lee tal cual está en el repositorio.</p><ul>${docs.map((d) => `<li><a href="/diseno/${esc(d.id)}">${esc(d.titulo)}</a>${d.para ? ` — ${esc(d.para)}` : ""}</li>`).join("")}</ul>`;
  }
  const estilo = `<style>.inv{display:flex;gap:24px;align-items:flex-start}.inv aside{flex:0 0 250px;border-right:1px solid #ddd;padding-right:12px;position:sticky;top:8px;max-height:95vh;overflow:auto}.inv aside ul{list-style:none;margin:0 0 8px;padding:0}.inv aside li{padding:2px 0}.inv aside li.n3{padding-left:14px;font-size:13px}.inv aside h3{margin:12px 0 4px;font-size:13px;text-transform:uppercase;opacity:.7}.inv .activa a{font-weight:700}.inv main{flex:1;min-width:0;overflow-x:auto}pre{overflow:auto;padding:8px;background:#f3f3f3}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ccc}@media(prefers-color-scheme:dark){.inv aside{border-color:#333}pre{background:#242424}}@media(max-width:700px){.inv{flex-direction:column}.inv aside{flex:none;border-right:0;padding-right:0;position:static;max-height:none}}</style>`;
  return { existe: !actual || !!abierto, titulo: abierto ? abierto.titulo : "Biblioteca de diseño", html: `${estilo}<div class="inv"><aside>${lista}${indice}</aside><main>${centro}</main></div>` };
}
