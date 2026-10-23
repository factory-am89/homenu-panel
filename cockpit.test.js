import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PC_CALLADO_MIN, SIN_SENAL_MIN, estadoDe, validarSesiones, vistaCockpit } from "./cockpit.mjs";

const correr = promisify(execFile);
const AHORA = Date.parse("2026-10-23T12:00:00Z");
const hace = (min) => new Date(AHORA - min * 60_000).toISOString();
const sesion = (id, rama, min) => ({ id, rama, inicio: hace(min + 60), ultima: hace(min) });

test("validarSesiones acepta la salida de la Fábrica y guarda solo id, rama, inicio y ultima", () => {
  const entrada = { registro: "C:\\x", sesiones: [{ ...sesion("abcdef-1", "feat/x", 2), carpeta: "C:\\dev\\x", horas: 0.03, activa: true }] };
  const v = validarSesiones(entrada);
  assert.equal(v.ok, true);
  assert.deepEqual(Object.keys(v.sesiones[0]), ["id", "rama", "inicio", "ultima"]);
  assert.equal(validarSesiones({ sesiones: [] }).ok, true);
});

test("validarSesiones rechaza lo que no encaja, con el motivo", () => {
  assert.match(validarSesiones(null).error, /objeto/);
  assert.match(validarSesiones({}).error, /sesiones/);
  assert.match(validarSesiones({ sesiones: [{ ...sesion("abcdef-1", "feat/x", 1), ultima: "ayer" }] }).error, /sesiones\[0\]/);
  assert.match(validarSesiones({ sesiones: [{ ...sesion("../x", "feat/x", 1) }] }).error, /sesiones\[0\]/);
});

test("estadoDe: callada más de SIN_SENAL_MIN es sin señal, y con el PC callado todas lo son", () => {
  assert.equal(estadoDe(sesion("abcdef-1", "a", SIN_SENAL_MIN), AHORA, false).estado, "activa");
  assert.equal(estadoDe(sesion("abcdef-1", "a", SIN_SENAL_MIN + 1), AHORA, false).estado, "sin señal");
  assert.equal(estadoDe(sesion("abcdef-1", "a", 0), AHORA, true).estado, "sin señal");
});

test("vistaCockpit: sin envío es un error visible, no una lista vacía", () => {
  const html = vistaCockpit(null, AHORA);
  assert.match(html, /b-error/);
  assert.match(html, /ningún envío/);
});

test("vistaCockpit: PC sin enviar más de PC_CALLADO_MIN avisa con la hora de Madrid y marca todo sin señal", () => {
  const envio = { recibido: hace(PC_CALLADO_MIN + 7), sesiones: [sesion("abcdef-1", "feat/x", 1)] };
  const html = vistaCockpit(envio, AHORA);
  assert.match(html, /Sin noticias del PC desde las 13:50 \(Madrid\)/); // 11:50 UTC = 13:50 Madrid (CEST)
  assert.match(html, /data-estado="sin señal"/);
  assert.doesNotMatch(html, /data-estado="activa"/);
});

test("vistaCockpit: con el PC al día, activa y sin señal según el silencio; escapa la rama", () => {
  const envio = { recibido: hace(1), sesiones: [sesion("abcdef-1", "feat/viva", 2), sesion("abcdef-2", "fix/<b>", 40)] };
  const html = vistaCockpit(envio, AHORA);
  assert.match(html, /data-sesion="abcdef-1" data-estado="activa"/);
  assert.match(html, /data-sesion="abcdef-2" data-estado="sin señal"/);
  assert.match(html, /puede estar esperándote/);
  assert.doesNotMatch(html, /Sin noticias del PC/);
  assert.ok(!html.includes("<b>") && html.includes("fix/&lt;b&gt;"));
});

// ---- El circuito entero: el envío real contra el servidor real, con una Fábrica falsa ----
process.env.DATOS = mkdtempSync(join(tmpdir(), "panel-cockpit-"));
const { servidor } = await import("./server.mjs");
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${servidor.address().port}`;
test.after(() => servidor.close());

const FABRICA_FALSA = join(import.meta.dirname, "fixtures", "fabrica-falsa");
const enviar = (env = {}) => correr(process.execPath, [join(import.meta.dirname, "cliente", "enviar-sesiones.mjs"), "--fabrica", FABRICA_FALSA, "--url", base],
  { env: { ...process.env, ...env } });

test("circuito: /cockpit antes de cualquier envío dice que no hay datos", async () => {
  const r = await fetch(`${base}/cockpit`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /ningún envío/);
});

test("circuito: el envío real llega, sale 0 y /cockpit enseña las dos sesiones, una activa y otra sin señal", async () => {
  const { stdout } = await enviar();
  assert.match(stdout, /resultado: ok estado: 200/);
  const html = await (await fetch(`${base}/cockpit`)).text();
  assert.match(html, /data-sesion="sesion-viva-1" data-estado="activa"/);
  assert.match(html, /data-sesion="sesion-callada-2" data-estado="sin señal"/);
  assert.ok(!html.includes("C:\\dev"), "la carpeta del PC no se enseña");
});

test("circuito: si la Fábrica falla, el envío sale distinto de 0 y no manda nada", async () => {
  await assert.rejects(enviar({ FABRICA_FALSA_FALLA: "1" }), (e) => e.code === 3 && /no pude leer las sesiones/.test(e.stderr));
});

test("circuito: si el panel no contesta, el envío sale distinto de 0", async () => {
  await assert.rejects(correr(process.execPath, [join(import.meta.dirname, "cliente", "enviar-sesiones.mjs"), "--fabrica", FABRICA_FALSA, "--url", "http://127.0.0.1:1"]), (e) => e.code === 4);
});

test("circuito: el servidor rechaza con 422 una forma que no encaja y con 400 lo que no es JSON", async () => {
  const post = (cuerpo) => fetch(`${base}/ingest/sesiones`, { method: "POST", body: cuerpo });
  assert.equal((await post(JSON.stringify({ sesiones: "x" }))).status, 422);
  assert.equal((await post("no es json")).status, 400);
});
