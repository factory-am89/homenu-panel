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
  assert.match(r.html, /<th>a<[/]th>/);
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
