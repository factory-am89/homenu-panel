import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const SCRIPT = new URL("./desplegar.sh", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// docker, curl y sleep falsos en un PATH propio: nada toca Docker, la red ni el reloj.
function entorno() {
  const dir = mkdtempSync(join(tmpdir(), "desplegar-")).replaceAll("\\", "/");
  const bin = `${dir}/bin`;
  const falso = (nombre, cuerpo) => { writeFileSync(`${bin}/${nombre}`, `#!/bin/sh\n${cuerpo}\n`); chmodSync(`${bin}/${nombre}`, 0o755); };
  spawnSync("mkdir", ["-p", bin]);
  falso("docker", `echo "$* [GIT_SHA=\${GIT_SHA:-}]" >> "$LOG"
case "$*" in
  "compose -p app build") exit "\${BUILD_SALE:-0}" ;;
  "compose -p app up -d") exit "\${UP_SALE:-0}" ;;
  "compose -p app port panel 8080") echo 127.0.0.1:8080 ;;
  *) echo "docker falso: orden inesperada: $*" >&2; exit 99 ;;
esac`);
  // curl contesta lo que diga VERSION; si VERSION_TRAS=n, las n primeras llamadas fallan como un servidor que aún no arranca
  falso("curl", `echo "curl $*" >> "$LOG"
n=$(cat "$CUENTA" 2>/dev/null || echo 0); n=$((n+1)); echo $n > "$CUENTA"
[ "$n" -gt "\${VERSION_TRAS:-0}" ] || exit 7
printf '%s' "\${VERSION:-}"`);
  falso("sleep", `echo "sleep $*" >> "$LOG"`);
  return { dir, bin, log: `${dir}/log`, cuenta: `${dir}/cuenta` };
}

function lanzar(args, extra = {}) {
  const e = entorno();
  writeFileSync(e.log, "");
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== "PATH"));
  const r = spawnSync("sh", [SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...base, PATH: `${e.bin}${delimiter}${process.env.PATH ?? process.env.Path}`, LOG: e.log, CUENTA: e.cuenta, ...extra },
  });
  return { ...r, llamadas: readFileSync(e.log, "utf8").split("\n").filter(Boolean) };
}
const huboUp = (r) => r.llamadas.some((l) => l.startsWith("compose -p app up"));

test("todo bien: construye con GIT_SHA, levanta, ve el SHA y sale con 0", () => {
  const r = lanzar(["abc123"], { VERSION: "abc123" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.llamadas[0], /^compose -p app build \[GIT_SHA=abc123\]$/);
  assert.match(r.llamadas[1], /^compose -p app up -d /);
});

test("el build falla: código fallo-build (10) y up NO se llama", () => {
  const r = lanzar(["abc123"], { BUILD_SALE: "1", VERSION: "abc123" });
  assert.equal(r.status, 10);
  assert.equal(huboUp(r), false, "no debe levantar nada si el build falló");
});

test("el SHA no aparece a tiempo: código fallo-arranque (11), tras reintentar", () => {
  const r = lanzar(["abc123"], { VERSION: "otro-sha", ESPERA_MAX: "4", ESPERA_PASO: "2" });
  assert.equal(r.status, 11);
  assert.equal(r.llamadas.filter((l) => l.startsWith("curl")).length, 3); // t=0, 2, 4
  assert.equal(r.llamadas.filter((l) => l.startsWith("sleep")).length, 2);
});

test("el servidor tarda: contesta a la tercera y sale con 0", () => {
  const r = lanzar(["abc123"], { VERSION: "abc123", VERSION_TRAS: "2", ESPERA_MAX: "60" });
  assert.equal(r.status, 0, r.stderr);
});

test("up falla: fallo-arranque (11) sin esperar", () => {
  const r = lanzar(["abc123"], { UP_SALE: "1", VERSION: "abc123" });
  assert.equal(r.status, 11);
  assert.equal(r.llamadas.some((l) => l.startsWith("curl")), false);
});

test("sin SHA: error de uso (2) y no toca docker", () => {
  const r = lanzar([], {});
  assert.equal(r.status, 2);
  assert.deepEqual(r.llamadas, []);
});

test("el proyecto es siempre -p app (conserva el volumen de datos) y no hay '|| echo' que oculte el código", () => {
  const texto = readFileSync(SCRIPT, "utf8");
  assert.ok(!/\|\|\s*echo/.test(texto), "|| echo borra el código de salida");
  for (const l of texto.split("\n").filter((x) => /docker compose/.test(x) && !x.trim().startsWith("#"))) assert.match(l, /-p app/, l);
  assert.ok(existsSync(SCRIPT));
});
