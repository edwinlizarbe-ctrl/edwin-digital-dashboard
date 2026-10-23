import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const a=app.slice(app.indexOf('    function login(){'),app.indexOf('    function resetRequestPanel(){'));
test('login premium cambia la composición visual y conserva la marca Edwin CRM',()=>{
 assert.match(a,/login-page premium-auth/);
 assert.match(a,/premium-product-visual/);
 assert.match(a,/Vista conceptual/);
 assert.match(a,/Más oportunidades/);
 assert.match(a,/<span class="crm-text-logo">Edwin CRM<\/span>/);
 assert.match(a,/© Edwin CRM · Plataforma de negocios/);
 assert.doesNotMatch(a,/abstract-bars/);
});
test('login conserva autenticación, cambio de tema, registro, recuperación y accesibilidad',()=>{
 for (const marker of ['id="login-form"','id="email"','id="password"','data-act="show-password"','data-act="signup-open"','data-act="reset-open"','data-act="theme"','aria-describedby="login-error"','state.loginBusy','state.loginError']) assert.ok(a.includes(marker),marker);
 assert.match(a,/else if\(state\.authMode==='reset'\)/);
 assert.match(a,/if\(state\.authMode==='signup'\)/);
 assert.match(app,/function signupPanel\(\)/);
 assert.match(app,/function resetRequestPanel\(\)/);
});
test('CSS se limita a auth premium, tiene modo oscuro, móvil y foco visible',()=>{
 assert.match(css,/\.premium-auth \.login-side/);
 assert.match(css,/\.premium-auth \.login-panel/);
 assert.match(css,/\.premium-product-visual/);
 assert.match(css,/\[data-theme="dark"\] \.premium-auth/);
 assert.match(css,/@media\(max-width:860px\)/);
 assert.match(css,/\.premium-auth button:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('index invalida caché de CSS y app del acceso actualizado',()=>{
 assert.ok(html.includes('style.css?v=edwin-crm-auth-premium-20261023'));
 assert.ok(html.includes('app.js?v=edwin-crm-auth-premium-20261023'));
});
