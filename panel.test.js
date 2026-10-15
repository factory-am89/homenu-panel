import test from "node:test";
import assert from "node:assert/strict";
import { caducidad, contar, diaDe, esc, filaIssue, filas, frontmatter, tabla, tablaMarkdown, validarInforme } from "./lib.mjs";

test("frontmatter lee claves, comillas y el bloque metadata", () => {
  const f = frontmatter('---\nname: hetzner\ndescription: Úsala al: tocar\nmetadata:\n  tipo: servicio\n  comprobado: "2026-10-09"\n---\n# x');
  assert.deepEqual([f.name, f.description, f.tipo, f.comprobado], ["hetzner", "Úsala al: tocar", "servicio", "2026-10-09"]);
  assert.deepEqual(frontmatter("sin cabecera"), {});
});
test("tablaMarkdown saca las filas de la tabla tras el encabezado", () => {
  const md = "## 2. Otro\n| a | b |\n|---|---|\n| no | no |\n\n## 3. Qué pipeline\n\ntexto\n\n| Acción | Pipeline |\n|---|---|\n| Bug | `revisor` → `datos` |\n| CI | `gobierno` |\n\nfin";
  assert.deepEqual(tablaMarkdown(md, "Qué pipeline"), [{ "Acción": "Bug", Pipeline: "`revisor` → `datos`" }, { "Acción": "CI", Pipeline: "`gobierno`" }]);
  assert.deepEqual(tablaMarkdown(md, "No existe"), []);
});
test("caducidad: 90 días desde la comprobación", () => {
  assert.deepEqual(caducidad("2026-10-09", new Date("2026-10-10T00:00:00Z")), { caduca: "2027-01-07", dias: 89 });
  assert.deepEqual(caducidad("", new Date()), { caduca: "", dias: "" });
});

const informe = {
  cobertura: { sesiones: 3 }, eventos: { total: 2, por_evento: { bloqueo_guardia: { total: 2, nombres: { stash: 2 } } } },
  sinIssue: { minutos: 90.5, coste_usd: 12.3, tokens: { total: 1000 }, agentes: { revisor: 4 } },
};
test("validarInforme acepta un informe de fabrica y rechaza lo demás", () => {
  assert.equal(validarInforme(informe).ok, true);
  assert.equal(validarInforme(null).ok, false);
  assert.equal(validarInforme([]).ok, false);
  assert.match(validarInforme({ ...informe, sinIssue: { minutos: "9" } }).error, /sinIssue/);
  assert.match(validarInforme({ ...informe, cobertura: {} }).error, /cobertura/);
});
test("diaDe da el día de Madrid, no el de UTC", () => {
  assert.equal(diaDe(new Date("2026-10-10T22:30:00Z")), "2026-10-11"); // 00:30 en Madrid
});

test("esc escapa el HTML que llega de fuera", () => {
  assert.equal(esc(`<b a="1">&'`), "&lt;b a=&quot;1&quot;&gt;&amp;&#39;");
});
test("tabla no deja pasar HTML de los datos", () => {
  assert.ok(!tabla([{ x: "<script>" }], ["x"]).includes("<script>"));
});
test("filas acepta lista y objeto", () => {
  assert.equal(filas([{ termino: "a" }])[0].id, "a");
  assert.equal(filas({ b: { y: 1 } })[0].id, "b");
});

const issue = {
  number: 158, state: "open", title: "Panel", body: "**Objetivo.** x\n\n```encargo\nfondo: #334\ntipo_accion: preventivo\n```",
  labels: [{ name: "tipo:encargo" }, { name: "area:ops" }], assignees: [{ login: "pabloam89" }],
};
test("filaIssue saca tipo, área, fondo y asignado", () => {
  const f = filaIssue(issue, "o/r");
  assert.deepEqual([f.n, f.tipo, f.area, f.fondo, f.estado, f.asignado, f.causa], [158, "encargo", "ops", "334", "abierto", "pabloam89", ""]);
  assert.equal(f.url, "https://github.com/o/r/issues/158");
});
test("filaIssue aguanta un issue sin cuerpo ni etiquetas", () => {
  const f = filaIssue({ number: 1, state: "closed", title: "t" }, "o/r");
  assert.deepEqual([f.tipo, f.fondo, f.estado], ["", "", "cerrado"]);
});
test("contar agrupa por dos claves", () => {
  const r = contar([{ tipo: "caso", estado: "abierto" }, { tipo: "caso", estado: "abierto" }, { tipo: "", estado: "cerrado" }], "tipo", "estado");
  assert.deepEqual(r, { caso: { abierto: 2 }, "(sin)": { cerrado: 1 } });
});

import { pasosTexto, porFondo } from "./lib.mjs";
test("pasosTexto une pasos, paralelos, opcionales y cierre", () => {
  const t = { pasos: [{ agentes: ["lola"] }, { agentes: ["evaluador", "revisor"] }, { opcional: [{ agente: "seguridad", si: "escribe datos" }] }], cierra_con: "OK" };
  assert.equal(pasosTexto(t), "lola → evaluador + revisor → [seguridad si escribe datos] → OK");
});
test("porFondo cuenta encargos y casos de cada fondo y suma lo medido", () => {
  const is = [
    { n: 10, tipo: "fondo", titulo: "F", estado: "abierto", causa: "x", fondo: "" },
    { n: 11, tipo: "encargo", estado: "abierto", fondo: "10" },
    { n: 12, tipo: "encargo", estado: "cerrado", fondo: "10" },
    { n: 13, tipo: "caso", estado: "cerrado", fondo: "10" },
    { n: 14, tipo: "encargo", estado: "abierto", fondo: "99" },
  ];
  const r = porFondo(is, [{ issue: 12, minutos: 90, coste_usd: 3 }, { issue: 14, minutos: 60, coste_usd: 9 }]);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].encargos, r[0].encargos_abiertos, r[0].casos, r[0].medidos, r[0].horas, r[0].coste_usd], [2, 1, 1, 1, 1.5, 3]);
});

import { entidadesVista } from "./lib.mjs";
const ents = {
  entidades: [
    { id: "evento", nombre: "Evento", eje: "puente", definicion: "Un hecho <con> fecha.", fuente_de_verdad: "hooks", registro: "parcial", nota: "n" },
    { id: "sesion", nombre: "Sesión", eje: "horizontal", definicion: "d", fuente_de_verdad: "ninguna", registro: "sin_registro" },
    { id: "casa", nombre: "Casa", eje: "vertical", definicion: "d", fuente_de_verdad: "x", registro: "con_registro" },
  ],
  relaciones: [{ a: "evento", relacion: "ocurre_en", b: "sesion", campo: "sesion" }],
};
test("entidadesVista: la ficha enseña las relaciones que salen y las que llegan, enlazadas", () => {
  const ev = entidadesVista(ents, "evento").html, se = entidadesVista(ents, "sesion").html;
  assert.match(ev, /Relaciones que salen \(1\)[\s\S]*ocurre_en[\s\S]*href="\/entidades\/sesion"/);
  assert.match(se, /Relaciones que llegan \(1\)[\s\S]*href="\/entidades\/evento"/);
  assert.match(se, /Relaciones que salen \(0\)[\s\S]*Ninguna/);
});
test("entidadesVista: barra lateral con todas por eje, escapa HTML y rechaza un id desconocido", () => {
  const r = entidadesVista(ents, "evento");
  for (const id of ["evento", "sesion", "casa"]) assert.ok(r.html.includes(`href="/entidades/${id}"`));
  assert.ok(!r.html.includes("<con>") && r.html.includes("&lt;con&gt;"));
  assert.equal(entidadesVista(ents, "nada").existe, false);
  assert.match(entidadesVista(ents).html, /3 entidades y 1 relaciones/);
});

import { markdownAHtml, bibliotecaDiseno, ancla } from "./markdown.mjs";
const NL = String.fromCharCode(10);
const md = (...l) => l.join(NL);

test("markdownAHtml: títulos con ancla, tablas, listas y escape de HTML", () => {
  const r = markdownAHtml(md("## Qué es", "", "| a | b |", "|---|---|", "| **x** | <script> |", "", "- uno", "- `dos`"));
  assert.match(r.html, /<h2 id="que-es">/);
  assert.match(r.html, /<th scope="col">a<[/]th>/);
  assert.match(r.html, /<strong>x<[/]strong>/);
  assert.ok(!r.html.includes("<script>"));
  assert.match(r.html, /<li><code>dos<[/]code><[/]li>/);
  assert.deepEqual(r.titulos.map((t) => t.id), ["que-es"]);
  assert.equal(ancla("Áé Ñ"), "ae-n");
});

test("markdownAHtml: un enlace javascript: no se convierte en enlace y los títulos repetidos no chocan", () => {
  const r = markdownAHtml(md("## A", "", "## A", "", "[x](javascript:alert(1))"));
  assert.ok(!r.html.includes("<a "));
  assert.deepEqual(r.titulos.map((t) => t.id), ["a", "a-2"]);
});

test("bibliotecaDiseno: barra con documentos e índice del abierto; un id desconocido no existe", () => {
  const docs = [{ id: "meta", titulo: "Meta", fichero: "m.md" }, { id: "x", titulo: "X", fichero: "x.md" }];
  const v = bibliotecaDiseno(docs, "meta", md("## Uno", "", "### Dos", ""));
  assert.ok(v.html.includes('href="/diseno/x"') && v.html.includes('href="#uno"') && v.html.includes('href="#dos"'));
  assert.equal(bibliotecaDiseno(docs, "nada", "").existe, false);
  assert.equal(bibliotecaDiseno(docs).existe, true);
});

import { readFileSync as leerFichero, readdirSync as listarDir } from "node:fs";
test("el Dockerfile copia todos los .mjs de la raíz (si falta uno, el contenedor se cae al arrancar)", () => {
  const dockerfile = leerFichero(new URL("./Dockerfile", import.meta.url), "utf8");
  for (const f of listarDir(new URL("./", import.meta.url)).filter((x) => x.endsWith(".mjs"))) assert.ok(dockerfile.includes(f), `${f} no está en el Dockerfile`);
});

// ---- Sistema de diseño (estilo.mjs): contraste, colores sueltos y estructura de la página ----
import { CSS, PAREJAS, SIN_PAREJA, CLARO, OSCURO } from "./estilo.mjs";
import { banner, insignia, pagina, portada, tarjetas, SECCIONES } from "./lib.mjs";

// Los tokens de cada tema, leídos del CSS que se sirve (no de los objetos que lo generan).
const temas = {};
for (const m of CSS.matchAll(/[/][*] tema:([a-z-]+) [*][/][^{]*[{]([^}]*)[}]/g)) {
  temas[m[1]] = Object.fromEntries([...m[2].matchAll(/--([a-z0-9-]+):([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
}
const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luz = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * canal(n >> 16) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255); };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test("contraste WCAG: cada pareja texto/fondo declarada llega a su mínimo en tema claro y oscuro", () => {
  assert.deepEqual(Object.keys(temas).sort(), ["claro", "oscuro", "oscuro-sistema"]);
  const fallos = [];
  for (const tema of ["claro", "oscuro"]) {
    for (const [fg, bg, minimo] of PAREJAS) {
      const [a, b] = [temas[tema][fg], temas[tema][bg]];
      assert.match(a ?? "", /^#[0-9a-f]{6}$/i, `${tema}: falta el token ${fg}`);
      assert.match(b ?? "", /^#[0-9a-f]{6}$/i, `${tema}: falta el token ${bg}`);
      const c = contraste(a, b);
      if (c < minimo) fallos.push(`${tema}: ${fg} ${a} sobre ${bg} ${b} = ${c.toFixed(2)} (mínimo ${minimo})`);
    }
  }
  assert.deepEqual(fallos, []);
});

test("temas: el oscuro del sistema y el forzado son el mismo, y los dos temas definen los mismos tokens", () => {
  assert.deepEqual(temas["oscuro-sistema"], temas.oscuro);
  const colores = (t) => Object.keys(t).filter((k) => !(k in temas.claro) || k in OSCURO);
  assert.deepEqual(Object.keys(CLARO).sort(), Object.keys(OSCURO).sort());
  assert.ok(colores(temas.claro).length > 10);
});

test("cada token de color está en alguna pareja de contraste (o es decorativo y está declarado)", () => {
  const enPareja = new Set(PAREJAS.flat());
  const sin = Object.keys(CLARO).filter((k) => !enPareja.has(k) && !SIN_PAREJA.includes(k));
  assert.deepEqual(sin, []);
});

test("el CSS no tiene colores sueltos fuera de la sección de tokens", () => {
  const ini = CSS.indexOf("/* tokens:inicio */"), fin = CSS.indexOf("/* tokens:fin */");
  assert.ok(ini >= 0 && fin > ini, "faltan las marcas de la sección de tokens");
  const fuera = CSS.slice(0, ini) + CSS.slice(fin + "/* tokens:fin */".length);
  assert.ok(fuera.length > 1000);
  assert.deepEqual(fuera.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], []);
  assert.deepEqual(fuera.match(/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color-mix|color)\(/g) ?? [], []);
  assert.deepEqual(fuera.match(/(?:color|background|border[a-z-]*|outline[a-z-]*)\s*:[^;}]*\b(?:white|black|red|blue|green|gray|grey|yellow|orange|purple|pink|brown)\b/g) ?? [], []);
});

test("todo var(--x) del CSS apunta a un token definido", () => {
  const definidos = new Set(Object.keys(temas.claro));
  const usados = new Set([...CSS.matchAll(/var[(]--([a-z0-9-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...usados].filter((u) => !definidos.has(u)), []);
});

test("ningún otro módulo mete estilos: ni <style> ni style= fuera de estilo.mjs", () => {
  for (const f of ["server.mjs", "markdown.mjs"]) assert.ok(!/<style|style=/.test(leerFichero(new URL(`./${f}`, import.meta.url), "utf8")), f);
  const lib = leerFichero(new URL("./lib.mjs", import.meta.url), "utf8");
  assert.equal((lib.match(/<style/g) ?? []).length, 1);
  assert.ok(!/style=/.test(lib));
});

test("pagina: idioma, saltar al contenido, un h1, navegación agrupada y elemento activo con aria-current", () => {
  const h = pagina("Fondos", "Proyecto <x>", "<p>hola</p>", "/fondos");
  assert.match(h, /<html lang="es">/);
  assert.match(h, /<a class="salto" href="#contenido">Saltar al contenido<[/]a>/);
  assert.equal((h.match(/<h1>/g) ?? []).length, 1);
  assert.ok(h.includes("<title>Fondos · Proyecto &lt;x&gt;</title>"));
  for (const g of ["Conocimiento", "Trabajo", "Mapa"]) assert.ok(h.includes(`>${g}<`), g);
  assert.equal((h.match(/aria-current="page">/g) ?? []).length, 1);
  assert.match(h, /<a href="[/]fondos" aria-current="page">Fondos<[/]a>/);
  assert.match(pagina("Ficha", "P", "", "/entidades/evento"), /<a href="[/]entidades" aria-current="page">/);
  assert.match(pagina("Inicio", "P", "", "/"), /class="marca" href="[/]" aria-current="page"/);
});

test("portada: una tarjeta con enlace y descripción por cada sección de la navegación", () => {
  const h = portada("o/r", "staging");
  for (const s of SECCIONES.flatMap((g) => g.items)) assert.ok(h.includes(`href="${s.href}"`) && h.includes(s.para.slice(0, 20)), s.href);
});

test("insignia, banner, tarjetas y tabla: texto además del color, escapado y números a la derecha", () => {
  assert.match(insignia("abierto"), /i-informacion">abierto</);
  assert.match(insignia("raro<"), /i-neutro">raro&lt;</);
  assert.match(banner("error", "x"), /role="alert"[^>]*><p><strong>Error[.]/);
  assert.ok(!tarjetas([{ etiqueta: "<b>", valor: 3 }]).includes("<b>"));
  const t = tabla([{ n: 1, estado: "cerrado", x: "a" }, { n: 22, estado: "abierto", x: "b" }], ["n", "estado", "x"]);
  assert.match(t, /<th scope="col" class="num">n<[/]th>/);
  assert.ok(t.includes('<td class="num">22</td>') && t.includes("i-exito") && !t.includes('<th scope="col" class="num">x'));
  assert.match(tabla([], ["a"]), /class="vacio"/);
});

import { entidadesDeRegistro } from "./lib.mjs";
test("entidadesDeRegistro traduce el registro en inglés (MenuPlan#566) a lo que lee la vista", () => {
  const r = entidadesDeRegistro({ entities: [{ id: "session", name: "Sesión", axis: "bridge", registry: "partial", source_of_truth: "x", id_format: "none", note: "n" }],
    relations: [{ from: "session", relation: "works_in", to: "branch", stored_as: "field", stored_in: "rama" }] });
  assert.equal(r.entidades[0].eje, "puente");
  assert.equal(r.entidades[0].registro, "parcial");
  assert.deepEqual(r.relaciones[0], { a: "session", relacion: "works_in", b: "branch", campo: "rama" });
  assert.equal(entidadesDeRegistro({ entidades: [1], relaciones: [] }).entidades[0], 1); // la forma antigua pasa tal cual
  assert.match(entidadesVista(r, "session").html, /Sesión/);
});

import { biblioteca } from "./markdown.mjs";
import { documentosDeFuente } from "./lib.mjs";
test("documentosDeFuente: ficheros sueltos y los .md de cada carpeta, con su grupo e id sin chocar", () => {
  const cfg = { documentos: [{ id: "claude", titulo: "CLAUDE.md", fichero: "CLAUDE.md" }],
    directorios: [{ id: "agentes", titulo: "Agentes", directorio: ".claude/agents" }, { id: "estandares", titulo: "Estándares", directorio: "estandares" }] };
  const listados = { ".claude/agents": [{ type: "file", name: "revisor.md" }, { type: "file", name: "x.json" }, { type: "dir", name: "sub" }], estandares: null };
  const d = documentosDeFuente(cfg, listados);
  assert.deepEqual(d.map((x) => x.id), ["claude", "agentes-revisor"]);
  assert.deepEqual(d[1], { id: "agentes-revisor", titulo: "revisor.md", fichero: ".claude/agents/revisor.md", grupo: "Agentes" });
  assert.deepEqual(documentosDeFuente({}, {}), []);
});

test("biblioteca: base propia, grupos en la barra, frontmatter como bloque y la fuente en la nota", () => {
  const docs = [{ id: "claude", titulo: "CLAUDE.md", fichero: "CLAUDE.md" }, { id: "agentes-revisor", titulo: "revisor.md", fichero: ".claude/agents/revisor.md", grupo: "Agentes" }];
  const v = biblioteca({ base: "/fabrica", docs, actual: "agentes-revisor", md: md("---", "name: revisor", "---", "", "## Uno"), titulo: "Factoría", fuente: "rama main de o/r", etiqueta: "Ficheros" });
  assert.ok(v.html.includes('href="/fabrica/claude"') && v.html.includes(">Agentes<") && v.html.includes('href="#uno"'));
  assert.ok(v.html.includes("<pre") && v.html.includes("name: revisor") && !v.html.includes("<hr>"));
  assert.ok(v.html.includes("rama main de o/r"));
  assert.equal(v.titulo, "revisor.md");
  assert.equal(biblioteca({ base: "/fabrica", docs, actual: "nada", md: "", titulo: "F" }).existe, false);
  // la de diseño sigue igual: misma ruta y misma nota
  assert.ok(bibliotecaDiseno(docs, "claude", "").html.includes('href="/diseno/agentes-revisor"') && bibliotecaDiseno(docs, "claude", "").html.includes("rama staging de MenuPlan"));
});

test("la Factoría está en la navegación y su config no lleva clave ni token", () => {
  assert.ok(SECCIONES.flatMap((g) => g.items).some((s) => s.href === "/fabrica"));
  const cfg = JSON.parse(leerFichero(new URL("./config/fabrica.json", import.meta.url), "utf8"));
  assert.equal(cfg.repo, "pabloam89/fabrica");
  assert.ok(!/token|clave|secret/i.test(JSON.stringify(cfg)));
});
