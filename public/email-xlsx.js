/**
 * XLSX first-worksheet reader (no remote scripts).
 * Uses ZIP central directory, native DecompressionStream(deflate-raw) and DOMParser.
 * Intentionally limits size/rows; never evaluates formulas/macros.
 */
(()=>{
'use strict';
function zipEntries(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
  if(dv.getUint32(p,true)===0x06054b50){end=p;break;}
 }
 if(end<0)throw Error('No se encontró un archivo XLSX válido.');
 const count=dv.getUint16(end+10,true),offset=dv.getUint32(end+16,true);
 if(count>200)throw Error('El Excel contiene demasiados archivos internos.');
 const result=new Map();let pos=offset;
 for(let i=0;i<count;i++){
  if(pos+46>bytes.length||dv.getUint32(pos,true)!==0x02014b50)throw Error('Directorio ZIP inválido.');
  const method=dv.getUint16(pos+10,true),compressed=dv.getUint32(pos+20,true),uncompressed=dv.getUint32(pos+24,true);
  const n=dv.getUint16(pos+28,true),ex=dv.getUint16(pos+30,true),comment=dv.getUint16(pos+32,true),local=dv.getUint32(pos+42,true);
  const path=new TextDecoder().decode(bytes.slice(pos+46,pos+46+n));
  if(uncompressed>8000000)throw Error('El Excel contiene una hoja demasiado grande.');
  result.set(path,{method,compressed,uncompressed,local});
  pos+=46+n+ex+comment;
 }
 return {dv,result,bytes};
}
async function unpack(zip,path){
 const rec=zip.result.get(path);if(!rec)return '';
 if(rec.local+30>zip.bytes.length||zip.dv.getUint32(rec.local,true)!==0x04034b50)throw Error('Archivo ZIP interno inválido.');
 const start=rec.local+30+zip.dv.getUint16(rec.local+26,true)+zip.dv.getUint16(rec.local+28,true);
 if(start+rec.compressed>zip.bytes.length)throw Error('Excel comprimido incompleto.');
 const chunk=zip.bytes.slice(start,start+rec.compressed);
 let data;
 if(rec.method===0)data=chunk;
 else if(rec.method===8&&typeof DecompressionStream!=='undefined'){
  const stream=new Blob([chunk]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  data=new Uint8Array(await new Response(stream).arrayBuffer());
 }else throw Error('Tu navegador no admite este formato Excel. Puedes exportarlo como CSV UTF-8.');
 if(data.length!==rec.uncompressed||data.length>8000000)throw Error('Tamaño de Excel inesperado.');
 return new TextDecoder('utf-8',{fatal:true}).decode(data);
}
function parseXML(s){
 const x=new DOMParser().parseFromString(s,'application/xml');
 if(x.getElementsByTagName('parsererror').length)throw Error('El Excel tiene XML inválido.');
 return x;
}
function nodes(el,tag){return [...el.getElementsByTagName(tag)];}
function colNumber(ref){
 const letters=ref.match(/^[A-Z]+/)?.[0]||'';
 return [...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
}
function contentsOf(si){return nodes(si,'t').map(t=>t.textContent||'').join('');}
async function readXlsx(file){
 if(file.size>3000000)throw Error('El Excel supera 3 MB.');
 const zip=zipEntries(new Uint8Array(await file.arrayBuffer()));
 if(!zip.result.has('xl/workbook.xml'))throw Error('El documento no es un archivo XLSX compatible.');
 const strings=await unpack(zip,'xl/sharedStrings.xml');
 const shared=strings?nodes(parseXML(strings),'si').map(contentsOf):[];
 const sheets=[...zip.result.keys()].filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 if(!sheets.length)throw Error('El Excel no tiene hojas de datos.');
 const document=parseXML(await unpack(zip,sheets[0])),result=[];
 for(const row of nodes(document,'row')){
  const values=[];for(const cell of nodes(row,'c')){
   const index=colNumber(cell.getAttribute('r')||'');
   if(index<0||index>40)continue;
   const type=cell.getAttribute('t')||'';
   let val='';
   if(type==='inlineStr')val=nodes(cell,'t').map(n=>n.textContent||'').join('');
   else{
    const v=nodes(cell,'v')[0]?.textContent||'';
    val=type==='s'?(shared[Number(v)]||''):v;
   }
   values[index]=val;
  }
  result.push(values.map(x=>x||''));
  if(result.length>3001)throw Error('El Excel tiene más de 3000 filas. Divide el archivo en partes.');
 }
 return result;
}
window.brasperReadXlsx=readXlsx;
})();
