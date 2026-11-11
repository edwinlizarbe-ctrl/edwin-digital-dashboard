import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/edwin-crm.html',import.meta.url),'utf8');
const count=(pattern)=>(html.match(pattern)||[]).length;
test('A11: explica ventaja de seguimiento en la propuesta principal',()=>{assert.match(html,/prospecto interesado/);assert.match(html,/no se quede en el olvido/);});
test('A12: navegación comercial enlaza secciones reales',()=>{assert.match(html,/<nav class="top-nav" aria-label="Navegación comercial">/);for(const id of ['como-funciona','para-quien','preguntas']){assert.match(html,new RegExp('href="#'+id+'"'));assert.match(html,new RegExp('id="'+id+'"'));}});
test('A13: muestra tres segmentos de clientes y casos de uso',()=>{for(const t of ['Agencias y consultores','Negocios con atención comercial','Emprendedores que hacen publicidad'])assert.ok(html.includes(t));});
test('A14: distingue características existentes de las pendientes',()=>{assert.match(html,/Qué puedes explorar hoy/);assert.match(html,/En el producto/);assert.match(html,/Aún no disponible para contratar aquí/);});
test('A15: evita prometer resultados comerciales',()=>{assert.match(html,/no promete ventas garantizadas/i);assert.match(html,/no equivale a su disponibilidad comprobada/);});
test('A16: sección de dudas ofrece cinco preguntas nativas accesibles',()=>{assert.equal(count(/<details>/g),6);assert.equal(count(/<summary>/g),6);assert.match(html,/<section class="content faq" id="preguntas">/);});
test('A17: aclara que no se cobra por la página',()=>{assert.match(html,/esta página no recibe pagos ni datos bancarios/);assert.match(html,/Pago recurrente y activación automática/);});
test('A18: aclara permisos e integración WhatsApp',()=>{assert.match(html,/¿Puedo conectar mi WhatsApp inmediatamente/);assert.match(html,/depende de configuraciones, permisos y pruebas/);});
test('A19: metadatos compartibles conservan noindex hasta validar lanzamiento',()=>{assert.match(html,/property="og:title"/);assert.match(html,/property="og:description"/);assert.match(html,/content="noindex, nofollow"/);});
test('A20: mejora accesibilidad móvil sin cookies ni scripts de rastreo',()=>{assert.match(html,/prefers-reduced-motion/);assert.match(html,/prefers-contrast:more/);assert.match(html,/<a class="skip" href="#contenido">/);assert.match(html,/@media\(max-width:700px\)/);assert.doesNotMatch(html,/<script|<form|google-analytics\.com|facebook\.com\/tr\?/i);});

test('commercial landing keeps CTA and FAQ visible in forced-colors mode',()=>{
  assert.match(html,/@media\(forced-colors:active\)/);
  assert.match(html,/\.cta,\.header-link,\.faq details\{border:1px solid ButtonText\}/);
  assert.match(html,/\.cta:focus-visible,\.faq summary:focus-visible\{outline:3px solid Highlight/);
  assert.match(html,/\.eyebrow\{border:1px solid CanvasText\}/);
});
test('forced-colors changes do not introduce external tracking, payment or personal-data capture',()=>{
  assert.doesNotMatch(html,/<script|<form|<iframe|checkout|stripe\.com|google-analytics\.com/i);
  assert.match(html,/content="noindex, nofollow"/);
});

test('recorrido comercial: al final ofrece demo y simulador sin capturar datos',()=>{
  const finalSection=html.match(/<section class="contrast" id="piloto">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(finalSection,'debe existir el cierre comercial');
  assert.match(finalSection,/href="\/crm-demo\.html">Ver demostración ficticia<\/a>/);
  assert.match(finalSection,/href="\/crm-followup-simulator\.html">Estimar seguimientos pendientes<\/a>/);
  assert.match(finalSection,/aria-label="Opciones para explorar Edwin CRM"/);
});
test('recorrido comercial: enlaces finales internos y sin altas, cobros o métricas inventadas',()=>{
  const finalSection=html.match(/<section class="contrast" id="piloto">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(finalSection);
  assert.doesNotMatch(finalSection,/<form|<script|<input|https?:\/\/|checkout|suscribirse|registrarse/i);
  assert.match(finalSection,/demostración no utiliza clientes reales/i);
  assert.match(html,/content="noindex, nofollow"/);
});

test('acceso privado: el enlace se identifica como exclusivo de cuentas habilitadas',()=>{
  assert.match(html, /href="\/" aria-label="Acceso privado al CRM para cuentas habilitadas">Entrar \(cuentas habilitadas\)<\/a>/);
  assert.match(html, /¿Puedo crear una cuenta desde esta página\?/);
  assert.match(html, /registro público y la activación de nuevas empresas siguen pendientes de verificación/);
});
test('acceso privado: no se ofrece registro, cobro ni captación pública',()=>{
  assert.doesNotMatch(html, /<form|<script|<iframe|href="\/signup|href="\/checkout|https?:\/\//i);
  assert.match(html, /content="noindex, nofollow"/);
});
test('acceso privado: demo pública sintética aislada de cuentas empresariales',()=>{
  assert.match(html, /href="\/crm-demo\.html"/);
  assert.match(html, /demostración utiliza datos ficticios/);
  assert.doesNotMatch(html, /fetch\(|localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY/);
});

test('navegación: el simulador es accesible desde la cabecera',()=>{
  const nav=html.match(/<nav class="top-nav" aria-label="Navegación comercial">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav,'debe existir navegación comercial');
  assert.match(nav, /href="\/crm-followup-simulator\.html">Simulador<\/a>/);
  assert.match(nav, /href="\/crm-demo\.html">Ver demo<\/a>/);
});
test('navegación: no introduce alta pública, pagos ni captación',()=>{
  const nav=html.match(/<nav class="top-nav" aria-label="Navegación comercial">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  assert.doesNotMatch(nav, /<form|<input|checkout|signup|https?:\/\//i);
  assert.match(html,/content="noindex, nofollow"/);
});
test('navegación: permanece aislada de datos empresariales y tracking',()=>{
  assert.doesNotMatch(html, /<script|fetch\(|localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY|google-analytics\.com/i);
  assert.match(html,/demostración utiliza datos ficticios/);
});
