import { readFileSync } from 'node:fs';

const path = 'docs/PLAN-CRECIMIENTO-50-ENTREGAS.md';
const text = readFileSync(path, 'utf8');
const rows = [...text.matchAll(/^\| (C\d{2}) \|[^\n]*\| (Publicada|Integrada|Pendiente)[^\n]*\|\s*$/gm)];
const ids = rows.map((r) => r[1]);
const unique = new Set(ids);
if (rows.length !== 50 || unique.size !== 50 || !Array.from({length: 50}, (_, i) => 'C' + String(i + 1).padStart(2, '0')).every((id) => unique.has(id))) {
  throw new Error('El plan debe contener exactamente C01–C50, sin duplicados.');
}
const published = rows.filter((r) => r[2] !== 'Pendiente');
for (const row of published) {
  if (!/PR #\d+/.test(row[0])) throw new Error(row[1] + ': falta referencia al PR.');
}
const headline = text.match(/^\*\*Avance comprobado[^\n]*?\*\*[^\n]*?(\d+)\/50/m);
if (!headline) throw new Error('Falta el avance comprobado N/50.');
const stated = Number(headline[1]);
if (stated !== published.length) {
  throw new Error('El avance indica ' + stated + '/50, pero la tabla tiene ' + published.length + ' integradas.');
}
console.log('Plan consistente: ' + published.length + '/50 capacidades; 50 identificadores únicos.');
