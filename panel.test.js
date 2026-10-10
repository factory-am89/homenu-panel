import test from "node:test";
import assert from "node:assert/strict";
import { esc, filas, tabla } from "./lib.mjs";

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
