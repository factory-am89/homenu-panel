#!/usr/bin/env node
// Corre en el PC de Pablo: lee las sesiones abiertas de la Fábrica y las envía al panel por la red privada.
//
//   node cliente/enviar-sesiones.mjs --fabrica C:/dev/fabrica [--url http://100.73.252.32:8080]
//
// Ejecuta `node <fabrica>/scripts/sesiones.mjs --json` y manda su salida tal cual: la forma vive en la Fábrica y el panel
// la valida al recibir (422 si no encaja). Sale 0 solo si el panel lo guardó; cualquier otro caso sale distinto de 0 y
// escribe el motivo en stderr (quien lo lance, p. ej. una tarea programada, debe devolver ese código y no tragárselo).
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const arg = (n, def) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : def; };
const fabrica = arg("fabrica");
const url = arg("url", "http://100.73.252.32:8080");
if (!fabrica) { console.error("Falta --fabrica <carpeta principal de la Fábrica>"); process.exit(2); }

let salida;
try {
  salida = execFileSync(process.execPath, [join(fabrica, "scripts", "sesiones.mjs"), "--json"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 30_000, stdio: ["ignore", "pipe", "inherit"],
  });
  JSON.parse(salida); // si no es JSON, falla aquí y no se envía nada
} catch (e) {
  console.error(`enviar-sesiones: no pude leer las sesiones de ${fabrica}: ${e.message}`);
  process.exit(3);
}

try {
  const r = await fetch(`${url}/ingest/sesiones`, {
    method: "POST", headers: { "content-type": "application/json" }, body: salida, signal: AbortSignal.timeout(20_000),
  });
  const texto = await r.text();
  console.log(`enviar-sesiones resultado: ${r.ok ? "ok" : "fallo"} estado: ${r.status} respuesta: ${texto}`);
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.error(`enviar-sesiones: no pude hablar con ${url}: ${e.message}`);
  process.exit(4);
}
