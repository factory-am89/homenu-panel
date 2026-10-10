#!/usr/bin/env node
// Corre en el PC de Pablo: mide con `npm run fabrica` de MenuPlan y envía el informe al panel por la red privada.
//
//   node cliente/enviar-fabrica.mjs --menuplan C:\dev\MenuPlan-panel-lectura [--url http://100.73.252.32:8080]
//        [--solo-si-cambia] [--actualizar] [--sin-github]
//
// El informe son agregados numéricos (el propio fabrica dice: ni mensajes, ni prompts, ni rutas). Une las sesiones con
// los issues (coste y tiempo por encargo); desde MenuPlan#532 esa consulta es ligera. --sin-github solo mide sesiones.
// --menuplan es un clon de staging solo para esto (no la carpeta de trabajo, que va por detrás y con cambios).
// Sale 0 si el panel lo guardó.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const arg = (n, def) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : def; };
const menuplan = arg("menuplan");
const url = arg("url", "http://100.73.252.32:8080");
if (!menuplan) { console.error("Falta --menuplan <carpeta de MenuPlan>"); process.exit(2); }

// --solo-si-cambia: si ninguna transcripción de MenuPlan ha cambiado desde el último envío bueno, no hace nada.
// Es lo que permite lanzarlo cada pocos minutos sin que el PC pague los ~22 s de `fabrica` en vano.
const carpeta = join(homedir(), ".claude", "menuplan-fabrica");
const marca = join(carpeta, "ultimo-envio.txt");
if (process.argv.includes("--solo-si-cambia")) {
  const proyectos = join(homedir(), ".claude", "projects");
  let ultima = 0;
  for (const d of readdirSync(proyectos).filter((x) => /MenuPlan/i.test(x))) {
    for (const f of readdirSync(join(proyectos, d), { recursive: true })) {
      if (String(f).endsWith(".jsonl")) ultima = Math.max(ultima, statSync(join(proyectos, d, String(f))).mtimeMs);
    }
  }
  const anterior = existsSync(marca) ? Number(readFileSync(marca, "utf8")) : 0;
  if (ultima <= anterior) { console.log("enviar-fabrica resultado: sin-cambios"); process.exit(0); }
  globalThis.__ultima = ultima;
}

// Si --menuplan es una copia de solo lectura para el panel (clon de staging), se pone al día antes de medir.
if (process.argv.includes("--actualizar")) {
  try { execFileSync("git", ["-C", menuplan, "pull", "--ff-only", "-q"], { stdio: "ignore", timeout: 60_000 }); }
  catch { console.error("enviar-fabrica aviso: no pude actualizar la copia de MenuPlan; se mide con la que hay"); }
}

const opciones = ["--json", ...(process.argv.includes("--sin-github") ? ["--sin-github"] : [])];
const salida = execFileSync(process.execPath, [join(menuplan, "scripts", "fabrica.mjs"), ...opciones], {
  cwd: menuplan, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
});
JSON.parse(salida); // si no es JSON, falla aquí y no se envía nada

const r = await fetch(`${url}/ingest/fabrica`, {
  method: "POST", headers: { "content-type": "application/json" }, body: salida, signal: AbortSignal.timeout(20_000),
});
const texto = await r.text();
if (r.ok && globalThis.__ultima) { mkdirSync(carpeta, { recursive: true }); writeFileSync(marca, String(globalThis.__ultima)); }
console.log(`enviar-fabrica resultado: ${r.ok ? "ok" : "fallo"} estado: ${r.status} respuesta: ${texto}`);
process.exit(r.ok ? 0 : 1);
