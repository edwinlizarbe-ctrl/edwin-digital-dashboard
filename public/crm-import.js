/* Edwin CRM — importación de contactos desde CSV/TSV sin integraciones ni credenciales externas. */
(function (root) {
  'use strict';
  const MAX_ROWS = 500;
  const MAX_CHARS = 2_000_000;
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function readRows(text, sep) {
    const rows = []; let row = [], value = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { value += '"'; i++; }
        else if (quoted || !value.trim()) quoted = !quoted;
        else value += c;
      } else if (c === sep && !quoted) {
        row.push(value.trim()); value = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        row.push(value.trim()); value = '';
        if (row.some(x => x !== '')) rows.push(row);
        row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      } else { value += c; }
    }
    if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
    row.push(value.trim());
    if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  const aliases = {
    name: ['nombrecompleto','nombreyapellido','fullname','contactname','contacto','name','nombre','cliente','client','customer','leadname','personaname'],
    first: ['firstname','givenname','primernombre','nombres','first','nome'],
    last: ['lastname','familyname','apellido','apellidos','sobrenome','surname'],
    email: ['email','correo','correoelectronico','mail','emailaddress','emailcliente','e-mail','e_mail'],
    phone: ['telefono','telefonocelular','numerodetelefono','celular','movil','phone','phonenumber','mobile','whatsapp','telefone','cel'],
    campaign: ['campana','campaign','campaignname','utmcampaign','origencampana','campanha'],
    notes: ['notas','nota','notes','observaciones','observation','descripcion','description','comentarios','comment'],
    amount: ['importe','monto','amount','value','total','valor','venta','revenue','price','precio'],
    currency: ['moneda','currency','currencycode','moeda'],
    stage: ['estado','status','stage','etapa','pipeline','funnelstage']
  };
  const positions = names => {
    const namesNorm = names.map(norm), found = {};
    for (const [field, keys] of Object.entries(aliases)) {
      found[field] = keys.map(norm).map(x => namesNorm.indexOf(x)).find(x => x >= 0);
      if (found[field] == null) found[field] = -1;
    }
    return found;
  };
  function parseLeadsCsv(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('El archivo CSV está vacío.');
    if (text.length > MAX_CHARS) throw new Error('El archivo es demasiado grande. Máximo 2 MB.');
    const cleanText = text.replace(/^\uFEFF/, '');
    const formats = [',',';','\t'].map(sep => ({ sep, rows: readRows(cleanText,sep) }));
    formats.sort((a,b)=> b.rows[0]?.length - a.rows[0]?.length);
    const table=formats[0].rows;
    if (!table.length || table[0].length < 2) throw new Error('El archivo debe contener columnas CSV separadas por coma, punto y coma o tabulador.');
    const columns=positions(table[0]);
    if(columns.name<0 && columns.first<0) throw new Error('No encontramos columna de nombre. Usa «Nombre», «Name», «Full Name» o «First Name».');
    const rows=[], warnings=[], visited=new Set();
    let skipped=0;
    if(table.length-1>MAX_ROWS) throw new Error('Por seguridad, importa máximo 500 contactos por archivo. Divide el CSV en partes.');
    for(let i=1;i<table.length;i++) {
      const line=table[i],get=k=>columns[k]>=0?String(line[columns[k]]||'').trim():'';
      const name=(get('name') || [get('first'),get('last')].filter(Boolean).join(' ')).slice(0,121);
      const email=get('email'),phone=get('phone'),campaign=get('campaign'),notes=get('notes');
      const amountRaw=get('amount'), currency=get('currency').toUpperCase() || 'PEN', stageRaw=norm(get('stage'));
      const stageMap={nuevo:'new',new:'new',contactado:'contacted',contacted:'contacted',calificado:'qualified',qualified:'qualified',ganado:'won',won:'won',venta:'won',perdido:'lost',lost:'lost'};
      const stage=stageMap[stageRaw]||'new';
      // Prevent a row from silently losing an amount if its format is ambiguous.
      const amount=amountRaw ? Number(amountRaw.replace(/\s/g,'').replace(/,(?=\d{1,2}$)/,'.').replace(/(?<=\d)[,.](?=\d{3}(?:[,.]|$))/g,'')) : null;
      const bad=name.length<2||name.length>120||email.length>160||phone.length>35||campaign.length>150||notes.length>500||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (amountRaw && (!Number.isFinite(amount)||amount<0||amount>1e10)) ||
        !/^[A-Z]{3}$/.test(currency);
      if(bad){skipped++;if(warnings.length<3)warnings.push('Fila '+(i+1)+': datos incompletos o inválidos.');continue;}
      const item={name,email,phone,campaign,notes,amount,currency,stage};
      const sig=JSON.stringify(item).toLowerCase();
      if(visited.has(sig)){skipped++;continue;}
      visited.add(sig);rows.push(item);
    }
    if(!rows.length)throw new Error('No hay contactos válidos en el archivo. '+warnings.join(' '));
    return {rows,skipped,warnings,columns:table[0],separator:formats[0].sep};
  }
  root.edwinCsvImport=Object.freeze({parseLeadsCsv});
})(globalThis);
