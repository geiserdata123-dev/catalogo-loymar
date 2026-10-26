const state={
  products:[],
  byBarcode:new Map(),
  byInternal:new Map(),
  filtered:[],
  query:'',
  category:'',
  brand:'',
  priceMode:'public',
  pageSize:60,
  renderedCount:60,
  debounceTimer:null,
  scanner:null,
  stream:null,
  deferredInstall:null
};
const $=id=>document.getElementById(id);
const money=v=>v==null?'—':Number(v).toLocaleString('es-PE',{style:'currency',currency:'PEN',minimumFractionDigits:2,maximumFractionDigits:2});
const moneyCard=v=>{ if(v==null||v==='') return '—'; const n=Number(v); if(!Number.isFinite(n)) return '—'; return 'S/ '+n.toLocaleString('es-PE',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2});};
const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const exactCode=v=>String(v??'').trim().replace(/\s+/g,'');
const IMAGE_AUDIT=Object.freeze({
  '5':{status:'verified',image:'5.webp',reason:'Foto revisada: corresponde al cortador de ramas telescópico Truper.'},
  '1466':{status:'blocked',reason:'1466.webp muestra un cortador telescópico Truper, no una brocha PARACASA de 4 pulgadas.'}
});
function setStatus(text,ok=false){$('status').textContent=text;$('status').className='status '+(ok?'ok':'offline')}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}

async function loadData(){
 let raw=null;
 try{
  const keys=['LOYMAR_CATALOG_LOCAL_V23'];
  for(const key of keys){
    const local=localStorage.getItem(key);
    if(local){ raw=JSON.parse(local); break; }
  }
 }catch(e){}
 if(!raw) raw=window.LOYMAR_CATALOG;
 if(!raw) throw new Error('No se encontró la base local.');
 state.products=raw.products||[];
 state.byBarcode=new Map();
 for(const p of state.products){const k=exactCode(p.barcode);if(k&&!state.byBarcode.has(k))state.byBarcode.set(k,p);}
 state.byInternal=new Map();
 for(const p of state.products){const k=exactCode(p.internalCode);if(k&&!state.byInternal.has(k))state.byInternal.set(k,p);}
 $('count').textContent=state.products.length.toLocaleString('es-PE');
 fillFilters(); applyFilters(true); setStatus('Catálogo listo',navigator.onLine);
}

function fillFilters(){
 const cats=[...new Set(state.products.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 const brands=[...new Set(state.products.map(p=>p.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 $('category').innerHTML='<option value="">Todas las categorías</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 $('brand').innerHTML='<option value="">Todas las marcas</option>'+brands.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
}

function searchCatalog(query){
 const q=String(query||'').trim();
 if(!q) return state.products;

 const rawCode=exactCode(q);
 const codeLower=rawCode.toLowerCase();
 const nq=norm(q);
 const words=nq.split(/\s+/).filter(Boolean);

 // 1. Coincidencias de código exacto (máxima prioridad)
 const exactInternal=state.products.filter(p=>exactCode(p.internalCode)===rawCode);
 const exactBarcode=state.products.filter(p=>exactCode(p.barcode)===rawCode);
 const exactSet=new Set([...exactInternal,...exactBarcode]);

 // 2. Coincidencias de código parcial (ej. usuario escribe "204" buscando "2048")
 const partialCodeMatches=[];
 if(rawCode.length>=2){
   for(const p of state.products){
     if(exactSet.has(p)) continue;
     const ic=exactCode(p.internalCode);
     const bc=exactCode(p.barcode);
     if(ic.toLowerCase().includes(codeLower)||bc.toLowerCase().includes(codeLower)){
       partialCodeMatches.push(p);
     }
   }
 }
 const partialCodeSet=new Set(partialCodeMatches);

 // 3. Búsqueda multi-palabra tokenizada (todas las palabras deben coincidir)
 const textMatches=[];
 for(const p of state.products){
   if(exactSet.has(p)||partialCodeSet.has(p)) continue;
   const nameN=norm(p.name);
   const brandN=norm(p.brand);
   const catN=norm(p.category);
   const full=`${nameN} ${brandN} ${catN} ${p.internalCode||''} ${p.barcode||''}`;
   const allWordsPresent=words.every(w=>full.includes(w));
   if(allWordsPresent){
     textMatches.push({
       p,
       nameStarts: nameN.startsWith(nq) ? 1 : 0,
       nameIncludesPhrase: nameN.includes(nq) ? 1 : 0
     });
   }
 }

 textMatches.sort((a,b)=>{
   if(b.nameStarts!==a.nameStarts) return b.nameStarts-a.nameStarts;
   if(b.nameIncludesPhrase!==a.nameIncludesPhrase) return b.nameIncludesPhrase-a.nameIncludesPhrase;
   return a.p.name.localeCompare(b.p.name,'es');
 });

 return [
   ...exactInternal,
   ...exactBarcode.filter(p=>!exactInternal.includes(p)),
   ...partialCodeMatches,
   ...textMatches.map(m=>m.p)
 ];
}

function applyFilters(resetPage=true){
 if(resetPage){ state.renderedCount=state.pageSize; }
 const base=searchCatalog(state.query);
 state.filtered=base.filter(p=>(!state.category||p.category===state.category)&&(!state.brand||p.brand===state.brand));
 const total=state.filtered.length;
 $('resultMeta').textContent=`${total.toLocaleString('es-PE')} resultados`;
 const visibleCount=Math.min(state.renderedCount,total);
 renderGrid(state.filtered.slice(0,visibleCount));
 updatePagination(visibleCount,total);
}

function updatePagination(visible,total){
 const panel=$('paginationPanel');
 if(!panel) return;
 if(total===0){
   panel.hidden=true;
   return;
 }
 panel.hidden=false;
 const text=$('pageProgressText');
 const bar=$('pageProgressBar');
 const btnMore=$('loadMoreBtn');
 const btnAll=$('loadAllBtn');

 const pct=total>0?Math.min(100,Math.round((visible/total)*100)):0;
 if(bar) bar.style.width=`${pct}%`;

 if(visible>=total){
   if(text) text.textContent=total<=state.pageSize?`Total: ${total.toLocaleString('es-PE')} productos`:`Se muestran todos los ${total.toLocaleString('es-PE')} productos`;
   if(btnMore) btnMore.hidden=true;
   if(btnAll) btnAll.hidden=true;
 } else {
   const remaining=total-visible;
   const nextBatch=Math.min(state.pageSize,remaining);
   if(text) text.textContent=`Mostrando ${visible.toLocaleString('es-PE')} de ${total.toLocaleString('es-PE')} productos`;
   if(btnMore){
     btnMore.hidden=false;
     btnMore.textContent=`Mostrar más productos (+${nextBatch.toLocaleString('es-PE')})`;
   }
   if(btnAll){
     btnAll.hidden=remaining<=state.pageSize;
     btnAll.textContent=`Mostrar los ${remaining.toLocaleString('es-PE')} restantes`;
   }
 }
}

function loadMore(all=false){
 if(all){
   state.renderedCount=state.filtered.length;
 } else {
   state.renderedCount=Math.min(state.renderedCount+state.pageSize,state.filtered.length);
 }
 applyFilters(false);
}

function priceFor(p){if(state.priceMode==='wholesale')return p.wholesalePrice;if(state.priceMode==='diamond')return p.diamondPrice;return p.publicPrice}
function imageUrl(p){
  const audit=IMAGE_AUDIT[exactCode(p&&p.internalCode)];
  if(audit?.status==='blocked')return null;
  const ref=audit?.image||((p&&p.image)?String(p.image).trim():'');
  return ref?`productos/${encodeURIComponent(ref)}`:null;
}
function priceBlock(label,value,kind){return `<div class="price price-${kind}"><span>${label}</span><b title="${esc(money(value))}">${moneyCard(value)}</b></div>`}

function card(p){
 const img=imageUrl(p), stock=Number(p.stock||0), code=exactCode(p.internalCode);
 const imageMarkup=img
  ? `<button type="button" class="product-image image-button" data-image="${esc(img)}" data-alt="${esc(p.name)}" aria-label="Ver imagen grande de ${esc(p.name)}"><img src="${img}" alt="${esc(p.name)}" loading="lazy" onerror="this.closest('.image-button').outerHTML='<div class=&quot;product-image image-missing&quot;><span>📷 Imagen pendiente</span></div>'"></button>`
  : `<div class="product-image image-missing"><span>📷 Imagen pendiente</span></div>`;
 return `<article class="product-card" data-internal="${esc(code)}" data-barcode="${esc(p.barcode)}">${imageMarkup}<div class="product-body"><div class="product-name">${esc(p.name)}</div><div class="meta code-only">Código: ${esc(code||'—')}</div><div class="price-row">${priceBlock('Público',p.publicPrice,'public')}${priceBlock('Mayorista',p.wholesalePrice,'wholesale')}${priceBlock('Diamante',p.diamondPrice,'diamond')}</div><div class="stock ${stock<=0?'out':''}">${stock>0?`Stock: ${stock}`:'Sin stock'}</div><div class="product-actions"><button type="button" class="secondary detailBtn">Ver ficha</button><button type="button" class="primary shareBtn">WhatsApp</button></div></div></article>`;
}

function renderGrid(list){
 $('grid').innerHTML=list.map(card).join('');
 $('empty').hidden=list.length>0;
}

function getProductByAnyCode(code){
 const k=exactCode(code);
 if(!k) return null;
 return state.byInternal.get(k)||state.byBarcode.get(k)||null;
}

function lookup(q){
 const k=exactCode(q);
 let p=state.byBarcode.get(k);
 if(p)return {p,kind:'Código de barras'};
 p=state.byInternal.get(k);
 if(p)return {p,kind:'Código interno'};
 return null;
}

function doSearch(q){
 clearTimeout(state.debounceTimer);
 state.debounceTimer=setTimeout(()=>{
   state.query=q;
   applyFilters(true);
 },180);
}

function openDetail(code){
 const p=getProductByAnyCode(code); if(!p)return;
 const img=imageUrl(p), internal=exactCode(p.internalCode);
 $('modal').hidden=false;
 $('modal').innerHTML=`<div class="modal-card"><button class="iconbtn close" onclick="closeModal()" aria-label="Cerrar">×</button><div class="detail-grid"><div class="detail-image ${img?'clickable':''}" ${img?`data-detail-image="${esc(img)}" data-detail-alt="${esc(p.name)}" tabindex="0" role="button" aria-label="Ver imagen grande"`:''}>${img?`<img src="${img}" alt="${esc(p.name)}" onerror="this.closest('.detail-image').innerHTML='<span>📷 Imagen pendiente</span>'">`:'<span>📷 Imagen pendiente</span>'}</div><div><h2 class="detail-title">${esc(p.name)}</h2><div class="detail-meta">Código: ${esc(internal||'—')}</div><div class="detail-section"><div class="detail-prices">${priceBlock('Público',p.publicPrice,'public')}${priceBlock('Mayorista',p.wholesalePrice,'wholesale')}${priceBlock('Diamante',p.diamondPrice,'diamond')}</div></div><div class="detail-section"><div class="stock ${Number(p.stock)<=0?'out':''}">${Number(p.stock)>0?'Stock disponible: '+p.stock:'Sin stock'}</div></div><div class="detail-section"><button class="primary" onclick="shareProduct('${esc(internal)}')">Compartir por WhatsApp</button></div></div></div></div>`;
 const detailImg=document.querySelector('[data-detail-image]');
 if(detailImg){detailImg.addEventListener('click',()=>openImageViewer(detailImg.dataset.detailImage,detailImg.dataset.detailAlt));detailImg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openImageViewer(detailImg.dataset.detailImage,detailImg.dataset.detailAlt)}})}
}
function closeModal(){$('modal').hidden=true;$('modal').innerHTML=''}
window.closeModal=closeModal;

function openImageViewer(src,alt){
 $('lightbox').hidden=false;
 $('lightboxImage').src=src;
 $('lightboxImage').alt=alt||'Imagen del producto';
 $('lightboxCaption').textContent=alt||'';
}
function closeImageViewer(){
 $('lightbox').hidden=true;
 $('lightboxImage').removeAttribute('src');
}
window.closeImageViewer=closeImageViewer;

function shareProduct(code){
 const p=getProductByAnyCode(code);
 if(!p)return;
 const text=`LOYMAR – ${p.name}\nCódigo: ${p.internalCode}\nPúblico: ${money(p.publicPrice)}\nMayorista: ${money(p.wholesalePrice)}\nDiamante: ${money(p.diamondPrice)}`;
 window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
}
window.shareProduct=shareProduct;

async function startScanner(){
 $('scanPanel').hidden=false;$('scanMessage').textContent='Preparando cámara…';
 if(!window.isSecureContext){$('scanMessage').textContent='La cámara necesita HTTPS. Publica el catálogo en una dirección https:// para probarla en el teléfono.';return;}
 if(!navigator.mediaDevices?.getUserMedia){$('scanMessage').textContent='Este navegador no permite acceso a la cámara.';return;}
 if(!('BarcodeDetector' in window)){ $('scanMessage').textContent='Este navegador no tiene BarcodeDetector. Puedes seguir usando la búsqueda manual; en la siguiente etapa añadiremos el motor de respaldo para Android/iPhone.'; return; }
 try{
  const formats=await BarcodeDetector.getSupportedFormats();
  const wanted=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','codabar'].filter(f=>formats.includes(f));
  state.scanner=new BarcodeDetector({formats:wanted.length?wanted:formats});
  state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  $('video').srcObject=state.stream;await $('video').play();$('scanMessage').textContent='Apunta al código de barras…';scanLoop();
 }catch(e){$('scanMessage').textContent='No se pudo abrir la cámara: '+e.message;stopScanner()}
}
async function scanLoop(){
 if(!state.stream||!state.scanner||$('scanPanel').hidden)return;
 try{const codes=await state.scanner.detect($('video'));if(codes?.length){const raw=exactCode(codes[0].rawValue);const hit=lookup(raw);if(hit){$('search').value=raw;state.query=raw;stopScanner();applyFilters(true);return}else{$('scanMessage').textContent='Código leído: '+raw+' — no existe en la base.'}}}catch(e){}
 requestAnimationFrame(scanLoop)
}
function stopScanner(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}$('video').srcObject=null;$('scanPanel').hidden=true}
function installPwa(){if(!state.deferredInstall)return;state.deferredInstall.prompt();state.deferredInstall.userChoice.then(()=>{state.deferredInstall=null;$('installBtn').hidden=true})}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;$('installBtn').hidden=false});
window.addEventListener('online',()=>setStatus('Con internet',true));
window.addEventListener('offline',()=>setStatus('Sin internet'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// Delegación de eventos en el grid para rendimiento óptimo y sin fugas de memoria
$('grid').addEventListener('click',e=>{
 const detailBtn=e.target.closest('.detailBtn');
 if(detailBtn){
   const card=detailBtn.closest('.product-card');
   if(card) openDetail(card.dataset.internal||card.dataset.barcode);
   return;
 }
 const shareBtn=e.target.closest('.shareBtn');
 if(shareBtn){
   const card=shareBtn.closest('.product-card');
   if(card) shareProduct(card.dataset.internal||card.dataset.barcode);
   return;
 }
 const imgBtn=e.target.closest('.image-button');
 if(imgBtn){
   openImageViewer(imgBtn.dataset.image,imgBtn.dataset.alt);
   return;
 }
});

// Eventos de paginación
const loadMoreBtn=$('loadMoreBtn');
if(loadMoreBtn) loadMoreBtn.addEventListener('click',()=>loadMore(false));
const loadAllBtn=$('loadAllBtn');
if(loadAllBtn) loadAllBtn.addEventListener('click',()=>loadMore(true));

// Detección de scroll para carga progresiva continua
if('IntersectionObserver' in window && loadMoreBtn){
 const scrollObserver=new IntersectionObserver(entries=>{
   if(entries[0].isIntersecting && !loadMoreBtn.hidden && state.filtered.length>state.renderedCount){
     loadMore(false);
   }
 },{rootMargin:'250px'});
 scrollObserver.observe(loadMoreBtn);
}

// Eventos de búsqueda y filtros
$('search').addEventListener('input',e=>doSearch(e.target.value));
$('clearSearch').addEventListener('click',()=>{
 clearTimeout(state.debounceTimer);
 $('search').value='';
 state.query='';
 applyFilters(true);
 $('search').focus();
});
$('category').addEventListener('change',e=>{state.category=e.target.value;applyFilters(true)});
$('brand').addEventListener('change',e=>{state.brand=e.target.value;applyFilters(true)});
$('resetFilters').addEventListener('click',()=>{
 clearTimeout(state.debounceTimer);
 state.category='';
 state.brand='';
 state.query='';
 $('category').value='';
 $('brand').value='';
 $('search').value='';
 applyFilters(true);
});
$('scanBtn').addEventListener('click',startScanner);
$('closeScan').addEventListener('click',stopScanner);
$('installBtn').addEventListener('click',installPwa);
$('refreshBtn').addEventListener('click',()=>location.reload());
$('lightboxClose').addEventListener('click',closeImageViewer);
$('lightbox').addEventListener('click',e=>{if(e.target.id==='lightbox')closeImageViewer()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){
   if(!$('lightbox').hidden)closeImageViewer();
   else if(!$('modal').hidden)closeModal();
 }
});

loadData().catch(e=>{$('resultMeta').textContent='No se pudo cargar la base: '+e.message;setStatus('Error de base')});
