import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLaunch, anchorsExist, fileLinksExist, hasCommercialHeading, noTracking} from '../scripts/launch-audit.mjs';
const controls=auditLaunch();
test('el auditor declara exactamente A21-A30 sin duplicados',()=>{
  assert.deepEqual(controls.map(x=>x.id),Array.from({length:10},(_,i)=>'A'+(i+21)));
});
for (const control of controls) {
  test(control.id+': '+control.label,()=>{
    assert.equal(control.passed,true,control.label);
  });
}

// Regresiones sintéticas sin red, cuentas, datos personales ni escrituras.
test('A27 acepta anclas válidas con comillas simples y dobles',()=>{
  assert.equal(anchorsExist('<a href="#inicio">Ir</a><main id="inicio"></main>'),true);
  assert.equal(anchorsExist("<a href='#inicio'>Ir</a><main id='inicio'></main>"),true);
});
test('A27 rechaza destino ausente y no confunde data-id con id',()=>{
  assert.equal(anchorsExist('<a href="#ausente">Ir</a>'),false);
  assert.equal(anchorsExist('<a href="#inicio">Ir</a><main data-id="inicio"></main>'),false);
});
test('A26 acepta ruta pública conocida y rechaza ruta inexistente',()=>{
  assert.equal(fileLinksExist("<a href='/edwin-crm.html'>CRM</a>"),true);
  assert.equal(fileLinksExist("<a href='/archivo-inexistente-auditoria-20261115.html'>Falla</a>"),false);
});

test('A22 acepta title en head y h1 visible en body',()=>{
  assert.equal(hasCommercialHeading('<html><head><title>Edwin CRM | Gestión</title></head><body><h1 class="hero">CRM para empresas</h1></body></html>'),true);
});
test('A22 rechaza título fuera de head o h1 falso',()=>{
  assert.equal(hasCommercialHeading('<html><head></head><body><title>Edwin CRM</title><h1>CRM</h1></body></html>'),false);
  assert.equal(hasCommercialHeading('<html><head><title>Edwin CRM</title></head><body><div data-h1="x">CRM</div></body></html>'),false);
});
test('A22 ignora encabezados dentro de comentarios y fuera de body',()=>{
  assert.equal(hasCommercialHeading('<html><head><title>Edwin CRM</title></head><body><!-- <h1>falso</h1> --></body></html>'),false);
  assert.equal(hasCommercialHeading('<html><head><title>Edwin CRM</title><h1>falso</h1></head><body></body></html>'),false);
});

test('A29 permite scripts locales sin introducir rastreo externo',()=>{
  assert.equal(noTracking('<script src="/crm-demo-data.js"></script>'),true);
  assert.equal(noTracking("<script src='./local.js'></script>"),true);
});
test('A29 rechaza scripts remotos con comillas simples, dobles o URL relativa al protocolo',()=>{
  for(const src of ["'https://example.org/track.js'",'"https://example.org/track.js"',"'//example.org/track.js'",'"//example.org/track.js"','https://example.org/track.js']){
    assert.equal(noTracking('<script src='+src+'></script>'),false,src);
  }
});
test('A29 detecta src con espacios y preserva bloqueo de dominios de seguimiento',()=>{
  assert.equal(noTracking("<script defer src = '//cdn.example.org/pixel.js'></script>"),false);
  assert.equal(noTracking('<img src="https://www.googletagmanager.com/gtm.js">'),false);
});

test('A29 rechaza iframes remotos con variantes de comillas y protocolo',()=>{
  for(const src of ["'https://example.org/embed'",'"http://example.org/embed"'," '//example.org/embed'","https://example.org/embed"]){
    assert.equal(noTracking('<iframe title="Ejemplo" src='+src+'></iframe>'),false,src);
  }
});
test('A29 permite iframe local y no confunde data-src con src',()=>{
  assert.equal(noTracking('<iframe title="Local" src="/crm-demo.html"></iframe>'),true);
  assert.equal(noTracking('<iframe title="Local" src="./crm-demo.html"></iframe>'),true);
  assert.equal(noTracking('<div data-src="https://example.org/embed"></div>'),true);
});

// Regresión de privacidad: una imagen remota también inicia una solicitud externa.
test('A29 rechaza imágenes remotas incluso sin dominios de tracking conocidos',()=>{
  for (const src of ['"https://images.example.org/pixel.png"',"'//images.example.org/banner.webp'",'https://images.example.org/a.png']) {
    assert.equal(noTracking('<img alt="Ejemplo" src='+src+'>'),false,src);
  }
});
test('A29 permite imágenes locales y no confunde data-src con src',()=>{
  assert.equal(noTracking('<img src="/logo.svg" alt="Logo">'),true);
  assert.equal(noTracking("<img src='./asset.png' alt='Ejemplo'>"),true);
  assert.equal(noTracking('<img data-src="https://images.example.org/preview.png" alt="Vista previa">'),true);
});
