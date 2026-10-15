import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const aRuta = (u) => decodeURIComponent(u.pathname).replace(/^\/([A-Za-z]:)/, "$1");
const TIRAR = aRuta(new URL("./despliegue/tirar.sh", import.meta.url));
const RESULTADOS = aRuta(new URL("./despliegue/resultados.json", import.meta.url));
const HAY_FLOCK = spawnSync("flock", ["--version"]).status === 0;

const GIT_ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const git = (cwd, ...args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV } });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

// Un mundo entero en una carpeta temporal: repo de origen, clon "del servidor", estado, y un desplegar.sh falso que apunta cada llamada.
function mundo() {
  const raiz = mkdtempSync(join(tmpdir(), "tirar-")).replaceAll("\\", "/");
  const origen = `${raiz}/origen`, repo = `${raiz}/repo`, bin = `${raiz}/bin`;
  for (const d of [origen, bin]) mkdirSync(d);
  git(origen, "init", "-q", "-b", "main");
  const m = {
    raiz, origen, repo, bin, estado: `${raiz}/estado`, lock: `${raiz}/lock`, llamadas: `${raiz}/llamadas`, ssh: `${raiz}/ssh`,
    commit(fichero, texto = fichero) {
      mkdirSync(join(origen, fichero, ".."), { recursive: true });
      writeFileSync(join(origen, fichero), `${texto}\n${Math.random()}\n`);
      git(origen, "add", "-A");
      git(origen, "commit", "-q", "-m", fichero);
      return git(origen, "rev-parse", "HEAD");
    },
    estadoJson: () => JSON.parse(readFileSync(`${raiz}/estado/estado.json`, "utf8")),
    despliegues: () => (existsSync(`${raiz}/llamadas`) ? readFileSync(`${raiz}/llamadas`, "utf8").split("\n").filter(Boolean) : []),
  };
  m.commit("README.md");
  git(raiz, "clone", "-q", origen, repo);
  // desplegar.sh falso: apunta el SHA recibido, sale con $DESPLEGAR_SALE, y si hay BLOQUEO avisa y espera a que exista ese fichero
  writeFileSync(`${raiz}/desplegar-falso.sh`, `echo "$1" >> "${m.llamadas}"
if [ -n "\${BLOQUEO:-}" ]; then : > "$BLOQUEO.aviso"; while [ ! -e "$BLOQUEO" ]; do sleep 0.05; done; fi
exit "\${DESPLEGAR_SALE:-0}"
`);
  // git que apunta con qué GIT_SSH_COMMAND se le llama, y luego es el git de verdad
  const falso = (nombre, cuerpo) => { writeFileSync(`${bin}/${nombre}`, `#!/bin/sh\n${cuerpo}\n`); chmodSync(`${bin}/${nombre}`, 0o755); };
  falso("git", `[ "$1" = fetch ] && echo "$GIT_SSH_COMMAND" >> "${m.ssh}"\nexec "${GIT_REAL}" "$@"`);
  // sin flock de verdad (Windows) los tests secuenciales usan uno que siempre concede; el de dos a la vez se salta
  if (!HAY_FLOCK) falso("flock", "exit 0");
  return m;
}
const GIT_REAL = spawnSync(process.platform === "win32" ? "where" : "which", ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0].replaceAll("\\", "/");

function entornoDe(m, extra = {}) {
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== "PATH"));
  return {
    ...base, ...GIT_ENV,
    PATH: `${m.bin}${delimiter}${process.env.PATH ?? process.env.Path}`,
    REPO: m.repo, ESTADO: m.estado, LOCK: m.lock, LLAVE: "/llave/de/prueba", DESPLEGAR: `${m.raiz}/desplegar-falso.sh`, ...extra,
  };
}
const tirar = (m, extra) => spawnSync("bash", [TIRAR], { encoding: "utf8", env: entornoDe(m, extra) });

test("primer commit: despliega, apunta desplegado y estado.json, sale 0", () => {
  const m = mundo();
  const sha = git(m.origen, "rev-parse", "HEAD");
  const r = tirar(m);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(m.despliegues(), [sha]);
  assert.equal(readFileSync(`${m.estado}/desplegado`, "utf8").trim(), sha);
  assert.equal(m.estadoJson().resultado, "desplegado");
  assert.equal(m.estadoJson().sha, sha);
});

test("el fetch usa la llave con IdentitiesOnly y StrictHostKeyChecking=yes", () => {
  const m = mundo();
  tirar(m);
  const orden = readFileSync(m.ssh, "utf8");
  assert.match(orden, /-i \/llave\/de\/prueba/);
  assert.match(orden, /-o IdentitiesOnly=yes/);
  assert.match(orden, /-o StrictHostKeyChecking=yes/);
});

test("nada nuevo: sin-cambios (0) y no llama a desplegar", () => {
  const m = mundo();
  tirar(m);
  const r = tirar(m);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(m.despliegues().length, 1);
  assert.equal(m.estadoJson().resultado, "sin-cambios");
});

for (const fichero of ["compose.yaml", "desplegar.sh", "despliegue/tirar.sh"]) {
  test(`un cambio en ${fichero}: necesita-ok y sale 1, sin desplegar`, () => {
    const m = mundo();
    tirar(m);
    m.commit(fichero);
    const r = tirar(m);
    assert.equal(r.status, 1);
    assert.equal(m.estadoJson().resultado, "necesita-ok");
    assert.equal(m.despliegues().length, 1);
  });
}

test("un cambio en otro fichero despliega el SHA nuevo", () => {
  const m = mundo();
  tirar(m);
  const sha = m.commit("server.mjs");
  assert.equal(tirar(m).status, 0);
  assert.deepEqual(m.despliegues().at(-1), sha);
  assert.equal(m.estadoJson().resultado, "desplegado");
});

for (const [salida, clase] of [[10, "fallo-build"], [11, "fallo-arranque"]]) {
  test(`desplegar sale con ${salida}: ${clase} en estado.json, sale 1 y no cambia desplegado`, () => {
    const m = mundo();
    const bueno = git(m.origen, "rev-parse", "HEAD");
    tirar(m);
    m.commit("server.mjs");
    const r = tirar(m, { DESPLEGAR_SALE: String(salida) });
    assert.equal(r.status, 1);
    assert.equal(m.estadoJson().resultado, clase);
    assert.equal(readFileSync(`${m.estado}/desplegado`, "utf8").trim(), bueno);
  });
}

test("el mismo SHA tras un fallo: sigue-fallido (1) sin reconstruir", () => {
  const m = mundo();
  tirar(m);
  m.commit("server.mjs");
  tirar(m, { DESPLEGAR_SALE: "10" });
  const antes = m.despliegues().length;
  const r = tirar(m);
  assert.equal(r.status, 1);
  assert.equal(m.estadoJson().resultado, "sigue-fallido");
  assert.equal(m.despliegues().length, antes);
});

test("tras un fallo, un commit nuevo se vuelve a intentar y, si va bien, limpia el fallo", () => {
  const m = mundo();
  tirar(m);
  m.commit("server.mjs");
  tirar(m, { DESPLEGAR_SALE: "11" });
  m.commit("lib.mjs");
  assert.equal(tirar(m).status, 0);
  assert.equal(existsSync(`${m.estado}/ultimo-fallido`), false);
});

test("un código de desplegar que no conoce: sale 70 y no inventa una clase en estado.json", () => {
  const m = mundo();
  tirar(m);
  m.commit("server.mjs");
  const r = tirar(m, { DESPLEGAR_SALE: "3" });
  assert.equal(r.status, 70);
  assert.equal(m.estadoJson().resultado, "desplegado"); // el de antes: no se pisa con una clase inventada
});

test("el fetch falla: fallo-fetch (1) y no despliega", () => {
  const m = mundo();
  git(m.repo, "remote", "set-url", "origin", `${m.raiz}/no-existe`);
  const r = tirar(m);
  assert.equal(r.status, 1);
  assert.equal(m.estadoJson().resultado, "fallo-fetch");
  assert.equal(m.despliegues().length, 0);
});

test("dos ejecuciones a la vez: solo una despliega y la otra apunta ocupado (0)", { skip: !HAY_FLOCK && "esta máquina no tiene flock (Linux sí)" }, async () => {
  const m = mundo();
  const bloqueo = `${m.raiz}/bloqueo`;
  const primera = spawn("bash", [TIRAR], { env: entornoDe(m, { BLOQUEO: bloqueo }), stdio: "ignore" });
  const termina = new Promise((ok) => primera.on("exit", ok));
  for (let i = 0; i < 400 && !existsSync(`${bloqueo}.aviso`); i++) await new Promise((ok) => setTimeout(ok, 50));
  assert.ok(existsSync(`${bloqueo}.aviso`), "la primera no llegó a desplegar");
  const segunda = tirar(m);
  assert.equal(segunda.status, 0, segunda.stderr);
  assert.equal(m.estadoJson().resultado, "ocupado");
  writeFileSync(bloqueo, "");
  assert.equal(await termina, 0);
  assert.equal(m.despliegues().length, 1);
  assert.equal(m.estadoJson().resultado, "desplegado");
});

test("el vocabulario del script es exactamente despliegue/resultados.json", () => {
  const permitido = JSON.parse(readFileSync(RESULTADOS, "utf8")).resultados;
  const texto = readFileSync(TIRAR, "utf8");
  const usadas = new Set([...texto.matchAll(/\bterminar ([a-z]+(?:-[a-z]+)*) \d/g)].map((x) => x[1]));
  assert.deepEqual([...usadas].sort(), [...permitido].sort());
  assert.equal(new Set(permitido).size, permitido.length, "clases repetidas en resultados.json");
});
