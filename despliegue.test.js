import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const conEstado = (contenido) => {
  const fichero = join(mkdtempSync(join(tmpdir(), "estado-")), "estado.json");
  if (contenido !== undefined) writeFileSync(fichero, contenido);
  process.env.ESTADO_DESPLIEGUE = fichero;
};

test("fichero válido: 200 y el mismo JSON", async () => {
  const estado = { resultado: "desplegado", sha: "abc", desplegado: "abc", hora: "2026-10-15T10:00:00Z" };
  conEstado(JSON.stringify(estado));
  const r = await pedir("/despliegue");
  assert.equal(r.estado, 200);
  assert.deepEqual(JSON.parse(r.texto), estado);
});

test("sin fichero: 503", async () => {
  conEstado(undefined);
  const r = await pedir("/despliegue");
  assert.equal(r.estado, 503);
  assert.match(JSON.parse(r.texto).error, /estado\.json/);
});

test("resultado fuera del vocabulario: 503, nunca un estado inventado", async () => {
  conEstado(JSON.stringify({ resultado: "todo-perfecto", sha: "abc" }));
  const r = await pedir("/despliegue");
  assert.equal(r.estado, 503);
  assert.match(JSON.parse(r.texto).error, /vocabulario/);
  assert.equal(JSON.parse(r.texto).resultado, undefined);
});

test("JSON roto o sin resultado: 503", async () => {
  conEstado("{no es json");
  assert.equal((await pedir("/despliegue")).estado, 503);
  conEstado(JSON.stringify({ sha: "abc" }));
  assert.equal((await pedir("/despliegue")).estado, 503);
});

test("sin ESTADO_DESPLIEGUE definido: 503 que lo dice", async () => {
  delete process.env.ESTADO_DESPLIEGUE;
  const r = await pedir("/despliegue");
  assert.equal(r.estado, 503);
  assert.match(JSON.parse(r.texto).error, /ESTADO_DESPLIEGUE/);
});

test("cada clase de resultados.json se acepta", async () => {
  const clases = JSON.parse(readFileSync(new URL("./despliegue/resultados.json", import.meta.url), "utf8")).resultados;
  for (const resultado of clases) {
    conEstado(JSON.stringify({ resultado, sha: "abc" }));
    assert.equal((await pedir("/despliegue")).estado, 200, resultado);
  }
});

test("el contenedor tiene el vocabulario, la variable y el estado montado solo lectura", () => {
  const dockerfile = readFileSync(new URL("./Dockerfile", import.meta.url), "utf8");
  const compose = readFileSync(new URL("./compose.yaml", import.meta.url), "utf8");
  assert.match(dockerfile, /COPY despliegue\/resultados\.json/);
  const ruta = dockerfile.match(/ESTADO_DESPLIEGUE=(\S+)/)?.[1];
  assert.ok(ruta, "falta ENV ESTADO_DESPLIEGUE en el Dockerfile");
  const carpeta = ruta.replace(/\/estado\.json$/, "");
  assert.ok(compose.includes(`/var/lib/panel-despliegue:${carpeta}:ro`), "falta el montaje :ro de la carpeta de estado");
});
