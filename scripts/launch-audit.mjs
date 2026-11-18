import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {demoSnapshot, DEMO_BUSINESS_ID} from '../public/crm-demo-data.js';

const base=dirname(fileURLToPath(import.meta.url));
const publicDir=resolve(base,'../public');
const read=name=>readFileSync(resolve(publicDir,name),'utf8');
const has=(text,expression)=>expression.test(text);
const localLinks=html=>[...html.matchAll(/\bhref=([\x22\x27])(\/[^\x22\x27#?]*)(?:#[^\x22\x27]*)?\1/g)].map(m=>m[2]);
const anchors=html=>[...html.matchAll(/\bhref=(["'])(#[^"'<>]+)\1/g)].map(m=>m[2].slice(1));
export const anchorsExist=html=>{
  const ids=new Set([...html.matchAll(/\sid=(["'])([^"'<>]+)\1/g)].map(match=>match[2]));
  return anchors(html).every(anchor=>ids.has(anchor));
};
export const fileLinksExist=html=>localLinks(html).every(href=>href==='/'||(!href.includes('..')&&existsSync(resolve(publicDir,href.slice(1)))));
const noPersonalForms=html=>!/<(?:form|input|textarea)\b/i.test(html);
const noPayment=html=>!/(?:<form[^>]*(?:payment|card)|<input[^>]*(?:cvv|tarjeta|credit_card)|checkout\.stripe\.com)/i.test(html);
const remoteCss=html=>{
  const blocks=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map(m=>m[1]);
  const inline=[...html.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map(m=>m[1]??m[2]);
  return [...blocks,...inline].some(css=>/(?:@import\s+(?:url\(\s*)?|url\(\s*)["']?\s*(?:https?:)?\/\//i.test(css));
};
const remoteSrcset=html=>[...html.matchAll(/<(?:img|source)\b[^>]*\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
  .some(match=>/(?:https?:)?\/\//i.test(match[1]??match[2]??match[3]??''));
export const noTracking=html=>
  !/(?:<(?:script|iframe|img|video|audio|source)\b[^>]*\ssrc\s*=\s*(?:"\s*|\x27\s*|\s*)(?:https?:)?\/\/|connect\.facebook\.net|googletagmanager\.com|google-analytics\.com)/i.test(html) && !remoteSrcset(html)
  && !/<video\b[^>]*\sposter\s*=\s*(?:["']\s*|\s*)(?:https?:)?\/\//i.test(html)
  && !/<object\b[^>]*\sdata\s*=\s*(?:["']\s*|\s*)(?:https?:)?\/\//i.test(html)
  && !remoteCss(html)
  && !/<link\b(?=[^>]*\brel\s*=\s*(?:["'][^"']*\bstylesheet\b[^"']*["']|stylesheet\b))(?=[^>]*\shref\s*=\s*(?:["']\s*|\s*)(?:https?:)?\/\/)[^>]*>/i.test(html);

export const hasCommercialHeading=html=>{
  const visible=html.replace(/<!--[\s\S]*?-->/g,'');
  const head=visible.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i)?.[1] ?? '';
  const title=head.match(/<title\b[^>]*>\s*([^<]+)<\/title\s*>/i)?.[1] ?? '';
  const body=visible.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? '';
  return /Edwin CRM/i.test(title) && /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1\s*>/i.test(body);
};

export function auditLaunch() {
  const landing=read('edwin-crm.html'),demo=read('crm-demo.html'),index=read('index.html'),data=read('crm-demo-data.js');
  const checks=[
    ['A21','Landing permanece noindex antes del lanzamiento público',has(landing,/name="robots" content="noindex, nofollow"/)],
    ['A22','Propuesta comercial identifica el CRM y usa título visible',hasCommercialHeading(landing)],
    ['A23','La demostración declara datos ficticios sin atribución',has(demo,/100% FICTICIOS/) && has(demo,/no existe atribución publicitaria/i)],
    ['A24','No hay solicitudes de datos reales ni almacenamiento en la demo',!/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|XMLHttpRequest|document\.cookie/.test(demo)],
    ['A25','Accesos complementarios agrupados en menú nativo',has(index,/<details class="crm-quicklinks">/) && has(index,/<nav aria-label=/)],
    ['A26','Las rutas internas de la página comercial existen',fileLinksExist(landing)],
    ['A27','Los saltos a secciones tienen su destino',anchorsExist(landing)],
    ['A28','La presentación y la demo no recolectan PII',noPersonalForms(landing)&&noPersonalForms(demo)],
    ['A29','La presentación y la demo no incorporan pago o rastreo externo',noPayment(landing)&&noPayment(demo)&&noTracking(landing)&&noTracking(demo)],
    ['A30','Las métricas demo rechazan empresa distinta y fixture es sintético',has(data,/demo-fictional-only/)&&(()=>{
      try { demoSnapshot('business-real','inicio');return false; } catch { return demoSnapshot(DEMO_BUSINESS_ID,'inicio').fictional===true; }
    })()]
  ];
  return checks.map(([id,label,passed])=>Object.freeze({id,label,passed:Boolean(passed)}));
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const results=auditLaunch();
  for(const c of results) console.log((c.passed?'OK ':'ERROR ')+c.id+': '+c.label);
  if(results.some(x=>!x.passed)) process.exitCode=1;
  else console.log('10/10 controles estáticos del lanzamiento comercial aprobados. No acredita producción ni pagos.');
}
