// Panel de la factoría, versión 0: lee de GitHub los ficheros que dice config/<proyecto>.json
// y los enseña. Sin claves (repos públicos), sin dependencias, sin base de datos todavía.
import { createServer } from "node:http";
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contar, diaDe, esc, filaIssue, filas, pagina, tabla, validarInforme } from "./lib.mjs";

// Informes que envía el PC de Pablo (npm run fabrica -- --json): uno por día, el último del día gana.
const DATOS = process.env.DATOS ?? resolve(fileURLToPath(import.meta.url), "..", "datos");
const CARPETA_FABRICA = join(DATOS, "fabrica");
const MAX_BYTES = 200_000;

export function guardarInforme(informe, dia = diaDe()) {
  mkdirSync(CARPETA_FABRICA, { recursive: true });
  const destino = join(CARPETA_FABRICA, `${dia}.json`);
  writeFileSync(`${destino}.tmp`, JSON.stringify({ recibido: new Date().toISOString(), informe }));
  renameSync(`${destino}.tmp`, destino); // escritura atómica: nunca queda un fichero a medias
  return dia;
}

function leerInformes() {
  try {
    return readdirSync(CARPETA_FABRICA).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse()
      .map((f) => ({ dia: f.slice(0, 10), ...JSON.parse(readFileSync(join(CARPETA_FABRICA, f), "utf8")) }));
  } catch { return []; } // sin carpeta todavía: aún no ha llegado ninguno
}

const config = JSON.parse(readFileSync(new URL(`./config/${process.env.PROYECTO ?? "menuplan"}.json`, import.meta.url), "utf8"));
const CACHE_MS = 5 * 60_000;
const cache = new Map();

async function leer(clave) {
  const f = config.fuentes[clave];
  const hit = cache.get(clave);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit;
  const url = `https://raw.githubusercontent.com/${config.repo}/${config.rama}/${f.fichero}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`${f.fichero}: GitHub contesta ${r.status}`);
  const json = await r.json();
  const nuevo = { t: Date.now(), json, actualizado: json.actualizado ?? null };
  cache.set(clave, nuevo);
  return nuevo;
}

const TIPOS = ["fondo", "caso", "encargo", "decision"];
const CACHE_ISSUES_MS = 15 * 60_000; // la API sin clave da 60 peticiones/hora por IP
let issues = null;

async function leerIssues() {
  if (issues && Date.now() - issues.t < CACHE_ISSUES_MS) return issues;
  try {
    const lista = [];
    for (const tipo of TIPOS) {
      for (let p = 1; p <= 5; p++) {
        const r = await fetch(`https://api.github.com/repos/${config.repo}/issues?labels=tipo:${tipo}&state=all&per_page=100&page=${p}`,
          { headers: { accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10_000) });
        if (!r.ok) throw new Error(`issues: GitHub contesta ${r.status}`);
        const pagina = await r.json();
        lista.push(...pagina.filter((i) => !i.pull_request).map((i) => filaIssue(i, config.repo)));
        if (pagina.length < 100) break;
      }
    }
    issues = { t: Date.now(), lista, actualizado: null };
  } catch (e) {
    if (!issues) throw e; // con datos viejos, se enseñan esos
    issues = { ...issues, error: e.message };
  }
  return issues;
}

const vistas = {
  "/coste": async () => {
    const lista = leerInformes();
    if (!lista.length) return ["Coste y tiempo", `<p>Aún no ha llegado ningún informe. Se envía desde el PC con <code>cliente/enviar-fabrica.mjs</code>.</p>`, null];
    const u = lista[0].informe, s = u.sinIssue;
    const num = (n) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
    const dia = tabla(lista.map((x) => ({ dia: x.dia, sesiones: x.informe.cobertura.sesiones, horas: num(x.informe.sinIssue.minutos / 60),
      tokens_millones: num(x.informe.sinIssue.tokens.total / 1e6), coste_usd_estimado: num(x.informe.sinIssue.coste_usd) })),
    ["dia", "sesiones", "horas", "tokens_millones", "coste_usd_estimado"]);
    const bloqueos = Object.entries(u.eventos.por_evento.bloqueo_guardia?.nombres ?? {}).sort((a, b) => b[1] - a[1]).map(([motivo, veces]) => ({ motivo, veces }));
    const agentes = Object.entries(s.agentes ?? {}).sort((a, b) => b[1] - a[1]).map(([agente, lanzamientos]) => ({ agente, lanzamientos }));
    const aviso = `<p class="aviso">El coste es una estimación a precios de la API (ops/precios-modelos.json), no lo que se paga. Sesiones sin encargo asignado: aún no se reparte por encargo (necesita leer los issues desde el PC, MenuPlan#424).</p>`;
    return ["Coste y tiempo", `${aviso}<h2>Por día (acumulado hasta ese día)</h2>${dia}<h2>Bloqueos de la guardia (último informe)</h2>${tabla(bloqueos, ["motivo", "veces"])}<h2>Agentes lanzados</h2>${tabla(agentes, ["agente", "lanzamientos"])}`, { t: Date.parse(lista[0].recibido), actualizado: lista[0].dia }];
  },
  "/issues": async () => {
    const d = await leerIssues();
    const cuenta = contar(d.lista, "tipo", "estado");
    const resumen = tabla(Object.entries(cuenta).map(([tipo, c]) => ({ tipo, abiertos: c.abierto ?? 0, cerrados: c.cerrado ?? 0 })), ["tipo", "abiertos", "cerrados"]);
    const abiertos = d.lista.filter((x) => x.estado === "abierto").sort((a, b) => b.n - a.n);
    const aviso = d.error ? `<p class="aviso">Datos viejos: ${esc(d.error)}</p>` : "";
    return ["Issues", `${aviso}<h2>Resumen</h2>${resumen}<h2>Abiertos (${abiertos.length})</h2>${tabla(abiertos, ["n", "tipo", "area", "causa", "fondo", "asignado", "titulo"])}`, d];
  },
  "/glosario": async () => {
    const d = await leer("glosario");
    return ["Glosario", tabla(filas(d.json[config.fuentes.glosario.lista]), ["termino", "estado", "clase", "definicion", "sinonimos_prohibidos"]), d];
  },
  "/estandares": async () => {
    const d = await leer("estandares");
    const l = filas(d.json[config.fuentes.estandares.lista]).flatMap((a) =>
      (a.tareas ?? []).map((t) => ({ agente: a.id, tarea: t.id, que_es: t.tarea, origen: t.origen })));
    return ["Estándares por agente", tabla(l, ["agente", "tarea", "que_es", "origen"]), d];
  },
};

export const servidor = createServer(async (req, res) => {
  const ruta = new URL(req.url, "http://x").pathname;
  if (req.method === "POST" && ruta === "/ingest/fabrica") {
    // Solo llega por la red privada (el puerto va atado a la IP de Tailscale). Aun así se valida la forma y el tamaño.
    let cuerpo = "", demasiado = false;
    req.on("data", (c) => { cuerpo += c; if (cuerpo.length > MAX_BYTES) { demasiado = true; req.destroy(); } });
    req.on("end", () => {
      if (demasiado) return;
      try {
        const informe = JSON.parse(cuerpo);
        const v = validarInforme(informe);
        if (!v.ok) { res.writeHead(422, { "content-type": "application/json" }).end(JSON.stringify(v)); return; }
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, dia: guardarInforme(informe) }));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "JSON no válido" }));
      }
    });
    return;
  }
  try {
    let titulo, cuerpo, d;
    if (ruta === "/") {
      titulo = "Inicio";
      cuerpo = `<p>Lee <code>${esc(config.repo)}</code> (${esc(config.rama)}). Secciones: glosario, estándares de agentes e issues. Coste y tiempo vienen después.</p>`;
    } else if (vistas[ruta]) [titulo, cuerpo, d] = await vistas[ruta]();
    else { res.writeHead(404).end("No existe"); return; }
    if (d) cuerpo += `<p class="aviso">${d.actualizado ? `Fichero del ${esc(d.actualizado)}; ` : ""}leído ${new Date(d.t).toISOString()}</p>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(pagina(titulo, config.nombre, cuerpo));
  } catch (e) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" }).end(`Error leyendo la fuente: ${e.message}`);
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  servidor.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? "127.0.0.1", () => console.log("panel escuchando"));
}
