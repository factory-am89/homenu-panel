// Panel de la factoría, versión 0: lee de GitHub los ficheros que dice config/<proyecto>.json
// y los enseña. Sin claves (repos públicos), sin dependencias, sin base de datos todavía.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { esc, filas, pagina, tabla } from "./lib.mjs";

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

const vistas = {
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
  try {
    let titulo, cuerpo, d;
    if (ruta === "/") {
      titulo = "Inicio";
      cuerpo = `<p>Lee <code>${esc(config.repo)}</code> (${esc(config.rama)}). Secciones: glosario y estándares de agentes. Issues, coste y tiempo vienen después.</p>`;
    } else if (vistas[ruta]) [titulo, cuerpo, d] = await vistas[ruta]();
    else { res.writeHead(404).end("No existe"); return; }
    if (d) cuerpo += `<p class="aviso">Fichero del ${esc(d.actualizado ?? "?")}; leído ${new Date(d.t).toISOString()}</p>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(pagina(titulo, config.nombre, cuerpo));
  } catch (e) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" }).end(`Error leyendo la fuente: ${e.message}`);
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  servidor.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? "127.0.0.1", () => console.log("panel escuchando"));
}
