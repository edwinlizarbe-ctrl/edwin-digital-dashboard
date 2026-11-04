/**
 * Read a small JSON request body without buffering an unbounded stream.
 * The byte limit applies even when Content-Length is omitted or forged.
 */
export async function readLimitedBody(req,maxBytes){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw new TypeError('Invalid body limit');
 const declared=req.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes)){
  const err=new Error('body limit');err.code='BODY_TOO_LARGE';throw err;
 }
 if(!req.body)return '';
 const reader=req.body.getReader(),decoder=new TextDecoder();
 let bytes=0,text='';
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.byteLength;
   if(bytes>maxBytes){
    await reader.cancel().catch(()=>{});
    const err=new Error('body limit');err.code='BODY_TOO_LARGE';throw err;
   }
   text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock();}
}
