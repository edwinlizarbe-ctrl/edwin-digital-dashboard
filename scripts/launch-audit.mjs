import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {demoSnapshot, DEMO_BUSINESS_ID} from '../public/crm-demo-data.js';

const base=dirname(fileURLToPath(import.meta.url));
const publicDir=resolve(base,'../public');
const read=name=>readFileSync(resolve(publicDir,name),'utf8');
const has=(text,expression)=>expression.test(text);
const localLinks=html=>[...html.matchAll(/href="(\/[^"#?]*)(?:#[^"]*)?"/g)].map(m=>m[1]);
const anchors=html=>[...html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
const anchorsExist=html=>anchors(html).every(anchor=>html.includes('id="'+anchor+'"'));
const fileLinksExist=html=>localLinks(html).every(href=>href==='/'||(!href.includes('..')&&existsSync(resolve(publicDir,href.slice(1)))));
const noPersonalForms=html=>!/<(?:form|input|textarea)\b/i.test(html);
const noPayment=html=>!/(?:<form[^>]*(?:payment|card)|<input[^>]*(?:cvv|tarjeta|credit_card)|checkout\.stripe\.com)/i.test(html);
const noTracking=html=>!/(?:<script[^>]*src="https?:\/\/|connect\.facebook\.net|googletagmanager\.com|google-analytics\.com)/i.test(html);

export function auditLaunch() {
  const landing=read('edwin-crm.html'),demo=read('crm-demo.html'),index=read('index.html'),data=read('crm-demo-data.js');
  const checks=[
    ['A21','Landing permanece noindex antes del lanzamiento público',has(landing,/name="robots" content="noindex, nofollow"/)],
    ['A22','Propuesta comercial identifica el CRM y usa título visible',has(landing,/<title>Edwin CRM/) && has(landing,/<h1>/)],
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
