/* G10: local-only commercial response drafts. Never sends or stores contact data. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.edwinResponseLibrary=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const templates=Object.freeze({
    es:Object.freeze([
      Object.freeze({id:'first',title:'Primer contacto',body:'Hola, gracias por tu interés. ¿En qué podemos ayudarte?'}),
      Object.freeze({id:'followup',title:'Seguimiento',body:'Hola, queríamos saber si necesitas más información. Quedamos atentos a tus consultas.'}),
      Object.freeze({id:'close',title:'Cierre cordial',body:'Gracias por conversar con nosotros. Si necesitas algo más, estamos disponibles.'})
    ]),
    pt:Object.freeze([
      Object.freeze({id:'first',title:'Primeiro contato',body:'Olá, agradecemos seu interesse. Como podemos ajudar?'}),
      Object.freeze({id:'followup',title:'Acompanhamento',body:'Olá, gostaríamos de saber se precisa de mais informações. Estamos à disposição.'}),
      Object.freeze({id:'close',title:'Encerramento',body:'Agradecemos a conversa. Se precisar de algo mais, estamos à disposição.'})
    ])
  });
  function list(locale){return (templates[locale]||[]).map(t=>({...t}));}
  function draft(locale,id,edits){
    const item=(templates[locale]||[]).find(t=>t.id===id);
    if(!item)return null;
    if(edits===undefined)return item.body;
    if(typeof edits!=='string'||edits.length>4000)return null;
    return edits;
  }
  return Object.freeze({list,draft});
});
