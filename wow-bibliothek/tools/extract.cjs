// Liest DUNGEONS und MONSTERS aus index.html und schreibt sie als JSON (Eingabe für enrich.py).
const fs = require("fs"), path = require("path");
const h = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const a = h.indexOf("const DUNGEONS = "), b = h.indexOf("/* ===================== Hilfsfunktionen");
const m = { exports: {} };
new Function("module", h.slice(a, b) + "\nmodule.exports={DUNGEONS,MONSTERS};")(m);
fs.writeFileSync(process.argv[2], JSON.stringify(m.exports, null, 1));
console.log(m.exports.DUNGEONS.length, "Instanzen,", m.exports.MONSTERS.length, "Monster");
