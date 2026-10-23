import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insignia } from "./lib.mjs";
import { crearServidor } from "./server.mjs";
import { promisify } from "node:util";
import { ESTADOS, PC_CALLADO_MIN, SIN_SENAL_MIN, estadoDe, validarSesiones, vistaCockpit } from "./cockpit.mjs";

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

test("ESTADOS es la única lista: estadoDe solo devuelve sus claves y cada insignia sale con su tono, no neutra", () => {
  const vistos = new Set([estadoDe(sesion("abcdef-1", "a", 0), AHORA, false).estado, estadoDe(sesion("abcdef-1", "a", 99), AHORA, false).estado, estadoDe(sesion("abcdef-1", "a", 0), AHORA, true).estado]);
  assert.deepEqual([...vistos].sort(), Object.keys(ESTADOS).sort());
  const html = vistaCockpit({ recibido: hace(0), sesiones: [sesion("abcdef-1", "a", 0), sesion("abcdef-2", "b", 99)] }, AHORA);
  for (const [estado, tono] of Object.entries(ESTADOS)) assert.ok(html.includes(`class="insignia i-${tono}">${estado}<`), estado);
  assert.ok(insignia("activa").includes("i-neutro"), "lib.mjs no guarda copia de los estados del cockpit");
});

// ---- El circuito entero: el envío real contra el servidor real, con una Fábrica falsa ----
// Cada test levanta su servidor con su carpeta de datos y su hora fija: ninguno depende de otro ni del reloj.
const FABRICA_FALSA = join(import.meta.dirname, "fixtures", "fabrica-falsa");
const ENVIAR = join(import.meta.dirname, "cliente", "enviar-sesiones.mjs");

async function conPanel(prueba, reloj = () => AHORA) {
  const servidor = crearServidor({ datos: mkdtempSync(join(tmpdir(), "panel-cockpit-")), reloj });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const enviar = (env = {}, url = base) => correr(process.execPath, [ENVIAR, "--fabrica", FABRICA_FALSA, "--url", url],
    { env: { ...process.env, FABRICA_FALSA_AHORA: String(AHORA), ...env } });
  try { await prueba({ base, enviar }); } finally { servidor.close(); }
}

test("circuito: /cockpit antes de cualquier envío dice que no hay datos", () => conPanel(async ({ base }) => {
  const r = await fetch(`${base}/cockpit`);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /ningún envío/);
}));

test("circuito: el envío real llega, sale 0 y /cockpit enseña las dos sesiones, una activa y otra sin señal", () => conPanel(async ({ base, enviar }) => {
  const { stdout } = await enviar();
  assert.match(stdout, /resultado: ok estado: 200/);
  const html = await (await fetch(`${base}/cockpit`)).text();
  assert.match(html, /data-sesion="sesion-viva-1" data-estado="activa"/);
  assert.match(html, /data-sesion="sesion-callada-2" data-estado="sin señal"/);
  assert.doesNotMatch(html, /Sin noticias del PC/);
  assert.ok(!html.includes("C:\\dev"), "la carpeta del PC no se enseña");
}));

test("circuito: el mismo envío visto 10 min después, con el PC callado, sale todo sin señal", async () => {
  let ahora = AHORA;
  await conPanel(async ({ base, enviar }) => {
    await enviar();
    ahora = AHORA + 10 * 60_000;
    const html = await (await fetch(`${base}/cockpit`)).text();
    assert.match(html, /Sin noticias del PC desde las 14:00 \(Madrid\)/);
    assert.doesNotMatch(html, /data-estado="activa"/);
  }, () => ahora);
});

test("circuito: si la Fábrica falla, el envío sale distinto de 0 y no manda nada", () => conPanel(async ({ base, enviar }) => {
  await assert.rejects(enviar({ FABRICA_FALSA_FALLA: "1" }), (e) => e.code === 3 && /no pude leer las sesiones/.test(e.stderr));
  assert.match(await (await fetch(`${base}/cockpit`)).text(), /ningún envío/);
}));

test("circuito: si el panel no contesta, el envío sale distinto de 0", () => conPanel(async ({ enviar }) => {
  await assert.rejects(enviar({}, "http://127.0.0.1:1"), (e) => e.code === 4);
}));

test("circuito: el servidor rechaza con 422 una forma que no encaja y con 400 lo que no es JSON", () => conPanel(async ({ base }) => {
  const post = (cuerpo) => fetch(`${base}/ingest/sesiones`, { method: "POST", body: cuerpo });
  assert.equal((await post(JSON.stringify({ sesiones: "x" }))).status, 422);
  assert.equal((await post("no es json")).status, 400);
}));
