#!/usr/bin/env node
// Corre en el PC de Pablo: mide con `npm run fabrica` de MenuPlan y envía el informe al panel por la red privada.
//
//   node cliente/enviar-fabrica.mjs --menuplan C:\dev\MenuPlan [--url http://100.73.252.32:8080] [--con-github]
//
// El informe son agregados numéricos (el propio fabrica dice: ni mensajes, ni prompts, ni rutas). Por defecto va con
// --sin-github: la unión con los issues choca con el límite de GitHub (MenuPlan#424). Sale 0 si el panel lo guardó.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const arg = (n, def) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : def; };
const menuplan = arg("menuplan");
const url = arg("url", "http://100.73.252.32:8080");
if (!menuplan) { console.error("Falta --menuplan <carpeta de MenuPlan>"); process.exit(2); }

const opciones = ["--json", ...(process.argv.includes("--con-github") ? [] : ["--sin-github"])];
const salida = execFileSync(process.execPath, [join(menuplan, "scripts", "fabrica.mjs"), ...opciones], {
  cwd: menuplan, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
});
JSON.parse(salida); // si no es JSON, falla aquí y no se envía nada

const r = await fetch(`${url}/ingest/fabrica`, {
  method: "POST", headers: { "content-type": "application/json" }, body: salida, signal: AbortSignal.timeout(20_000),
});
const texto = await r.text();
console.log(`enviar-fabrica resultado: ${r.ok ? "ok" : "fallo"} estado: ${r.status} respuesta: ${texto}`);
process.exit(r.ok ? 0 : 1);
