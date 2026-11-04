import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const start=src.indexOf('function firstRunPanel(){'),end=src.indexOf('  function salesOverview(',start);
assert.ok(start>0&&end>start);
const isolated=src.slice(start,end);

function guide({businessReady=true,leads=[],leadLoading=false,leadError='',gaIncluded=true,gaConnection=null,gaLoading=false,gaReady=false}={}){
 return runInNewContext(isolated+'\nfirstRunPanel();',{
  gaReady:()=>gaReady,
  state:{gaLoading,ga4Connection:gaConnection,leadsLoading:leadLoading,leadsError:leadError,leads},
  featureEnabled:key=>key==='ga4'&&gaIncluded,
  business:()=>businessReady?{id:'tenant-a',name:'Empresa de prueba'}:null,
  clean:v=>String(v??'').replace(/[&<>"']/g,''),
  icon:()=>'<svg aria-hidden="true"></svg>'
 });
}

test('C31 calculates onboarding progress only from verified, actionable states',()=>{
 const empty=guide();
 assert.match(empty,/1 de 3 pasos verificados/);
 assert.match(empty,/33 % completado/);
 assert.match(empty,/<progress max="100" value="33"/);
 const oneLead=guide({leads:[{id:'real-record'}]});
 assert.match(oneLead,/2 de 3 pasos verificados/);
 assert.match(oneLead,/67 % completado/);
 const linked=guide({leads:[{id:'real-record'}],gaConnection:{connected:true,selected_property_id:'properties/123'}});
 assert.match(linked,/3 de 3 pasos verificados/);
 assert.match(linked,/100 % completado/);
 assert.match(linked,/Propiedad de Google Analytics 4 vinculada/);
});

test('C32 identifies absent leads but never treats pending or failed queries as zero',()=>{
 const noLeads=guide({leads:[]});
 assert.match(noLeads,/Crear mi primera oportunidad/);
 assert.match(noLeads,/1 de 3 pasos verificados/);
 const pending=guide({leads:[{id:'stale'}],leadLoading:true});
 assert.match(pending,/Consultando el estado de oportunidades/);
 assert.match(pending,/1 de 3 pasos verificados/);
 assert.doesNotMatch(pending,/2 de 3 pasos verificados/);
 const error=guide({leadError:'Permiso insuficiente',leads:[{id:'stale'}]});
 assert.match(error,/No pudimos verificar el estado de tus oportunidades/);
 assert.match(error,/1 de 3 pasos verificados/);
 assert.doesNotMatch(error,/Permiso insuficiente/);
});

test('C33 describes actual GA4 connection steps without claiming a configured OAuth client is linked',()=>{
 const notLinked=guide({gaConnection:{configured:true,connected:false}});
 assert.match(notLinked,/abre Integraciones, autoriza tu cuenta de Google y selecciona una propiedad/);
 assert.doesNotMatch(notLinked,/Propiedad de Google Analytics 4 vinculada/);
 const missingProperty=guide({gaConnection:{configured:true,connected:true,selected_property_id:''}});
 assert.doesNotMatch(missingProperty,/Propiedad de Google Analytics 4 vinculada/);
 const disabled=guide({gaIncluded:false});
 assert.match(disabled,/1 de 2 pasos verificados/);
 assert.match(disabled,/50 % completado/);
 assert.match(disabled,/No incluida/);
 assert.match(disabled,/Google Analytics no está habilitado/);
});

test('C34 promotes the next safe onboarding action using existing app navigation',()=>{
 const first=guide();
 assert.match(first,/class="button button-primary start-next-action" data-act="nav" data-page="leads">Crear mi primera oportunidad/);
 const next=guide({leads:[{id:'real-record'}]});
 assert.match(next,/start-next-action" data-act="nav" data-page="integrations">Conectar Google Analytics 4/);
 const done=guide({leads:[{id:'real-record'}],gaConnection:{connected:true,selected_property_id:'properties/123'}});
 assert.match(done,/start-next-action" data-act="nav" data-page="leads">Gestionar mis oportunidades/);
 const notCreated=guide({businessReady:false});
 assert.match(notCreated,/start-next-action" data-act="nav" data-page="company">Revisar mi empresa/);
});

test('onboarding links and progress styles are accessible and stay inside authorized business UI',()=>{
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/onboarding-progress.css',import.meta.url),'utf8');
 assert.match(index,/onboarding-progress\.css\?v=growth-c31-c34-20261104/);
 assert.match(index,/app\.js\?v=edwin-onboarding-c31-c34-20261104/);
 assert.match(guide(),/aria-label="Progreso de primeros pasos"/);
 assert.match(css,/forced-colors:active/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/max-width:600px/);
 assert.doesNotMatch(isolated,/\bfetch\s*\(|localStorage|sendBeacon/);
});
