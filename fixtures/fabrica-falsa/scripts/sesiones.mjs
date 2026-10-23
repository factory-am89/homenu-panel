// Doble de `scripts/sesiones.mjs --json` de la Fábrica, solo para cockpit.test.js: misma forma de salida.
// Con FABRICA_FALSA_FALLA=1 sale 1 como la real cuando hay fichas ilegibles.
if (process.env.FABRICA_FALSA_FALLA) { console.error("sesiones: fichas ilegibles: x.json"); process.exit(1); }
// La hora entra por FABRICA_FALSA_AHORA (ms); el test la fija, nunca se lee el reloj.
const ahora = Number(process.env.FABRICA_FALSA_AHORA);
if (!Number.isFinite(ahora)) { console.error("sesiones falsa: falta FABRICA_FALSA_AHORA"); process.exit(1); }
const hace = (min) => new Date(ahora - min * 60_000).toISOString();
const sesion = (id, rama, min) => ({ id, carpeta: `C:\\dev\\${rama}`, rama, inicio: hace(min + 60), ultima: hace(min), horas: min / 60, activa: true });
console.log(JSON.stringify({
  registro: "C:\\Users\\x\\.fabrica\\sesiones", activas: 2, inactivas: 0,
  sesiones: [sesion("sesion-viva-1", "feat/viva", 1), sesion("sesion-callada-2", "fix/callada", 40)],
  corruptas: [],
}));
