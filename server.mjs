// Panel de la factoría, versión 0: lee de GitHub los ficheros que dice config/<proyecto>.json
// y los enseña. Sin claves (repos públicos), sin dependencias, sin base de datos todavía.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { entidadesDeRegistro } from "./lib.mjs";
import { biblioteca, bibliotecaDiseno } from "./markdown.mjs";
import { banner, caducidad, documentosDeFuente, contar, diaDe, esc, entidadesVista, filaIssue, filas, frontmatter, nota, pagina, pasosTexto, portada, porFondo, tabla, tablaMarkdown, tarjetas, validarInforme } from "./lib.mjs";

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
// Otras fuentes de solo lectura, cada una en su página (hoy, la Factoría). Repos públicos: sin clave. Sin fichero, sin página.
const URL_FABRICA = new URL("./config/fabrica.json", import.meta.url);
const fabrica = existsSync(URL_FABRICA) ? JSON.parse(readFileSync(URL_FABRICA, "utf8")) : null;
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

// Texto de un fichero del repo (raw no cuenta contra el límite de la API). Caché de 15 min, y con datos viejos si GitHub falla.
const textos = new Map();
async function texto(ruta, fuente = config) {
  if (process.env.MENUPLAN_LOCAL && fuente === config) return readFileSync(join(process.env.MENUPLAN_LOCAL, ruta), "utf8"); // desarrollo: lee de una copia en disco
  const clave = `${fuente.repo}@${fuente.rama}:${ruta}`, hit = textos.get(clave);
  if (hit && Date.now() - hit.t < CACHE_ISSUES_MS) return hit.txt;
  try {
    const r = await fetch(`https://raw.githubusercontent.com/${fuente.repo}/${fuente.rama}/${ruta}`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`${ruta}: GitHub contesta ${r.status}`);
    const txt = await r.text();
    textos.set(clave, { t: Date.now(), txt });
    return txt;
  } catch (e) {
    if (hit) return hit.txt;
    throw e;
  }
}

const listados = new Map();
async function listar(dir, fuente = config) {
  const clave = `${fuente.repo}@${fuente.rama}:${dir}`, hit = listados.get(clave);
  if (hit && Date.now() - hit.t < CACHE_ISSUES_MS) return hit.lista;
  try {
    const r = await fetch(`https://api.github.com/repos/${fuente.repo}/contents/${dir}?ref=${fuente.rama}`,
      { headers: { accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`${dir}: GitHub contesta ${r.status}`);
    const lista = await r.json();
    listados.set(clave, { t: Date.now(), lista });
    return lista;
  } catch (e) {
    if (hit) return hit.lista;
    throw e;
  }
}

const vistas = {
  "/agentes": async () => {
    const dir = config.directorios.agentes;
    const ficheros = (await listar(dir)).filter((f) => f.type === "file" && f.name.endsWith(".md"));
    const fichas = await Promise.all(ficheros.map(async (f) => {
      const txt = await texto(`${dir}/${f.name}`);
      const fm = frontmatter(txt);
      return { agente: fm.name ?? f.name, tipo: /^Tipo:\s*(.+)$/m.exec(txt)?.[1] ?? "", planos: /^Planos:\s*(.+)$/m.exec(txt)?.[1] ?? "", herramientas: fm.tools ?? "", modelo: fm.model ?? "", para_que: fm.description ?? "" };
    }));
    fichas.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.agente.localeCompare(b.agente));
    return ["Agentes", tabla(fichas, ["agente", "tipo", "planos", "herramientas", "modelo", "para_que"]), { t: Date.now() }];
  },
  "/skills": async () => {
    const dir = config.directorios.skills;
    const carpetas = (await listar(dir)).filter((f) => f.type === "dir");
    const fichas = await Promise.all(carpetas.map(async (c) => {
      const fm = frontmatter(await texto(`${dir}/${c.name}/SKILL.md`));
      const cad = caducidad(fm.comprobado);
      return { skill: fm.name ?? c.name, tipo: fm.tipo ?? "", dueno: fm.dueno ?? "", comprobado: fm.comprobado ?? "", caduca: cad.caduca, dias_para_caducar: cad.dias, para_que: fm.description ?? "" };
    }));
    fichas.sort((a, b) => Number(a.dias_para_caducar) - Number(b.dias_para_caducar));
    return ["Skills (las que antes caducan, primero)", tabla(fichas, ["skill", "tipo", "dueno", "comprobado", "caduca", "dias_para_caducar", "para_que"]), { t: Date.now() }];
  },
  "/encargos": async () => {
    // Desde MenuPlan#557 los tipos son un fichero de datos; si aún no está en la rama, se cae a la tabla de orquestar.md.
    let tipos = null;
    try { tipos = JSON.parse(await texto(config.tiposDeEncargo.fichero)).tipos; } catch { /* sin fichero de datos: se usa la tabla */ }
    if (tipos) {
      let tareas = new Map();
      try { tareas = new Map(filas((await leer("estandares")).json[config.fuentes.estandares.lista]).map((a) => [a.id, (a.tareas ?? []).length])); } catch { /* sin estándares: sin cifras */ }
      const filasTipos = tipos.map((t) => {
        const agentes = [...new Set(t.pasos.flatMap((p) => [...(p.agentes ?? []), ...(p.opcional ?? []).map((o) => o.agente)]))];
        return { tipo: t.accion, pipeline: pasosTexto(t), estandares: agentes.filter((x) => tareas.has(x)).map((x) => `${x}: ${tareas.get(x)}`).join(", ") };
      });
      const aviso = nota(`Sale de <code>${esc(config.tiposDeEncargo.fichero)}</code>. En «estándares», cuántas tareas con estándar tiene cada agente del pipeline. Para fallos, /orquestar usa antes el presupuesto por alcance y causa (<code>ops/presupuestos.json</code>).`);
      return ["Tipos de encargo y su pipeline", `${aviso}${tabla(filasTipos, ["tipo", "pipeline", "estandares"])}`, { t: Date.now() }];
    }
    const o = config.orquestar;
    const filasPipe = tablaMarkdown(await texto(o.fichero), o.encabezado);
    const aviso = nota(`Sale de la tabla «${esc(o.encabezado)}» de <code>${esc(o.fichero)}</code> (aún no hay fichero de datos). Para fallos, /orquestar usa antes el presupuesto por alcance y causa (<code>ops/presupuestos.json</code>).`);
    return ["Tipos de encargo y su pipeline", `${aviso}${tabla(filasPipe, Object.keys(filasPipe[0] ?? { Acción: 1, Pipeline: 1 }))}`, { t: Date.now() }];
  },
  "/fondos": async () => {
    const d = await leerIssues();
    const lista = leerInformes();
    const medidos = lista[0]?.informe.encargos ?? [];
    const num = (n) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
    const base = porFondo(d.lista, medidos);
    const resumen = tarjetas([
      { etiqueta: "Fondos", valor: base.length, detalle: `${base.filter((x) => x.estado === "abierto").length} abiertos` },
      { etiqueta: "Encargos abiertos", valor: base.reduce((t, x) => t + x.encargos_abiertos, 0), detalle: `de ${base.reduce((t, x) => t + x.encargos, 0)}` },
      { etiqueta: "Casos", valor: base.reduce((t, x) => t + x.casos, 0) },
      { etiqueta: "Horas medidas", valor: num(base.reduce((t, x) => t + x.horas, 0)) },
      { etiqueta: "Coste USD estimado", valor: num(base.reduce((t, x) => t + x.coste_usd, 0)) },
    ]);
    const f = base.map((x) => ({
      fondo: `#${x.n}`, titulo: x.titulo, estado: x.estado, causa: x.causa, encargos: `${x.encargos - x.encargos_abiertos}/${x.encargos} cerrados`,
      casos: x.casos, medidos: x.medidos, horas: x.medidos ? num(x.horas) : "", coste_usd_estimado: x.medidos ? num(x.coste_usd) : "",
    }));
    const aviso = d.error ? banner("aviso", `Datos viejos: ${esc(d.error)}`) : "";
    const explica = nota(`Cada fondo con los encargos y casos que cuelgan de él (bloque <code>fondo:</code>). Horas y coste solo de los encargos medidos en el último informe de fabrica; mayor coste primero.`);
    return ["Fondos y sus encargos", `${aviso}${resumen}${explica}${tabla(f, ["fondo", "titulo", "estado", "causa", "encargos", "casos", "medidos", "horas", "coste_usd_estimado"])}`, d];
  },
  "/coste": async () => {
    const lista = leerInformes();
    if (!lista.length) return ["Coste y tiempo", banner("informacion", "Aún no ha llegado ningún informe. Se envía desde el PC con <code>cliente/enviar-fabrica.mjs</code>."), null];
    const u = lista[0].informe, s = u.sinIssue;
    const num = (n) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
    const dia = tabla(lista.map((x) => ({ dia: x.dia, sesiones: x.informe.cobertura.sesiones, horas: num(x.informe.sinIssue.minutos / 60),
      tokens_millones: num(x.informe.sinIssue.tokens.total / 1e6), coste_usd_estimado: num(x.informe.sinIssue.coste_usd) })),
    ["dia", "sesiones", "horas", "tokens_millones", "coste_usd_estimado"]);
    const bloqueos = Object.entries(u.eventos.por_evento.bloqueo_guardia?.nombres ?? {}).sort((a, b) => b[1] - a[1]).map(([motivo, veces]) => ({ motivo, veces }));
    const agentes = Object.entries(s.agentes ?? {}).sort((a, b) => b[1] - a[1]).map(([agente, lanzamientos]) => ({ agente, lanzamientos }));
    const titulos = new Map();
    try { for (const x of (await leerIssues()).lista) titulos.set(x.n, x.titulo); } catch { /* sin títulos, solo números */ }
    const encargos = (u.encargos ?? []).slice().sort((a, b) => b.coste_usd - a.coste_usd).map((e) => ({
      issue: `#${e.issue}`, titulo: titulos.get(e.issue) ?? "", fondo: e.fondo ? `#${e.fondo}` : "", horas: num(e.minutos / 60),
      tokens_millones: num(e.tokens.total / 1e6), coste_usd_estimado: num(e.coste_usd), sesiones: e.sesiones, rondas: e.rondas ?? "", aguanto: e.aguanto ?? "",
    }));
    const procedencia = u.datos_github === "fresco" ? "datos de GitHub al día"
      : u.datos_github === "sin-github" ? "enviado sin unir con los issues" : "";
    const deCache = u.datos_github?.startsWith("cache");
    const aviso = nota(`El coste es una estimación a precios de la API (ops/precios-modelos.json), no lo que se paga. Encargos medidos: ${u.cobertura.encargos_medidos ?? 0}${procedencia && !deCache ? ` · ${procedencia}` : ""}.`) + (deCache ? banner("aviso", `Los datos de GitHub vienen de una caché (${esc(u.datos_github)}).`) : "");
    const resumen = tarjetas([
      { etiqueta: "Sesiones", valor: u.cobertura.sesiones }, { etiqueta: "Horas", valor: num(s.minutos / 60) },
      { etiqueta: "Tokens (millones)", valor: num(s.tokens.total / 1e6) }, { etiqueta: "Coste USD estimado", valor: num(s.coste_usd) },
      { etiqueta: "Encargos medidos", valor: u.cobertura.encargos_medidos ?? 0 },
    ]);
    const porEncargo = encargos.length
      ? `<h2>Por encargo (mayor coste primero)</h2>${tabla(encargos, ["issue", "titulo", "fondo", "horas", "tokens_millones", "coste_usd_estimado", "sesiones", "rondas", "aguanto"])}`
      : `<h2>Por encargo</h2><p>Este informe no trae encargos medidos.</p>`;
    return ["Coste y tiempo", `${aviso}${resumen}${porEncargo}<h2>Total por día (acumulado hasta ese día)</h2>${dia}<h2>Bloqueos de la guardia (último informe)</h2>${tabla(bloqueos, ["motivo", "veces"])}<h2>Agentes lanzados</h2>${tabla(agentes, ["agente", "lanzamientos"])}`, { t: Date.parse(lista[0].recibido), actualizado: lista[0].dia }];
  },
  "/issues": async () => {
    const d = await leerIssues();
    const cuenta = contar(d.lista, "tipo", "estado");
    const resumen = tabla(Object.entries(cuenta).map(([tipo, c]) => ({ tipo, abiertos: c.abierto ?? 0, cerrados: c.cerrado ?? 0 })), ["tipo", "abiertos", "cerrados"]);
    const abiertos = d.lista.filter((x) => x.estado === "abierto").sort((a, b) => b.n - a.n);
    const aviso = d.error ? banner("aviso", `Datos viejos: ${esc(d.error)}`) : "";
    const abiertosDe = (t) => cuenta[t]?.abierto ?? 0;
    const cifras = tarjetas([
      { etiqueta: "Fondos abiertos", valor: abiertosDe("fondo") }, { etiqueta: "Encargos abiertos", valor: abiertosDe("encargo") },
      { etiqueta: "Casos abiertos", valor: abiertosDe("caso") }, { etiqueta: "Decisiones abiertas", valor: abiertosDe("decision") },
      { etiqueta: "Cerrados", valor: d.lista.length - abiertos.length, detalle: `de ${d.lista.length}` },
    ]);
    return ["Issues", `${aviso}${cifras}<h2>Resumen</h2>${resumen}<h2>Abiertos (${abiertos.length})</h2>${tabla(abiertos, ["n", "tipo", "area", "causa", "fondo", "asignado", "titulo"])}`, d];
  },
  "/glosario": async () => {
    // Desde MenuPlan#469 cada término es un fichero de ops/glosario/terminos/.
    const dir = config.fuentes.glosario.directorio;
    const ficheros = (await listar(dir)).filter((f) => f.type === "file" && f.name.endsWith(".json"));
    const terminos = (await Promise.all(ficheros.map(async (f) => { try { return JSON.parse(await texto(`${dir}/${f.name}`)); } catch { return null; } }))).filter(Boolean);
    terminos.sort((a, b) => String(a.termino).localeCompare(String(b.termino), "es"));
    return ["Glosario", tabla(terminos, ["termino", "estado", "clase", "definicion", "sinonimos_prohibidos"]), { t: Date.now() }];
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
        console.error("ingest/fabrica: informe rechazado:", e);
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ ok: false, error: "JSON no válido" }));
      }
    });
    return;
  }
  try {
    let titulo, cuerpo, d;
    if (ruta === "/") {
      titulo = "Inicio";
      cuerpo = portada(config.repo, config.rama);
    } else if (/^[/]entidades([/][a-z0-9-]+)?$/.test(ruta)) {
      let datos;
      try { datos = entidadesDeRegistro(JSON.parse(await texto(config.fuentes.entidades.fichero))); }
      catch { datos = null; }
      if (!datos) { titulo = "Entidades"; cuerpo = banner("informacion", `Aún no hay <code>${esc(config.fuentes.entidades.fichero)}</code> en la rama ${esc(config.rama)}. Aparecerá cuando se fusione el mapa de entidades (MenuPlan#566).`); }
      else {
        const v = entidadesVista(datos, ruta.split("/")[2]);
        if (!v.existe) { res.writeHead(404).end("No existe esa entidad"); return; }
        [titulo, cuerpo] = [v.titulo, v.html];
        d = { t: Date.now() };
      }
    } else if (/^[/]diseno([/][a-z0-9-]+)?$/.test(ruta)) {
      const id = ruta.split("/")[2], doc = config.diseno.find((x) => x.id === id);
      const v = bibliotecaDiseno(config.diseno, id, doc ? await texto(doc.fichero) : "");
      if (!v.existe) { res.writeHead(404).end("No existe ese documento"); return; }
      [titulo, cuerpo] = [v.titulo, v.html];
      d = { t: Date.now() };
    } else if (/^[/]fabrica([/][a-z0-9-]+)?$/.test(ruta)) {
      if (!fabrica) { titulo = "Factoría"; cuerpo = banner("informacion", "Este panel no tiene <code>config/fabrica.json</code>."); }
      else {
        // cada carpeta se lista aparte: si GitHub falla en una, el resto se enseña igual
        const listados = {}, fallos = [];
        for (const c of fabrica.directorios ?? []) {
          try { listados[c.directorio] = await listar(c.directorio, fabrica); } catch (e) { fallos.push(e.message); }
        }
        const docs = documentosDeFuente(fabrica, listados), id = ruta.split("/")[2], doc = docs.find((x) => x.id === id);
        const v = biblioteca({ base: "/fabrica", docs, actual: id, md: doc ? await texto(doc.fichero, fabrica) : "", titulo: fabrica.nombre,
          fuente: `rama ${fabrica.rama} de ${fabrica.repo}`, etiqueta: `Ficheros de ${fabrica.nombre}`,
          intro: `Los ficheros de ${fabrica.repo} (rama ${fabrica.rama}), tal cual están en GitHub. Solo lectura.` });
        if (!v.existe) { res.writeHead(404).end("No existe ese fichero"); return; }
        [titulo, cuerpo] = [v.titulo, (fallos.length ? banner("aviso", `No se pudo listar una carpeta: ${esc(fallos.join("; "))}`) : "") + v.html];
        d = { t: Date.now() };
      }
    } else if (vistas[ruta]) [titulo, cuerpo, d] = await vistas[ruta]();
    else { res.writeHead(404).end("No existe"); return; }
    if (d) cuerpo += nota(`${d.actualizado ? `Fichero del ${esc(d.actualizado)}; ` : ""}leído ${new Date(d.t).toISOString()}`);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(pagina(titulo, config.nombre, cuerpo, ruta));
  } catch (e) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" }).end(`Error leyendo la fuente: ${e.message}`);
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  servidor.listen(Number(process.env.PORT ?? 8080), process.env.HOST ?? "127.0.0.1", () => console.log("panel escuchando"));
}
