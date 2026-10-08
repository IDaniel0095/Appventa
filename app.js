const K='inv_pwa_v1',COL=['#ff8fb8','#b79ced','#7cc4f5','#6fcfa8','#ffab91'];
const $=s=>document.querySelector(s);
let S=JSON.parse(localStorage.getItem(K)||'null')||{cfg:{cur:'Bs.',theme:'light',ac:COL[0]},products:[],sales:[]};
S.products.forEach(p=>{if(!p.discs){p.discs=p.disc>0?[p.disc]:[];delete p.disc}}); // migración v1 → múltiples descuentos
if(!COL.includes(S.cfg.ac))S.cfg.ac=COL[0]; // paleta nueva
let tab=0,q='',cp=null,tt,D={new:[],rs:[],ed:[]}; // descuentos temporales por formulario
let sy;
const save=()=>{localStorage.setItem(K,JSON.stringify(S));clearTimeout(sy);sy=setTimeout(syncToFirebase,1500)}; // local primero, nube después
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const today=()=>new Date().toISOString().slice(0,10);
const ld=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const cur=n=>S.cfg.cur+' '+(+n||0).toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const find=id=>S.products.find(p=>p.id==id);
const stock=p=>p.lots.reduce((a,l)=>a+l.qty,0);
const unit=p=>(p.lots.find(l=>l.qty>0)||p.lots[p.lots.length-1]).cost; // costo del lote activo (FIFO)
function fifo(p,n,commit){let c=0;for(const l of p.lots){if(n<=0)break;const t=Math.min(l.qty,n);c+=t*l.cost;n-=t;if(commit)l.qty-=t}return c}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2000)}
const sheet=h=>{$('#sheet').innerHTML=h;$('#modal').classList.remove('hidden');document.body.style.overflow='hidden'};
const close=()=>{$('#modal').classList.add('hidden');document.body.style.overflow=''};
const PEN='<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>';

/* ---------- Editor de descuentos (etiquetas) ---------- */
const lend=(k,tag,val)=>`<label>Etiqueta</label><div class="seg" id="tg-${k}"><button data-a="seg" data-v="propio" class="${tag=='propio'?'on':''}">Propio</button><button data-a="seg" data-v="prestado" class="${tag=='prestado'?'on':''}">Prestado</button></div><div id="lw-${k}" class="${tag=='prestado'?'':'hidden'}"><label>Prestado por (Nombre)</label><input id="ln-${k}" value="${esc(val)}" placeholder="Ej. Juan"></div>`;
const lread=k=>{const t=$('#tg-'+k+' .on').dataset.v;return{tag:t,lender:t=='prestado'?$('#ln-'+k).value.trim():''}};
const dchips=k=>D[k].map((d,i)=>`<span class="chip">${d}% <button data-a="rmd" data-v="${k}:${i}" aria-label="Quitar">✕</button></span>`).join('')||'<small class="mut">Sin descuentos</small>';
const dedit=k=>`<label>Descuentos (%)</label><div class="chips" id="dch-${k}">${dchips(k)}</div><div class="drow"><input id="dn-${k}" type="number" inputmode="decimal" placeholder="Ej. 10"><button class="mini" data-a="addd" data-v="${k}">Añadir</button></div>`;

/* ---------- Vistas ---------- */
const card=p=>{const s=stock(p),u=unit(p);return `<div class="card ${s<=0?'st-rd':s<=2?'st-or':'st-gr'}"><div class="row" data-a="sell" data-v="${p.id}">
<div class="head"><div class="grow"><b>${esc(p.name)}</b><span class="tag ${p.tag}">${p.tag=='propio'?'Propio':'Prestado'}</span></div><div class="top"><span class="badge ${s<1?'zero':''}">📦 Stock: ${s}</span><button class="ibtn" data-a="edit" data-v="${p.id}" aria-label="Editar">${PEN}</button></div></div>
${p.tag=='prestado'&&p.lender?`<div class="pr" style="margin-top:6px">🤝 Prestado por: <b>${esc(p.lender)}</b></div>`:''}<div class="pr">Precio original: <b>${cur(u)}</b></div>
${p.discs.length?`<div class="pr">Precio con descuento:</div><div class="chips">${p.discs.map(d=>`<span class="chip">−${d}% → <b>${cur(u*(1-d/100))}</b></span>`).join('')}</div>`:''}
</div><details><summary>Anotaciones</summary><textarea data-note="${p.id}" placeholder="Escribe una nota...">${esc(p.notes)}</textarea></details></div>`};
const lst=()=>{const l=S.products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(stock(a)<=0)-(stock(b)<=0)||a.name.localeCompare(b.name,'es'));return l.map(card).join('')||'<p class="empty">🧸 Aún no hay productos.<br>Agrega uno en la pestaña Productos.</p>'};
const inv=()=>`<h1>🎀 Inventario</h1><input id="q" placeholder="Buscar producto..." value="${esc(q)}"><div id="list">${lst()}</div>`;
function prod(){D.new=[];D.rs=[];return `<h1>🛍️ Productos</h1>
<div class="card"><b>Reabastecer</b><input id="rs" list="dl" placeholder="Buscar producto existente..." autocomplete="off"><datalist id="dl">${S.products.map(p=>`<option value="${esc(p.name)}">`).join('')}</datalist><div id="rsf"></div></div>
<div class="card"><b>Nuevo producto</b>
<label>Nombre</label><input id="nn">
<label>Precio de costo original (${S.cfg.cur})</label><input id="nc" type="number" step="0.01" inputmode="decimal">
${dedit('new')}
<label>Cantidad inicial</label><input id="nq" type="number" value="1" inputmode="numeric">
${lend('new','propio','')}
<label>Anotaciones</label><textarea id="nt"></textarea>
<button class="btn" data-a="add">Guardar producto</button></div>`}
function vts(){
  const t0=ld();
  const pend=S.sales.filter(s=>s.type=='fiado'&&!s.paid).sort((a,b)=>(a.due||'9')>(b.due||'9')?1:-1);
  const hist=S.sales.filter(s=>s.paid).sort((a,b)=>b.date.localeCompare(a.date));
  const TRASH='<svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>';
  const tl=s=>{ // semáforo según fecha compromiso
    if(!s.due)return['gr','Sin fecha compromiso'];
    const d=Math.round((new Date(s.due+'T00:00:00')-t0)/864e5);
    return d<0?['rd','Vencido hace '+(-d)+(d==-1?' día':' días')]:d==0?['or','Vence hoy']:d<=2?['or','Vence en '+d+(d==1?' día':' días')]:['gr','Vence el '+s.due]};
  
  return `<h1>🧁 Ventas</h1><div class="sec-t">💗 Pendientes (fiados) · ${cur(pend.reduce((a,s)=>a+s.total,0))}</div>`+
  (pend.map(s=>{const[c,t]=tl(s);return `<div class="card tl ${c}"><div class="head"><div class="grow"><b>${esc(s.client)}</b><div style="margin-top:2px"><b>${cur(s.total)}</b></div></div><button class="ibtn" data-a="delSale" data-v="${s.id}" aria-label="Eliminar">${TRASH}</button></div><div class="mut" style="margin:6px 0 0">${esc(s.name)} ×${s.qty}</div><div class="state">${t}</div><div class="acts"><button class="btn wa" data-a="wa" data-v="${s.id}">Cobrar</button><button class="btn sec" data-a="paid" data-v="${s.id}">Marcar pagado</button></div></div>`}).join('')||'<p class="empty">🎉 ¡Sin cobros pendientes!</p>')+
  `<div class="sec-t" style="display:flex;justify-content:space-between;align-items:center">🌷 Historial de ventas ${hist.length?`<button class="mini" data-a="clrSales" style="margin:0">Vaciar historial</button>`:''}</div>`+
  (hist.map(s=>`<div class="card"><div class="head"><div class="grow"><b>${esc(s.name)}</b><div class="mut" style="margin:0">${new Date(s.date).toLocaleDateString('es')}</div></div><button class="ibtn" data-a="delSale" data-v="${s.id}" aria-label="Eliminar">${TRASH}</button></div><div class="pr">Cantidad: <b>${s.qty}</b></div><div class="pr" style="margin-top:2px">Precio vendido final: <b>${cur(s.price)}</b>${s.qty>1?` c/u · total ${cur(s.total)}`:''}</div><div class="gainv ${s.profit<0?'neg':''}">Ganancia: ${cur(s.profit)}</div></div>`).join('')||'<p class="empty">🍰 Aún no hay ventas cerradas.</p>');
}
function cfg(){const g=S.sales.reduce((a,s)=>a+s.profit,0);return `<h1>✨ Ajustes</h1>
<div class="card"><b>Resumen</b><p class="mut">${S.sales.length} ventas · Ganancia total ${cur(g)}</p></div>
<div class="card"><label>Moneda (solo cambia el símbolo, no convierte montos)</label><select data-c="1"><option value="Bs." ${S.cfg.cur=='Bs.'?'selected':''}>Bolivianos (Bs.)</option><option value="USD" ${S.cfg.cur=='USD'?'selected':''}>Dólares (USD)</option></select>
<label>Tema</label><div class="seg"><button data-a="th" data-v="light" class="${S.cfg.theme=='light'?'on':''}">Claro</button><button data-a="th" data-v="dark" class="${S.cfg.theme=='dark'?'on':''}">Oscuro</button></div>
<label>Color de acento</label>${COL.map(c=>`<button class="sw ${S.cfg.ac==c?'on':''}" style="background:${c}" data-a="ac" data-v="${c}"></button>`).join('')}</div>
<div class="card"><b>☁️ Nube (Firebase)</b><p class="mut">${fdb?'Respaldo automático activado cuando hay internet.':'Firebase no configurado: completa firebaseConfig en index.html.'}</p><label>Código de respaldo (guárdalo para usarlo en otro celular)</label><input id="cid" value="${esc(CID)}"><button class="btn sec" data-a="cid">Guardar código</button><button class="btn sec" data-a="cloud">Respaldar ahora</button><button class="btn" data-a="restore">Restaurar desde la nube (Firebase)</button></div>
<div class="card"><b>Datos</b><button class="btn" data-a="csv">Exportar a Excel (.csv)</button><button class="btn sec" data-a="bk">Exportar Base de Datos (.json)</button><button class="btn sec" data-a="imp">Importar Base de Datos</button><input type="file" id="f" accept=".json,application/json"></div>`}
function render(){
  document.body.dataset.theme=S.cfg.theme;
  document.documentElement.style.setProperty('--ac',S.cfg.ac);
  document.querySelector('meta[name=theme-color]').content=S.cfg.ac;
  $('#view').innerHTML=[inv,vts,prod,cfg][tab]();
  document.querySelectorAll('nav button').forEach((b,i)=>b.classList.toggle('on',i==tab));
}

/* ---------- Venta ---------- */
function sellModal(){
  sheet(`<h2>${esc(cp.name)}</h2>
  <div class="info"><div>Stock<b>${stock(cp)}</b></div><div>Precio original<b>${cur(unit(cp))}</b></div></div>
  <label>Cantidad</label><input id="sq" type="number" min="1" max="${stock(cp)}" value="1" inputmode="numeric">
  ${cp.discs.length?`<label>Descuentos rápidos</label><div class="chips">${cp.discs.map(d=>`<button class="chip" data-a="dsc" data-v="${d}">−${d}%</button>`).join('')}</div>`:''}
  <label>Precio de venta final (c/u)</label><input id="sp" type="number" step="0.01" inputmode="decimal" placeholder="0.00">
  <div class="gain" id="gain">Ganancia: —</div>
  <div class="seg" id="ty"><button class="on" data-a="seg" data-v="contado">Contado</button><button data-a="seg" data-v="fiado">Fiado</button></div>
  <div id="fi" class="hidden"><input id="cn" placeholder="Nombre del cliente"><input id="cp" type="tel" placeholder="WhatsApp con código de país (ej. 59171234567)" inputmode="tel"><label>Fecha compromiso de pago</label><input id="cd" type="date"><button class="btn wa" data-a="waf">Abrir WhatsApp</button></div>
  <button class="btn" data-a="ok">Registrar venta</button><button class="btn sec" data-a="close">Cancelar</button>`);
}
function gain(){
  const n=+$('#sq').value||0,pr=$('#sp').value,c=fifo(cp,n,false),g=pr*n-c;
  $('#gain').innerHTML=pr===''?'Ganancia: —':`Ganancia: <span style="color:${g>=0?'var(--ok)':'var(--bad)'}">${cur(g)}</span> <small>(${cur(pr-c/(n||1))} c/u)</small>`;
}
function wa(s){
  const n=(s.phone||'').replace(/\D/g,'');if(!n)return toast('Ingresa el número de WhatsApp');
  const t=`Hola ${s.client||''}, te recuerdo el pago pendiente de ${cur(s.total)} por ${s.name}${s.due?' (fecha acordada: '+s.due+')':''}. ¡Gracias!`;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(t)}`,'_blank');
}

/* ---------- Reabastecer ---------- */
function rsf(v){
  const p=S.products.find(x=>x.name.toLowerCase()==v.trim().toLowerCase());
  D.rs=p?[...p.discs]:[];
  $('#rsf').innerHTML=p?`<p class="mut">Stock: ${stock(p)} · Costo actual: ${cur(unit(p))}</p><label>Cantidad entrante</label><input id="rq" type="number" min="1" inputmode="numeric"><label>Nuevo precio de costo</label><input id="rc" type="number" step="0.01" inputmode="decimal">${lend('rs',p.tag,p.lender||'')}${dedit('rs')}<button class="btn" data-a="restock" data-v="${p.id}">Agregar lote</button>`:'';
}

/* ---------- Datos ---------- */
function dl(name,txt,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
const csv=r=>r.map(x=>x.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
function importDB(f){
  if(!f)return;
  f.text().then(t=>{try{
    const o=JSON.parse(t);if(!o[K])throw 0;
    if(!confirm('Esto reemplazará todos los datos actuales. ¿Continuar?'))return;
    localStorage.clear();Object.entries(o).forEach(([k,v])=>localStorage.setItem(k,v));location.reload();
  }catch{toast('Archivo inválido')}});
}

/* ---------- Firebase (respaldo en la nube, offline-first) ---------- */
const UK='inv_pwa_cid';
let CID=localStorage.getItem(UK);
if(!CID){CID=(crypto.randomUUID?crypto.randomUUID():uid()+uid()+uid()).replace(/-/g,'');localStorage.setItem(UK,CID)}
let fdb=null;
try{if(window.firebase&&firebaseConfig.databaseURL){firebase.initializeApp(firebaseConfig);fdb=firebase.database()}}catch(e){}
function syncToFirebase(){
  if(!fdb||!navigator.onLine)return;
  const d=localStorage.getItem(K);if(!d)return;
  try{fdb.ref('users/'+CID).set({data:d,t:Date.now()}).catch(()=>{})}catch(e){}
}
addEventListener('online',syncToFirebase);

/* ---------- Acciones ---------- */
const A={
  nav(v){tab=+v;render();scrollTo(0,0)},
  close,
  sell(v){cp=find(v);if(stock(cp)<1)return toast('Sin stock');sellModal()},
  dsc(v,d){$('#sp').value=(unit(cp)*(1-v/100)).toFixed(2);document.querySelectorAll('.chips .chip[data-a=dsc]').forEach(b=>b.classList.toggle('on',b==d));gain()},
  seg(v,d){d.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b==d));const pid=d.parentElement.id;if(pid=='ty')$('#fi').classList.toggle('hidden',v!='fiado');if(pid.startsWith('tg-')){const k=pid.slice(3);$('#lw-'+k).classList.toggle('hidden',v!='prestado');if(v!='prestado')$('#ln-'+k).value=''}},
  addd(k){const v=+$('#dn-'+k).value;if(!(v>0&&v<100))return toast('Ingresa un % entre 1 y 99');if(!D[k].includes(v))D[k].push(v);D[k].sort((a,b)=>a-b);$('#dch-'+k).innerHTML=dchips(k);$('#dn-'+k).value=''},
  rmd(v){const[k,i]=v.split(':');D[k].splice(+i,1);$('#dch-'+k).innerHTML=dchips(k)},
  edit(v){
    cp=find(v);D.ed=[...cp.discs];
    sheet(`<h2>Editar producto</h2><label>Nombre</label><input id="en" value="${esc(cp.name)}">
    <label>Precio de costo original (lote actual)</label><input id="ec" type="number" step="0.01" inputmode="decimal" value="${unit(cp).toFixed(2)}">
    ${lend('ed',cp.tag,cp.lender||'')}
    ${dedit('ed')}<button class="btn" data-a="saveEdit" data-v="${cp.id}">Guardar cambios</button><button class="btn sec" data-a="del" data-v="${cp.id}">Eliminar producto</button><button class="btn sec" data-a="close">Cancelar</button>`);
  },
  saveEdit(v){
    const p=find(v),n=$('#en').value.trim(),c=$('#ec').value;
    if(!n||c==='')return toast('Completa nombre y costo');
    p.name=n;Object.assign(p,lread('ed'));p.discs=[...D.ed];
    (p.lots.find(l=>l.qty>0)||p.lots[p.lots.length-1]).cost=+c; // solo el lote activo; los demás lotes no cambian
    save();close();render();toast('Producto actualizado');
  },
  del(v){if(!confirm('¿Eliminar este producto? Las ventas registradas se conservan.'))return;S.products=S.products.filter(p=>p.id!=v);save();close();render()},
  th(v){S.cfg.theme=v;save();render()},
  ac(v){S.cfg.ac=v;save();render()},
  wa(v){wa(S.sales.find(s=>s.id==v))},
  waf(){wa({client:$('#cn').value,phone:$('#cp').value,due:$('#cd').value,total:(+$('#sp').value||0)*(+$('#sq').value||0),name:cp.name})},
  paid(v){S.sales.find(s=>s.id==v).paid=true;save();render();toast('Venta cobrada')},

delSale(v){
    if(!confirm('¿Eliminar esta venta del registro? (El stock vendido NO regresará al inventario)'))return;
    S.sales=S.sales.filter(s=>s.id!=v);
    save();render();toast('Venta eliminada');
  },
  clrSales(){
    if(!confirm('¿Estás seguro de borrar TODO el historial de ventas cerradas?\n\n(No te preocupes, los cobros pendientes/fiados NO se borrarán).'))return;
    S.sales=S.sales.filter(s=>!s.paid);
    save();render();toast('Historial borrado');
  },

  ok(){
    const n=+$('#sq').value,pr=$('#sp').value;
    if(!(n>=1)||n>stock(cp))return toast('Cantidad inválida');
    if(pr==='')return toast('Ingresa el precio final');
    const fi=$('#ty .on').dataset.v=='fiado',cl=$('#cn').value.trim();
    if(fi&&!cl)return toast('Falta el nombre del cliente');
    const cost=fifo(cp,n,true),total=pr*n;
    S.sales.push({id:uid(),pid:cp.id,name:cp.name,qty:n,price:+pr,total,cost,profit:total-cost,type:fi?'fiado':'contado',client:fi?cl:'',phone:fi?$('#cp').value:'',due:fi?$('#cd').value:'',paid:!fi,date:new Date().toISOString()});
    save();close();render();toast('Venta registrada');
  },
  add(){
    const n=$('#nn').value.trim(),c=$('#nc').value;
    if(!n||c==='')return toast('Completa nombre y precio de costo');
    S.products.push({id:uid(),name:n,...lread('new'),discs:[...D.new],notes:$('#nt').value,lots:[{qty:+$('#nq').value||0,cost:+c,date:today()}]});
    save();tab=0;render();toast('Producto guardado');
  },
  restock(v){
    const p=find(v),n=+$('#rq').value,c=$('#rc').value;
    if(!(n>0)||c==='')return toast('Ingresa cantidad y costo');
    p.lots=p.lots.filter(l=>l.qty>0);
    const t=stock(p)+n;
    p.lots=[{qty:t,cost:(p.lots.reduce((a,l)=>a+l.qty*l.cost,0)+n*c)/t,date:today()}]; // costo promedio automático
    p.discs=[...D.rs];Object.assign(p,lread('rs'));
    save();render();toast('Producto reabastecido');
  },
  csv(){
    const a=[['INVENTARIO'],['Producto','Etiqueta','Stock','Costo actual','Descuentos %','Notas']].concat(S.products.map(p=>[p.name,p.tag+(p.lender?' - '+p.lender:''),stock(p),unit(p),p.discs.join('/'),p.notes]));
    const b=[[],['VENTAS'],['Fecha','Producto','Cant','Precio final c/u','Total','Costo','Ganancia','Tipo','Cliente','WhatsApp','Fecha compromiso','Pagado']].concat(S.sales.map(s=>[s.date.slice(0,10),s.name,s.qty,s.price,s.total,s.cost,s.profit,s.type,s.client,s.phone,s.due,s.paid?'Sí':'No']));
    dl('inventario-'+today()+'.csv','\ufeff'+csv(a.concat(b)),'text/csv');
  },
  bk(){dl('respaldo-inventario-'+today()+'.json',JSON.stringify({...localStorage}),'application/json')},
  imp(){$('#f').click()},
  cid(){const v=$('#cid').value.trim();if(v.length<8)return toast('El código debe tener al menos 8 caracteres');CID=v;localStorage.setItem(UK,v);toast('Código guardado')},
  cloud(){if(!fdb)return toast('Firebase no configurado');if(!navigator.onLine)return toast('Sin internet');syncToFirebase();toast('Respaldando en la nube…')},
  restore(){
    if(!fdb)return toast('Firebase no configurado');
    if(!navigator.onLine)return toast('Sin internet');
    fdb.ref('users/'+CID).once('value').then(sn=>{
      const v=sn.val();if(!v||!v.data)return toast('No hay respaldo en la nube');
      if(!confirm('Esto reemplazará los datos de este celular. ¿Continuar?'))return;
      localStorage.setItem(K,v.data);location.reload();
    }).catch(()=>toast('No se pudo restaurar'));
  }
};
document.addEventListener('click',e=>{
  if(e.target.id=='modal')return close();
  const d=e.target.closest('[data-a]');if(d)A[d.dataset.a]?.(d.dataset.v,d);
});
document.addEventListener('input',e=>{
  const id=e.target.id;
  if(id=='q'){q=e.target.value;$('#list').innerHTML=lst()}
  else if(id=='sq'||id=='sp'){if(id=='sp')document.querySelectorAll('.chips .chip[data-a=dsc]').forEach(b=>b.classList.remove('on'));gain()}
  else if(id=='rs')rsf(e.target.value);
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.c){S.cfg.cur=t.value;save();render()}
  else if(t.dataset.note){find(t.dataset.note).notes=t.value;save();toast('Nota guardada')}
  else if(t.id=='f')importDB(t.files[0]);
});

render();
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js'));
