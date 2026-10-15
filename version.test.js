import test from "node:test";
import assert from "node:assert/strict";
import { servidor } from "./server.mjs";

async function pedir(ruta) {
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  try {
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}${ruta}`);
    return { estado: r.status, texto: await r.text() };
  } finally {
    await new Promise((ok) => servidor.close(ok));
  }
}

test("GET /version devuelve el SHA con el que se construyó (GIT_SHA)", async () => {
  process.env.GIT_SHA = "abc";
  const r = await pedir("/version");
  assert.equal(r.estado, 200);
  assert.equal(r.texto, "abc");
});

test("GET /version sin GIT_SHA devuelve sin-version", async () => {
  delete process.env.GIT_SHA;
  const r = await pedir("/version");
  assert.equal(r.estado, 200);
  assert.equal(r.texto, "sin-version");
});

test("GIT_SHA vacío cuenta como sin variable: sin-version", async () => {
  process.env.GIT_SHA = "";
  assert.equal((await pedir("/version")).texto, "sin-version");
});
