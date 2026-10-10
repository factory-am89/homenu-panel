import test from "node:test";
import assert from "node:assert/strict";
import { contar, esc, filaIssue, filas, tabla } from "./lib.mjs";

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
