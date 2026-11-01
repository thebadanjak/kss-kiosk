/* KSS Kiosk · jedna aplikacija, tri načina rada:
 *   kiosk     – kupci naručuju (tablet za kupce)
 *   blagajna  – osoblje vidi narudžbe uživo i prekucava ih u Pelion
 *   admin     – uređivanje menija s mobitela ili računala
 * Način se zadaje u config.js (KSS_MODE) ili u adresi (#kiosk, #blagajna, #admin).
 * Bez Supabase podataka u config.js aplikacija radi u demo načinu (sve samo na ovom uređaju). */
(function(){
'use strict';

const CFG=window.KSS_CONFIG||{};
const HASH=location.hash.replace('#','');
const MODE=['kiosk','blagajna','admin'].includes(HASH)?HASH:(window.KSS_MODE||'kiosk');
const CLOUD=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&window.supabase&&window.supabase.createClient);

/* ---------- storage helpers ---------- */
function lsGet(k,def){try{const s=localStorage.getItem(k);return s?JSON.parse(s):def;}catch(e){return def;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
const KEY='kss-kiosk-config-v2', OKEY='kss-kiosk-orders-v1', NKEY='kss-kiosk-orderno-v1', QKEY='kss-kiosk-queue-v2', RKEY='kss-rid';
const DEVICE=(()=>{let d=lsGet('kss-device-id',null);if(!d){d=MODE+'-'+Math.random().toString(36).slice(2,8);lsSet('kss-device-id',d);}return d;})();

/* ---------- default menu ---------- */
const DEF={
  settings:{brand:'KSS',tagline:'STREET FOOD',pin:'1234',vat:13,idle:60,promo:'',saver:{style:'hero',main:'',side:'',drink:''}},
  groups:[
    {id:'meal',name:'Napravi meni',hint:'pomfrit + piće',type:'single',req:true,opts:[{n:'Samo burger',p:0},{n:'Meni (pomfrit + 0,33 l)',p:3.5},{n:'Veliki meni (veliki pomfrit + 0,5 l)',p:4.7}]},
    {id:'extra',name:'Dodaci',hint:'odaberite više',type:'multi',req:false,opts:[{n:'Dodatni cheddar',p:0.8},{n:'Hrskava slanina',p:1.2},{n:'Jalapeño',p:0.5},{n:'Karamelizirani luk',p:0.6},{n:'Pečeno jaje',p:0.9}]},
    {id:'sauce',name:'Umak',hint:'jedan uključen',type:'single',req:true,opts:[{n:'KSS umak',p:0},{n:'BBQ',p:0},{n:'Majoneza s češnjakom',p:0},{n:'Ljuti chili',p:0},{n:'Bez umaka',p:0}]},
    {id:'size',name:'Veličina',hint:'',type:'single',req:true,opts:[{n:'Mali',p:0},{n:'Srednji',p:0.8},{n:'Veliki',p:1.5}]},
    {id:'dsize',name:'Veličina pića',hint:'',type:'single',req:true,opts:[{n:'0,33 l',p:0},{n:'0,5 l',p:0.9}]}
  ],
  cats:[
    {id:'burger',name:'Burgeri',e:'🍔',sub:'Smash burgeri od 100% junetine, pečeni na ploči',groups:['meal','extra','sauce']},
    {id:'chicken',name:'Piletina',e:'🍗',sub:'Hrskava piletina, marinirana 24 sata',groups:['meal','sauce']},
    {id:'wrap',name:'Wrapovi',e:'🌯',sub:'Topla tortilja, svježe povrće',groups:['extra','sauce']},
    {id:'hotdog',name:'Hot dog',e:'🌭',sub:'Domaća kobasica u mekom pecivu',groups:['extra','sauce']},
    {id:'fries',name:'Pomfrit',e:'🍟',sub:'Rezan svaki dan, pržen dva puta',groups:['size','sauce']},
    {id:'drink',name:'Pića',e:'🥤',sub:'Hladno i osvježavajuće',groups:['dsize']},
    {id:'dessert',name:'Deserti',e:'🍦',sub:'Za kraj',groups:[]}
  ],
  items:[
    ['b1','burger','🍔','Classic Smash','Dvije smash pljeskavice, cheddar, kiseli krastavci, luk, KSS umak',7.9,'Najprodavanije'],
    ['b2','burger','🍔','Double Bacon','Dupla junetina, dupli cheddar, hrskava slanina, BBQ',9.5,''],
    ['b3','burger','🌶️','Hot Zagreb','Junetina, pepper jack, jalapeño, ljuti chili umak',8.7,'Ljuto'],
    ['b4','burger','🥬','Veggie Smash','Biljna pljeskavica, cheddar, rajčica, salata, majoneza',8.2,'Veggie'],
    ['c1','chicken','🍗','Crispy Chicken Burger','Pohani pileći batak, kupus salata, majoneza s češnjakom',7.6,''],
    ['c2','chicken','🍗','Pileći štapići 6 kom','Hrskavi štapići od pilećih prsa',6.2,''],
    ['w1','wrap','🌯','Chicken Wrap','Piletina s roštilja, salata, rajčica, jogurt umak',7.2,''],
    ['w2','wrap','🌯','Halloumi Wrap','Pečeni halloumi, pečena paprika, rukola',7.4,'Novo'],
    ['h1','hotdog','🌭','KSS Hot Dog','Kobasica, prženi luk, senf, kečap',5.4,''],
    ['h2','hotdog','🌭','Chili Cheese Dog','Kobasica, chili con carne, topljeni sir',6.5,'',false],
    ['f1','fries','🍟','Pomfrit','Klasični pomfrit s morskom soli',2.9,''],
    ['f2','fries','🧀','Loaded Fries','Pomfrit, cheddar umak, slanina, mladi luk',5.2,''],
    ['f3','fries','🍠','Batat pomfrit','Slatki krumpir, dimljena paprika',3.9,''],
    ['d1','drink','🥤','Coca-Cola','',2.5,''],
    ['d2','drink','🥤','Coca-Cola Zero','',2.5,''],
    ['d3','drink','🍋','Domaća limunada','Limun, menta, šećer od trske',3.2,''],
    ['d4','drink','💧','Voda','Negazirana',1.8,''],
    ['d5','drink','🍺','Craft pivo','Lokalna pivovara, 0,5 l',4.5,'18+'],
    ['s1','dessert','🍦','Sladoled u čaši','Vanilija, karamel preljev',2.8,''],
    ['s2','dessert','🍩','Krafna','Punjena čokoladom',2.2,'']
  ]
};
function freshConfig(){
  const c=JSON.parse(JSON.stringify({settings:DEF.settings,groups:DEF.groups,cats:DEF.cats}));
  c.items=DEF.items.map(([id,cat,e,name,desc,price,badge,on])=>({id,cat,e,name,desc,price,badge,on:on!==false,img:'',groups:[...c.cats.find(k=>k.id===cat).groups]}));
  return c;
}
function validConfig(d){return d&&Array.isArray(d.items)&&Array.isArray(d.cats)&&Array.isArray(d.groups)&&d.settings;}
let C=(()=>{const c=lsGet(KEY,null);return validConfig(c)?c:freshConfig();})();

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const eur=n=>(+n).toFixed(2).replace('.',',')+' €';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const TINTS=['#2C1D20','#2A2620','#1E2A24','#25202D','#1E252C','#2D2121'];
const tint=id=>TINTS[[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0)%TINTS.length];
const cat=id=>C.cats.find(c=>c.id===id);
const grp=id=>C.groups.find(g=>g.id===id);
const itemById=id=>C.items.find(i=>i.id===id);
const art=(it,cls='')=>`<div class="art ${cls}" style="background:${tint(it.id)}">${esc(it.e)}${it.img?`<img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.remove()">`:''}</div>`;
const itemGroups=it=>C.groups.filter(g=>(it.groups||[]).includes(g.id));
const today=()=>new Date().toLocaleDateString('sv');
function debounce(fn,ms){let t=null;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}
function withTimeout(p,ms){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);}

/* =====================================================================
   DATA LAYER: Supabase (cloud) or this device only (demo)
   ===================================================================== */
let sb=null, RID=lsGet(RKEY,null), LIVE=false, ORD=null, menuDirty=false;
const myRevs=new Set();   // revisions this device saved, so its own realtime echoes are ignored

const Cloud={
  async start(){
    sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'kss-auth'}});
    const {data}=await sb.auth.getSession();
    if(!data||!data.session)return false;
    try{await Cloud.bind();}catch(e){if(e.message==='nomember')throw e;if(!RID)throw e;}
    return true;
  },
  async login(email,password){
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    await Cloud.bind();
  },
  async bind(){
    const {data,error}=await withTimeout(sb.from('members').select('restaurant_id').limit(1),8000);
    if(error)throw error;
    if(!data||!data.length)throw new Error('nomember');
    RID=data[0].restaurant_id; lsSet(RKEY,RID);
  },
  async logout(){try{await sb.auth.signOut();}catch(e){} try{localStorage.removeItem(RKEY);}catch(e){} location.reload();},
  async pullMenu(){
    const {data,error}=await withTimeout(sb.from('menus').select('config').eq('restaurant_id',RID).maybeSingle(),8000);
    if(error)throw error;
    return data?data.config:null;
  },
  async pushMenu(){
    const {error}=await sb.from('menus').upsert({restaurant_id:RID,config:C,updated_at:new Date().toISOString()});
    if(error)throw error;
  },
  async uploadPhoto(dataUrl,itemId){
    const blob=await (await fetch(dataUrl)).blob();
    const path=`${RID}/${itemId}-${Date.now().toString(36)}.jpg`;
    const {error}=await sb.storage.from('menu-photos').upload(path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return sb.storage.from('menu-photos').getPublicUrl(path).data.publicUrl;
  },
  async placeOrder(o,number){
    const {data,error}=await withTimeout(sb.rpc('place_order',{p_restaurant:RID,p_client_id:o.id,p_dine:o.dine,p_lines:o.lines,p_total:o.total,p_device:DEVICE,p_number:number??null}),8000);
    if(error)throw error;
    return Array.isArray(data)?data[0]:data;
  },
  async fetchOrders(){
    const {data,error}=await sb.from('orders').select('*').eq('restaurant_id',RID).order('created_at',{ascending:false}).limit(300);
    if(error)throw error;
    ORD=data.map(rowToOrder); onOrders();
  },
  async setStatus(id,status){
    const {error}=await sb.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error)throw error;
    const o=(ORD||[]).find(x=>x.id===id); if(o){o.status=status;onOrders();}
  },
  subscribe(){
    sb.channel('kss-'+RID)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:'restaurant_id=eq.'+RID},p=>{
        if(!ORD)ORD=[];
        if(p.eventType==='DELETE'){ORD=ORD.filter(o=>o.id!==(p.old&&p.old.id));}
        else{const o=rowToOrder(p.new);const i=ORD.findIndex(x=>x.id===o.id);if(i>=0)ORD[i]=o;else ORD.unshift(o);ORD.sort((a,b)=>b.ts-a.ts);}
        onOrders();
      })
      .on('postgres_changes',{event:'*',schema:'public',table:'menus',filter:'restaurant_id=eq.'+RID},p=>{
        const cfg=p.new&&p.new.config; if(!validConfig(cfg))return;
        if(cfg._rev&&myRevs.has(cfg._rev))return;   // our own save
        applyRemoteMenu(cfg);
      })
      .subscribe(st=>{LIVE=st==='SUBSCRIBED';paintSync();if(LIVE){Cloud.fetchOrders().catch(()=>{});}});
  },
  async cleanup(){try{await sb.from('orders').delete().eq('restaurant_id',RID).lt('created_at',new Date(Date.now()-30*864e5).toISOString());}catch(e){}}
};
function rowToOrder(r){return {id:r.id,clientId:r.client_id,no:r.number,ts:Date.parse(r.created_at),dine:r.dine,total:+r.total,status:r.status,lines:r.lines||[],device:r.device};}

/* menu save: local cache always, cloud debounced */
const pushMenuSoon=debounce(async()=>{
  if(!CLOUD||!RID)return;
  try{await Cloud.pushMenu();menuDirty=false;paintSync();}
  catch(e){menuDirty=true;paintSync();toast('Meni nije spremljen u oblak. Pokušat ću ponovno kad se veza vrati.',true);}
},800);
function save(){
  C._rev=Math.random().toString(36).slice(2,10); myRevs.add(C._rev); if(myRevs.size>500)myRevs.delete(myRevs.values().next().value);
  const ok=lsSet(KEY,C);
  if(CLOUD){menuDirty=true;paintSync();pushMenuSoon();return true;}
  if(!ok){toast('Nema mjesta za spremanje. Uklonite neku fotografiju ili koristite manje slike.',true);return false;}
  return true;
}
function applyRemoteMenu(cfg){
  C=cfg; lsSet(KEY,C); brand();
  const vis=[...document.querySelectorAll('.screen')].find(s=>!s.hidden);
  if(!vis)return;
  if(vis.id==='menu')renderMenu();
  if(vis.id==='admin'&&!document.querySelector('.overlay')&&A.tab!=='orders'){if(A.tab==='items'&&$('#itemGrid'))renderItemGrid();else renderAdmin();toast('Meni je promijenjen na drugom uređaju');}
}
async function syncMenu(){
  try{
    const remote=await Cloud.pullMenu();
    if(validConfig(remote)){C=remote;lsSet(KEY,C);}
    else{await Cloud.pushMenu();}  // first device seeds the cloud with its menu
    menuDirty=false;
  }catch(e){/* offline: keep cached menu */}
  brand();
}

/* orders */
function loadOrders(){return CLOUD?(ORD||[]):lsGet(OKEY,[]);}
function nextLocalNo(base){const d=today();let s=lsGet(NKEY,{d,n:0});if(s.d!==d)s={d,n:0};s={d,n:s.n>=98?1:s.n+1};lsSet(NKEY,s);return base+s.n;}
async function submitOrder(o){
  if(!CLOUD){o.no=nextLocalNo(99);const L=lsGet(OKEY,[]);L.unshift(o);lsSet(OKEY,L.slice(0,300));onOrders();return o.no;}
  try{const row=await Cloud.placeOrder(o);return row.number;}
  catch(e){
    // bez interneta: broj 900+ s ovog uređaja, narudžba čeka slanje
    const no=nextLocalNo(900); const q=lsGet(QKEY,[]); q.push({o,no}); lsSet(QKEY,q); paintSync(); return no;
  }
}
async function flushQueue(){
  if(!CLOUD||!RID)return; const q=lsGet(QKEY,[]); if(!q.length)return;
  const left=[]; for(const x of q){try{await Cloud.placeOrder(x.o,x.no);}catch(e){left.push(x);}}
  lsSet(QKEY,left); paintSync();
  if(menuDirty)pushMenuSoon();
}
async function setOrderStatus(id,st){
  if(CLOUD){try{await Cloud.setStatus(id,st);}catch(e){toast('Promjena nije spremljena. Provjerite internetsku vezu.',true);}return;}
  lsSet(OKEY,lsGet(OKEY,[]).map(o=>o.id===id?{...o,status:st}:o)); onOrders();
}
let seenOpen=null, actx=null;
function onOrders(){
  const open=loadOrders().filter(o=>o.status==='open').map(o=>o.id);
  const fresh=seenOpen&&open.some(id=>!seenOpen.has(id));
  seenOpen=new Set(open);
  const adminOn=!$('#admin').hidden;
  if(fresh&&adminOn){beep();toast('Nova narudžba s kioska');}
  if(adminOn&&A.tab==='orders'&&!document.querySelector('.overlay'))admOrders();
}
document.addEventListener('pointerdown',()=>{try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();}catch(e){}});
function beep(){if(!actx)return;try{[0,.18].forEach(t=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=988;g.gain.value=.18;o.connect(g);g.connect(actx.destination);o.start(actx.currentTime+t);o.stop(actx.currentTime+t+.12);});}catch(e){}}
function paintSync(){
  const p=$('#syncPill'); if(!p)return;
  const q=lsGet(QKEY,[]).length;
  if(!CLOUD){p.textContent='Demo · samo ovaj uređaj';p.className='pill alt';return;}
  if(q){p.textContent=`Bez veze · ${q} čeka slanje`;p.className='pill alt off';return;}
  if(menuDirty){p.textContent='Spremam…';p.className='pill alt';return;}
  p.textContent=LIVE?'Uživo':'Spajam se…'; p.className='pill alt'+(LIVE?' live':'');
}

/* ---------- screen saver (početni ekran) ---------- */
const NEON=`<svg class="neon" viewBox="0 0 600 520" role="img" aria-label="Burger, pommes i piće">
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
 <g class="n-cup">
  <path d="M96 196 L204 196 L190 404 Q150 414 110 404 Z" stroke="#DB1F26" stroke-width="7" fill="#121013"/>
  <path d="M88 176 Q150 162 212 176 L208 196 L92 196 Z" stroke="#DB1F26" stroke-width="7" fill="#121013"/>
  <path d="M152 170 L176 98 L214 90" stroke="#FFF200" stroke-width="7"/>
  <path d="M104 262 Q150 284 198 262" stroke="#FFF200" stroke-width="5"/>
  <path d="M106 290 Q150 312 196 290" stroke="#FFF200" stroke-width="5"/>
  <circle cx="132" cy="236" r="4" fill="#F2ECE3" stroke="none"/><circle cx="168" cy="344" r="3.5" fill="#F2ECE3" stroke="none"/><circle cx="148" cy="372" r="3" fill="#F2ECE3" stroke="none"/>
 </g>
 <g class="n-fries" stroke="#FFF200" stroke-width="7">
  <path d="M410 268 L414 186"/><path d="M430 268 L438 168"/><path d="M450 268 L452 150"/><path d="M470 268 L476 172"/><path d="M490 268 L494 190"/><path d="M440 268 L426 198"/><path d="M462 268 L466 182"/>
  <path d="M396 262 L508 262 L492 412 L412 412 Z" stroke="#DB1F26" fill="#121013"/>
  <path d="M424 318 Q452 342 480 318" stroke="#FFF200" stroke-width="6"/>
 </g>
 <g class="n-burger">
  <path d="M168 448 L432 448 Q440 486 404 492 L196 492 Q160 486 168 448 Z" stroke="#FFF200" stroke-width="7" fill="#121013"/>
  <rect x="160" y="400" width="280" height="44" rx="22" stroke="#DB1F26" stroke-width="7" fill="#121013"/>
  <path d="M166 392 L196 392 L208 414 L224 392 L376 392 L388 418 L402 392 L434 392" stroke="#FFF200" stroke-width="7" fill="none"/>
  <path d="M156 378 Q178 362 200 378 T244 378 T288 378 T332 378 T376 378 T420 378 T448 378" stroke="#F2ECE3" stroke-width="6" fill="none"/>
  <path d="M164 364 Q164 250 300 246 Q436 250 436 364 Z" stroke="#FFF200" stroke-width="7" fill="#121013"/>
  <g stroke="#F2ECE3" stroke-width="5"><path d="M236 298 l12 -4"/><path d="M290 280 l12 2"/><path d="M344 300 l12 4"/><path d="M262 330 l12 -2"/><path d="M322 326 l12 2"/><path d="M380 334 l10 4"/><path d="M212 336 l10 -4"/></g>
 </g>
</g></svg>`;
function saverItems(){
  const sv=C.settings.saver||{}, byId=id=>id&&itemById(id);
  const find=(...names)=>{for(const n of names){const i=C.items.find(x=>norm(x.name)===norm(n));if(i)return i;}return null;};
  return {main:byId(sv.main)||find('Country Burger','Classic Smash'),side:byId(sv.side)||find('Pommes frites','Pomfrit'),drink:byId(sv.drink)||find('Pepsi cola 0,5 l','Coca-Cola')};
}
function paintSaver(){
  const box=$('#saverArt'); if(!box)return;
  const sv=Object.assign({style:'hero'},C.settings.saver||{}), it=saverItems();
  const neon=()=>{box.className='saver-art';box.innerHTML=NEON;};
  if(sv.style==='hero'){
    box.className='saver-art hero';
    box.innerHTML=`<div class="halo"></div><div class="floor"></div>
      <img class="h-burger" src="img/saver/burger.webp" alt="Burger">
      <img class="h-pommes" src="img/saver/pommes.webp" alt="Pommes frites">
      <img class="h-pepsi" src="img/saver/pepsi.webp" alt="Pepsi">`;
    return;
  }
  if(sv.style!=='photo'||!it.main||!it.main.img){neon();return;}
  const ph=(x,cls)=>x&&x.img?`<div class="ph ${cls}"><img src="${esc(x.img)}" alt="${esc(x.name)}"></div>`:'';
  box.className='saver-art photos';
  box.innerHTML=ph(it.main,'ph-main')+ph(it.side,'ph-side')+ph(it.drink,'ph-drink');
  box.querySelectorAll('.ph img').forEach(img=>img.addEventListener('error',()=>{
    const ph=img.closest('.ph'); if(ph.classList.contains('ph-main'))neon(); else ph.remove();
  }));
}

/* =====================================================================
   CUSTOMER FLOW
   ===================================================================== */
let S={dine:'',cat:'',cart:[]};
let idleT=null,idleIv=null,doneT=null;

function brand(){
  document.querySelectorAll('.brand-sm').forEach(el=>{if(!el.querySelector('img'))el.innerHTML='<img src="img/kss-mark.svg" alt="KSS">';});
  paintSaver();
  const p=$('#promo'), t=String(C.settings.promo||'').trim(); p.hidden=!t;
  if(t){const m=t.match(/^(danas|novo|akcija)[:\s]+(.*)$/i);p.innerHTML=m?`<b>${esc(m[1])}</b><span>${esc(m[2])}</span>`:`<span>${esc(t)}</span>`;}
}
function go(id){
  document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==id); closeOverlay();
  if(id==='attract')brand();
  if(id==='menu')renderMenu(); if(id==='review')renderReview();
  if(id==='admin'){paintSync();renderAdmin();}
  armIdle(MODE==='kiosk'&&['menu','review','dine'].includes(id));
}
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)go(g.dataset.go);});

$('#attract').addEventListener('click',()=>go('dine'));
document.querySelectorAll('[data-dine]').forEach(b=>b.onclick=()=>{S.dine=b.dataset.dine;go('menu');});
const dineLabel=()=>S.dine||'Jedem ovdje';
$('#dineChip').onclick=()=>{S.dine=S.dine==='Za van'?'Jedem ovdje':'Za van';$('#dineChip').textContent=dineLabel();};
$('#cancelBtn').onclick=()=>{if(!S.cart.length){reset();return;}
  confirmBox('Poništiti narudžbu?','Svi artikli iz košarice bit će obrisani.','Poništi',reset,'Nastavi naručivati');};

const shown=i=>!i.hidden;
const inCat=(i,cid)=>i.cat===cid||(i.cats2||[]).includes(cid);
const shownCats=()=>C.cats.filter(c=>C.items.some(i=>inCat(i,c.id)&&shown(i)));
function renderMenu(){
  const vc=shownCats();
  if(!vc.some(c=>c.id===S.cat))S.cat=(vc[0]||{}).id;
  $('#dineChip').textContent=dineLabel();
  $('#rail').innerHTML=vc.map(c=>`<button class="cat ${c.id===S.cat?'on':''}" data-cat="${esc(c.id)}"><span class="e">${esc(c.e)}</span>${esc(c.name)}</button>`).join('');
  $('#rail').querySelectorAll('.cat').forEach(b=>b.onclick=()=>{S.cat=b.dataset.cat;renderMenu();$('#content').scrollTop=0;});
  const c=cat(S.cat); if(!c){$('#content').innerHTML='<p class="cat-sub">Meni je prazan.</p>';return;}
  const items=C.items.filter(i=>inCat(i,c.id)&&shown(i));
  $('#content').innerHTML=`<div class="cat-head"><h2>${esc(c.name).toUpperCase()}</h2><p class="cat-sub">${esc(c.sub)}</p></div><div class="grid">${items.map(i=>`
    <button class="item ${i.on?'':'off'}" data-id="${esc(i.id)}">
      ${art(i)}<div class="info">
      ${!i.on?'<span class="badge">Rasprodano</span>':i.badge?`<span class="badge">${esc(i.badge)}</span>`:''}
      <div class="nm">${esc(i.name)}</div><div class="ds">${esc(i.desc)}</div>
      <div class="foot"><span class="pr money">${eur(i.price)}</span><span class="plus" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></div>
      </div></button>`).join('')||'<p class="cat-sub">Nema artikala u ovoj kategoriji.</p>'}</div>`;
  $('#content').querySelectorAll('.item').forEach(b=>b.onclick=()=>openItem(b.dataset.id));
  updateBar();
}
const total=()=>S.cart.reduce((a,l)=>a+l.unit*l.qty,0);
function updateBar(){const n=S.cart.reduce((a,l)=>a+l.qty,0);
  $('#obCount').textContent=n?`Moja narudžba · ${n} ${n===1?'artikl':n<5?'artikla':'artikala'}`:'Košarica je prazna';
  $('#obTotal').textContent=eur(total()); $('#toReview').disabled=!n;}
$('#toReview').onclick=()=>go('review');

function openItem(id,editIdx){
  const it=itemById(id); if(!it)return; const gs=itemGroups(it);
  const prev=editIdx!=null?S.cart[editIdx]:null;
  const sel={}; gs.forEach(g=>{sel[g.id]=prev&&prev.sel[g.id]?[...prev.sel[g.id]]:(g.req&&g.opts.length?[0]:[]);});
  let qty=prev?prev.qty:1;
  const ov=overlay(`<div class="sheet" role="dialog" aria-label="${esc(it.name)}">
    <div class="sheet-head">${art(it)}<div><h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p></div><button class="x" data-close aria-label="Zatvori">✕</button></div>
    <div class="sheet-body">${gs.map(g=>`<div class="og" data-g="${esc(g.id)}"><h4>${esc(g.name)}${g.hint?`<small>${esc(g.hint)}</small>`:''}</h4><div class="opts">${g.opts.map((o,k)=>`<button class="opt" data-k="${k}"><span>${esc(o.n)}</span><span>${o.p?'+'+eur(o.p):''}</span></button>`).join('')}</div></div>`).join('')}</div>
    <div class="sheet-foot"><div class="qty"><button data-q="-1" aria-label="Manje">−</button><b id="sq">1</b><button data-q="1" aria-label="Više">+</button></div>
      <button class="btn" id="addBtn"><span>${prev?'Spremi promjene':'Dodaj u narudžbu'}</span><span class="money" id="sp"></span></button></div></div>`);
  const unit=()=>+it.price+gs.reduce((a,g)=>a+sel[g.id].reduce((b,k)=>b+(+(g.opts[k]||{}).p||0),0),0);
  const paint=()=>{ov.querySelectorAll('.og').forEach(og=>og.querySelectorAll('.opt').forEach(o=>o.classList.toggle('on',sel[og.dataset.g].includes(+o.dataset.k))));
    ov.querySelector('#sq').textContent=qty; ov.querySelector('#sp').textContent=eur(unit()*qty);};
  ov.querySelectorAll('.og').forEach(og=>og.addEventListener('click',e=>{const o=e.target.closest('.opt');if(!o)return;const g=grp(og.dataset.g),k=+o.dataset.k,cur=sel[g.id];
    if(g.type==='single'){sel[g.id]=(!g.req&&cur[0]===k)?[]:[k];}else sel[g.id]=cur.includes(k)?cur.filter(x=>x!==k):[...cur,k];paint();}));
  ov.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{qty=Math.max(1,Math.min(20,qty+ +b.dataset.q));paint();});
  ov.querySelector('#addBtn').onclick=()=>{
    const text=gs.flatMap(g=>sel[g.id].map(k=>(g.opts[k]||{}).n).filter(Boolean)).join(' · ');
    const line={id:it.id,sel,qty,unit:unit(),text};
    if(prev)S.cart[editIdx]=line;else S.cart.push(line);
    closeOverlay(); if($('#review').hidden){updateBar();toast(`${it.name} dodan u narudžbu`);}else renderReview();};
  paint();
}

function renderReview(){
  const L=S.cart;
  $('#revList').innerHTML=`<h2>VAŠA NARUDŽBA</h2>`+(L.length?L.map((l,i)=>{const it=itemById(l.id)||{name:'?',e:'?',id:'x'};return `
    <div class="line">${art(it)}
    <div class="mid"><b>${esc(it.name)}</b><small>${esc(l.text)||'&nbsp;'}</small>
      ${itemGroups(it).length?`<button class="edit-link" data-edit="${i}">Uredi</button>`:''}</div>
    <div class="qty"><button data-dq="${i}|-1" aria-label="Manje">${l.qty===1?'🗑':'−'}</button><b>${l.qty}</b><button data-dq="${i}|1" aria-label="Više">+</button></div>
    <div class="lp money">${eur(l.unit*l.qty)}</div></div>`}).join(''):`<div class="empty">Košarica je prazna.<br><br><button class="btn y" data-go="menu">Pogledaj meni</button></div>`);
  const inCart=new Set(L.map(l=>(itemById(l.id)||{}).cat));
  const pick=(c,n)=>inCart.has(c)?[]:C.items.filter(i=>inCat(i,c)&&i.on&&shown(i)).slice(0,n);
  const sug=[...pick('drink',3),...pick('fries',1),...pick('dessert',2)].slice(0,5);
  if(L.length&&sug.length)$('#revList').insertAdjacentHTML('beforeend',`<div class="upsell"><h3>Možda vam se svidi i…</h3><div class="up-row">${sug.map(i=>`<button class="up" data-up="${esc(i.id)}">${art(i)}<b>${esc(i.name)}</b><small class="money">+ ${eur(i.price)}</small></button>`).join('')}</div></div>`);
  const t=total(),v=+C.settings.vat||0,pdv=t-t/(1+v/100);
  $('#totals').innerHTML=L.length?`<div><span>Način</span><span>${esc(S.dine)}</span></div><div><span>Uključen PDV (${v}%)</span><span class="money">${eur(pdv)}</span></div><div class="grand"><span>UKUPNO</span><span class="money">${eur(t)}</span></div>`:'';
  $('#toPay').disabled=!L.length;
  $('#revList').querySelectorAll('[data-dq]').forEach(b=>b.onclick=()=>{const[i,d]=b.dataset.dq.split('|').map(Number);S.cart[i].qty+=d;if(S.cart[i].qty<1)S.cart.splice(i,1);renderReview();});
  $('#revList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openItem(S.cart[+b.dataset.edit].id,+b.dataset.edit));
  $('#revList').querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>openItem(b.dataset.up));
}

let sending=false;
$('#toPay').onclick=async()=>{
  if(!S.cart.length||sending)return; sending=true; $('#toPay').disabled=true;
  const t=total();
  const order={id:(crypto.randomUUID?crypto.randomUUID():uid('o')),ts:Date.now(),dine:S.dine,total:Math.round(t*100)/100,status:'open',
    lines:S.cart.map(l=>{const it=itemById(l.id)||{name:'?'};return {name:it.name,text:l.text,qty:l.qty,unit:l.unit};})};
  go('done');
  $('#orderNum').textContent='…'; $('#doneDine').textContent=S.dine.toUpperCase()+' · ZA PLATITI '+eur(t);
  $('#doneTitle').textContent='Šaljem narudžbu…'; $('#doneNote').textContent=''; $('#newOrder').hidden=true;
  let no; try{no=await submitOrder(order);}finally{sending=false;}
  $('#orderNum').textContent=no;
  $('#doneTitle').textContent='Narudžba je zaprimljena.';
  $('#doneNote').textContent='Pođite na blagajnu, recite broj narudžbe i platite. Fiskalni račun dobivate na blagajni, a hranu pripremamo čim platite.';
  $('#newOrder').hidden=false;
  S.cart=[]; clearTimeout(doneT); doneT=setTimeout(reset,20000);
};
$('#newOrder').onclick=reset;
function reset(){clearTimeout(doneT);S.cart=[];S.dine='';S.cat='';go(MODE==='kiosk'?'attract':MODE==='blagajna'?'lock':'admin');}

/* ---------- overlays ---------- */
function overlay(html,mid){closeOverlay();const o=document.createElement('div');o.className='overlay'+(mid?' mid':'');o.innerHTML=html;
  o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close]'))closeOverlay();});$('#app').appendChild(o);return o;}
function closeOverlay(){document.querySelectorAll('.overlay').forEach(o=>o.remove());}
function modal(html,cb){const o=overlay(`<div class="modal">${html}</div>`,true);o.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{closeOverlay();cb&&cb(b.dataset.m);});return o;}
function confirmBox(title,text,yes,onYes,no='Odustani'){modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn light" data-m="no">${esc(no)}</button><button class="btn" data-m="yes">${esc(yes)}</button></div>`,m=>{if(m==='yes')onYes();});}
function toast(t,bad){document.querySelectorAll('.toast').forEach(x=>x.remove());const d=document.createElement('div');d.className='toast'+(bad?' bad':'');d.textContent=(bad?'':'✓ ')+t;$('#app').appendChild(d);setTimeout(()=>d.remove(),bad?3500:1600);}

/* ---------- idle ---------- */
function armIdle(on){clearTimeout(idleT);clearInterval(idleIv);if(on)idleT=setTimeout(idleWarn,(+C.settings.idle||60)*1000);}
function idleWarn(){let n=15;
  modal(`<h3>Trebate li još vremena?</h3><p>Narudžba će se poništiti za <b id="idleN">${n}</b> s.</p><div class="row"><button class="btn y" data-m="stay">Da, nastavljam</button></div>`,()=>armIdle(true));
  idleIv=setInterval(()=>{n--;const el=document.getElementById('idleN');if(el)el.textContent=n;if(n<=0){clearInterval(idleIv);reset();}},1000);}
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,()=>{const s=[...document.querySelectorAll('.screen')].find(x=>!x.hidden);
  if(MODE==='kiosk'&&s&&['menu','review','dine'].includes(s.id)&&!document.getElementById('idleN'))armIdle(true);},true));

/* ---------- staff access ---------- */
let taps=[];
$('#logoTap').onclick=()=>{const now=Date.now();taps=taps.filter(t=>now-t<2500);taps.push(now);if(taps.length>=5){taps=[];askPin();}};
function askPin(){let v='';const len=String(C.settings.pin).length;
  const o=modal(`<h3>Osoblje</h3><p>Unesite PIN</p><div class="pin-dots" id="dots">${'<i></i>'.repeat(len)}</div><div class="err" id="perr"></div>
    <div class="pad">${[1,2,3,4,5,6,7,8,9,'✕',0,'⌫'].map(k=>`<button data-k="${k}">${k}</button>`).join('')}</div>`);
  const paint=()=>o.querySelectorAll('#dots i').forEach((d,i)=>d.classList.toggle('f',i<v.length));
  o.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{const k=b.dataset.k;
    if(k==='✕'){closeOverlay();return;} if(k==='⌫')v=v.slice(0,-1);else if(v.length<len)v+=k;paint();
    if(v.length===len){if(v===String(C.settings.pin)){closeOverlay();if(MODE!=='kiosk')A.tab='orders';go('admin');}else{o.querySelector('#perr').textContent='Pogrešan PIN';v='';setTimeout(paint,200);}}});
}
$('#unlockBtn').onclick=()=>askPin();

/* =====================================================================
   ADMIN
   ===================================================================== */
let A={tab:MODE==='kiosk'?'items':'orders',filter:'all',of:'open'};
document.querySelectorAll('[data-tab]').forEach(t=>t.onclick=()=>{A.tab=t.dataset.tab;A.multi=false;A.sort=false;if(A.sel)A.sel.clear();renderAdmin();$('#admBody').scrollTop=0;});
$('#admExit').onclick=()=>{S.cart=[];if(MODE==='blagajna'){go('lock');return;}if(MODE==='admin')return;toast('Promjene spremljene');go('attract');};

function renderAdmin(){
  document.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('on',t.dataset.tab===A.tab));
  ({orders:admOrders,items:admItems,cats:admCats,groups:admGroups,settings:admSettings})[A.tab]();
}
function bindInputs(root,getObj,after){
  root.querySelectorAll('[data-k]').forEach(inp=>{
    const ev=inp.type==='checkbox'||inp.tagName==='SELECT'?'change':'input';
    inp.addEventListener(ev,()=>{const o=getObj(inp);if(!o)return;const k=inp.dataset.k;
      o[k]=inp.type==='checkbox'?inp.checked:inp.type==='number'?Math.max(0,parseFloat(String(inp.value).replace(',','.'))||0):inp.value;
      save();after&&after(inp);});
  });
}

/* ---- Orders ---- */
function admOrders(){
  const w=$('#admWrap'),O=loadOrders(),d0=today();
  const list=O.filter(o=>A.of==='all'||o.status===A.of);
  const cnt=s=>O.filter(o=>o.status===s).length;
  const tm=ts=>new Date(ts).toLocaleTimeString('hr-HR',{hour:'2-digit',minute:'2-digit'});
  const lbl={open:'Čeka naplatu',paid:'Naplaćeno',void:'Poništeno'};
  const paidToday=O.filter(o=>o.status==='paid'&&new Date(o.ts).toLocaleDateString('sv')===d0);
  w.innerHTML=`<div class="adm-head"><div><h2>NARUDŽBE</h2><p class="adm-note">Narudžbe s kioska za prekucavanje u Pelion. Kad naplatite i izdate račun u Pelionu, označite narudžbu kao naplaćenu. Danas naplaćeno: ${paidToday.length} narudžbi, ${eur(paidToday.reduce((a,o)=>a+o.total,0))}.</p></div></div>
  <div class="chips">${['open','paid','void','all'].map(s=>`<button class="chip ${A.of===s?'on':''}" data-of="${s}">${s==='all'?'Sve':lbl[s]} (${s==='all'?O.length:cnt(s)})</button>`).join('')}</div>
  <div class="ogrid">${list.map(o=>`<div class="ord ${esc(o.status)}" data-id="${esc(o.id)}">
    <div class="ord-top"><b class="money">${esc(o.no)}</b><span>${tm(o.ts)} · ${esc(o.dine)}</span>${o.no>=900?'<span class="st offl">bez veze</span>':''}<span class="st ${o.status==='open'?'wait':''}">${lbl[o.status]||esc(o.status)}</span></div>
    <ul>${(o.lines||[]).map(l=>`<li><span class="oq">${esc(l.qty)}×</span><span class="n"><b>${esc(l.name)}</b>${l.text?`<small>${esc(l.text)}</small>`:''}</span><span class="money">${eur(l.unit*l.qty)}</span></li>`).join('')}</ul>
    <div class="ord-foot"><b class="money">${eur(o.total)}</b>${o.status==='open'?`<button class="btn light sm" data-act="void">Poništi</button><button class="btn sm" data-act="paid">Naplaćeno</button>`:`<button class="btn light sm" data-act="open">Vrati u čekanje</button>`}</div></div>`).join('')||'<p class="adm-note">Nema narudžbi u ovom popisu. Nove narudžbe s kioska pojavljuju se ovdje.</p>'}</div>`;
  w.querySelectorAll('[data-of]').forEach(b=>b.onclick=()=>{A.of=b.dataset.of;admOrders();});
  w.querySelectorAll('.ord [data-act]').forEach(b=>b.onclick=()=>{const id=b.closest('.ord').dataset.id,act=b.dataset.act;
    const apply=()=>setOrderStatus(id,act);
    if(act==='void')confirmBox('Poništiti narudžbu?','Narudžba neće biti naplaćena ni pripremljena.','Poništi',apply);else apply();});
}

/* ---- Items ---- */
const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');
function itemsInView(){
  const q=norm(A.q).trim();
  return C.items.filter(i=>(A.filter==='all'||(A.filter==='hidden'?i.hidden:inCat(i,A.filter)))&&(!q||norm(i.name).includes(q)||norm(i.desc).includes(q)));
}
function admItems(){
  const w=$('#admWrap');
  if(!A.sel)A.sel=new Set();
  const noPhoto=C.items.filter(i=>!i.img).length, nHidden=C.items.filter(i=>i.hidden).length;
  const oneCat=A.filter!=='all'&&A.filter!=='hidden';
  if(A.sort&&!oneCat)A.sort=false;
  w.innerHTML=`<div class="adm-head"><div><h2>ARTIKLI</h2><p class="adm-note">Dodirnite artikl za uređivanje. ${CLOUD?'Promjene se odmah šalju na sve uređaje lokala.':''} ${noPhoto?`${noPhoto} artikala još nema fotografiju.`:''}</p></div>
    <button class="btn y sm" id="addItem">+ Novi artikl</button></div>
    <div class="toolbar">
      <label class="search"><svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="inp" id="itemQ" type="search" placeholder="Traži po nazivu…" value="${esc(A.q||'')}" autocomplete="off" aria-label="Traži artikle"></label>
      <button class="btn ${A.multi?'y':'ghost'} sm" id="multiBtn">${A.multi?'Gotovo s odabirom':'Odaberi više'}</button>
      <button class="btn ${A.sort?'y':'ghost'} sm" id="sortBtn" ${oneCat?'':'disabled title="Najprije odaberite kategoriju"'}>${A.sort?'Gotovo s rasporedom':'Promijeni raspored'}</button>
    </div>
    <div class="chips"><button class="chip ${A.filter==='all'?'on':''}" data-f="all">Sve (${C.items.length})</button>${nHidden?`<button class="chip ${A.filter==='hidden'?'on':''}" data-f="hidden">Nije na jelovniku (${nHidden})</button>`:''}${C.cats.map(c=>`<button class="chip ${A.filter===c.id?'on':''}" data-f="${esc(c.id)}">${esc(c.e)} ${esc(c.name)} (${C.items.filter(i=>inCat(i,c.id)).length})</button>`).join('')}</div>
    ${A.sort?`<p class="adm-note">Povucite artikl za ručku ili koristite strelice. Ovim redoslijedom artikli se prikazuju na kiosku u kategoriji „${esc((cat(A.filter)||{}).name)}”.</p>`:''}
    <div id="itemGrid"></div>
    <div class="selbar" id="selBar" hidden></div>`;
  w.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{A.filter=c.dataset.f;admItems();});
  const qi=$('#itemQ'); qi.oninput=()=>{A.q=qi.value;renderItemGrid();};
  $('#multiBtn').onclick=()=>{A.multi=!A.multi;A.sort=false;A.sel.clear();admItems();};
  $('#sortBtn').onclick=()=>{A.sort=!A.sort;A.multi=false;A.sel.clear();if(A.sort)A.q='';admItems();};
  $('#addItem').onclick=()=>{
    if(!C.cats.length){toast('Najprije dodajte kategoriju.',true);return;}
    const cid=oneCat?A.filter:C.cats[0].id;
    editItem(null,{id:uid('i'),cat:cid,cats2:[],e:cat(cid).e,name:'',desc:'',price:0,badge:'',on:true,img:'',groups:[...cat(cid).groups]});
  };
  renderItemGrid();
}
function itemArt(i){return `<div class="art" style="background:${tint(i.id)}">${esc(i.e)}${i.img?`<img src="${esc(i.img)}" alt="" loading="lazy" onerror="this.remove()">`:'<span class="nophoto">BEZ FOTO</span>'}</div>`;}
function itemStatus(i){return i.hidden?'<span class="st">Nije na jelovniku</span>':i.on?'':'<span class="st no">Rasprodano</span>';}
function itemCats(i){const sec=(i.cats2||[]).map(id=>(cat(id)||{}).name).filter(Boolean);return esc((cat(i.cat)||{name:'—'}).name)+(sec.length?` <small>+ ${esc(sec.join(', '))}</small>`:'');}
function renderItemGrid(){
  const g=$('#itemGrid'); if(!g)return;
  const list=itemsInView();
  if(A.sort){
    g.innerHTML=`<div class="sortlist" id="sortList">${list.map((i,k)=>`<div class="srow" data-id="${esc(i.id)}">
      <button class="handle" aria-label="Povuci za premještanje"><svg class="ico-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
      <span class="spos money">${k+1}</span>${itemArt(i)}<span class="sname"><b>${esc(i.name)}</b>${itemStatus(i)}</span>
      <span class="money sprice">${eur(i.price)}</span>
      <button class="ic" data-mv="top" aria-label="Na vrh" ${k===0?'disabled':''}>⤒</button><button class="ic" data-mv="-1" aria-label="Gore" ${k===0?'disabled':''}>↑</button><button class="ic" data-mv="1" aria-label="Dolje" ${k===list.length-1?'disabled':''}>↓</button></div>`).join('')||'<p class="adm-note">Nema artikala u ovoj kategoriji.</p>'}</div>`;
    g.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{
      const ids=list.map(i=>i.id), id=b.closest('.srow').dataset.id, k=ids.indexOf(id);
      ids.splice(k,1); const to=b.dataset.mv==='top'?0:k+ +b.dataset.mv; ids.splice(to,0,id);
      applyOrder(ids,list); renderItemGrid();});
    enableDrag(g.querySelector('#sortList'),list);
    paintSelBar(); return;
  }
  g.innerHTML=`<div class="agrid">${list.map(i=>`<button class="acard ${i.on?'':'off'} ${A.multi?'pick':''} ${A.sel.has(i.id)?'sel':''}" data-id="${esc(i.id)}" ${A.multi?`aria-pressed="${A.sel.has(i.id)}"`:''}>
      ${A.multi?'<span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span>':''}
      ${itemArt(i)}
      <div class="meta"><b>${esc(i.name)}</b><span><span class="cats">${itemCats(i)}</span><span class="money">${eur(i.price)}</span></span>
      ${itemStatus(i)?`<span>${itemStatus(i)}</span>`:''}</div></button>`).join('')||`<p class="adm-note">${A.q?`Nema artikala koji odgovaraju pretrazi „${esc(A.q)}”.`:'Nema artikala.'}</p>`}</div>`;
  g.querySelectorAll('.acard').forEach(c=>c.onclick=()=>{
    if(!A.multi){editItem(c.dataset.id);return;}
    const id=c.dataset.id; if(A.sel.has(id))A.sel.delete(id);else A.sel.add(id);
    c.classList.toggle('sel',A.sel.has(id)); c.setAttribute('aria-pressed',A.sel.has(id)); paintSelBar();});
  paintSelBar();
}
/* order: the subset in view gets the new order inside the slots it already occupies in C.items */
function applyOrder(ids,list){
  const set=new Set(list.map(i=>i.id)); const slots=[]; C.items.forEach((it,k)=>{if(set.has(it.id))slots.push(k);});
  const byId=Object.fromEntries(list.map(i=>[i.id,i])); const next=C.items.slice();
  slots.forEach((slot,k)=>{next[slot]=byId[ids[k]];}); C.items=next; save();
}
function enableDrag(box,list){
  if(!box)return;
  box.querySelectorAll('.handle').forEach(h=>h.addEventListener('pointerdown',e=>{
    e.preventDefault(); const row=h.closest('.srow'); h.setPointerCapture(e.pointerId);
    row.classList.add('drag'); let lastY=e.clientY;
    const move=ev=>{
      const dy=ev.clientY-lastY; row.style.transform=`translateY(${dy}px)`;
      const rows=[...box.querySelectorAll('.srow')], r=row.getBoundingClientRect(), mid=r.top+r.height/2;
      const prev=row.previousElementSibling, next=row.nextElementSibling;
      if(prev&&mid<prev.getBoundingClientRect().top+prev.offsetHeight/2){box.insertBefore(prev,row.nextSibling);lastY=ev.clientY;row.style.transform='';}
      else if(next&&mid>next.getBoundingClientRect().top+next.offsetHeight/2){box.insertBefore(next,row);lastY=ev.clientY;row.style.transform='';}
      const sc=$('#admBody'),br=sc.getBoundingClientRect(); if(ev.clientY<br.top+60)sc.scrollTop-=12; else if(ev.clientY>br.bottom-60)sc.scrollTop+=12;
    };
    const up=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);
      row.classList.remove('drag');row.style.transform='';
      applyOrder([...box.querySelectorAll('.srow')].map(r=>r.dataset.id),list); renderItemGrid();};
    h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
  }));
}
function paintSelBar(){
  const b=$('#selBar'); if(!b)return;
  if(!A.multi){b.hidden=true;return;}
  const n=A.sel.size, vis=itemsInView();
  b.hidden=false;
  b.innerHTML=`<b class="money">${n} odabrano</b>
    <button class="btn ghost sm" data-b="all">${vis.length&&vis.every(i=>A.sel.has(i.id))?'Poništi odabir':`Označi sve prikazane (${vis.length})`}</button>
    <span class="sp"></span>
    <button class="btn sm" data-b="cat" ${n?'':'disabled'}>Kategorija</button>
    <button class="btn sm" data-b="cat2" ${n?'':'disabled'}>Sekundarna kategorija</button>
    <button class="btn sm" data-b="opts" ${n?'':'disabled'}>Opcije</button>
    <button class="btn sm" data-b="vis" ${n?'':'disabled'}>Jelovnik i dostupnost</button>
    <button class="btn ghost sm del" data-b="del" ${n?'':'disabled'}>Obriši</button>`;
  b.querySelector('[data-b="all"]').onclick=()=>{if(vis.every(i=>A.sel.has(i.id)))vis.forEach(i=>A.sel.delete(i.id));else vis.forEach(i=>A.sel.add(i.id));renderItemGrid();};
  b.querySelectorAll('[data-b]').forEach(x=>{if(x.dataset.b!=='all')x.onclick=()=>bulk(x.dataset.b);});
}
function bulkDone(msg){save();closeOverlay();toast(msg);renderItemGrid();}
function bulkSheet(title,body){return overlay(`<div class="modal bulk"><h3>${esc(title)}</h3><p>${A.sel.size} odabranih artikala</p>${body}</div>`,true);}
function bulk(kind){
  const sel=C.items.filter(i=>A.sel.has(i.id)), n=sel.length; if(!n)return;
  const catOpts=C.cats.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if(kind==='cat'){
    const o=bulkSheet('Glavna kategorija',`<label class="f"><span>Premjesti u kategoriju</span><select class="inp" id="bkCat">${catOpts}</select></label>
      <label class="chk"><input type="checkbox" id="bkCatG"> Postavi i zadane opcije te kategorije</label>
      <div class="row"><button class="btn light" data-close>Odustani</button><button class="btn" id="bkGo">Premjesti</button></div>`);
    o.querySelector('#bkGo').onclick=()=>{const cid=o.querySelector('#bkCat').value,g=o.querySelector('#bkCatG').checked;
      sel.forEach(i=>{i.cat=cid;i.cats2=(i.cats2||[]).filter(x=>x!==cid);if(g)i.groups=[...cat(cid).groups];});bulkDone(`${n} artikala premješteno u „${cat(cid).name}”`);};
  }
  if(kind==='cat2'){
    const o=bulkSheet('Sekundarna kategorija',`<p class="adm-note" style="margin:0">Artikl se uz svoju glavnu kategoriju prikazuje i u ovoj.</p><label class="f"><span>Kategorija</span><select class="inp" id="bkCat">${catOpts}</select></label>
      <div class="row"><button class="btn light" data-close>Odustani</button><button class="btn light" id="bkRm">Ukloni iz nje</button><button class="btn" id="bkAdd">Dodaj u nju</button></div>`);
    o.querySelector('#bkAdd').onclick=()=>{const cid=o.querySelector('#bkCat').value;sel.forEach(i=>{if(i.cat!==cid&&!(i.cats2||[]).includes(cid))i.cats2=[...(i.cats2||[]),cid];});bulkDone(`Dodano u „${cat(cid).name}”`);};
    o.querySelector('#bkRm').onclick=()=>{const cid=o.querySelector('#bkCat').value;sel.forEach(i=>{i.cats2=(i.cats2||[]).filter(x=>x!==cid);});bulkDone(`Uklonjeno iz „${cat(cid).name}”`);};
  }
  if(kind==='opts'){
    const st={}; C.groups.forEach(g=>{const has=sel.filter(i=>(i.groups||[]).includes(g.id)).length;st[g.id]=has===n?'all':has?'some':'none';});
    const lbl={all:'imaju svi',some:'imaju neki',none:'nema nitko'};
    const o=bulkSheet('Opcije',`<div class="bgrid">${C.groups.map(g=>`<div class="brow" data-g="${esc(g.id)}"><span><b>${esc(g.name)}</b><small>${lbl[st[g.id]]}</small></span>
      <div class="seg"><button data-v="keep" class="on">Ne mijenjaj</button><button data-v="add">Dodaj</button><button data-v="rm">Ukloni</button></div></div>`).join('')||'<p class="adm-note">Nema grupa opcija.</p>'}</div>
      <div class="row"><button class="btn light" data-close>Odustani</button><button class="btn" id="bkGo">Primijeni</button></div>`);
    o.querySelectorAll('.seg').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{sg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));}));
    o.querySelector('#bkGo').onclick=()=>{
      const ch={}; o.querySelectorAll('.brow').forEach(r=>{ch[r.dataset.g]=r.querySelector('.seg .on').dataset.v;});
      sel.forEach(i=>{let gs=new Set(i.groups||[]);Object.entries(ch).forEach(([g,v])=>{if(v==='add')gs.add(g);if(v==='rm')gs.delete(g);});i.groups=C.groups.map(g=>g.id).filter(g=>gs.has(g));});
      bulkDone(`Opcije promijenjene na ${n} artikala`);};
  }
  if(kind==='vis'){
    const o=bulkSheet('Jelovnik i dostupnost',`<div class="bgrid">
      <div class="brow"><span><b>Na jelovniku</b><small>vidi li ih kupac</small></span><div class="seg" id="sgV"><button data-v="keep" class="on">Ne mijenjaj</button><button data-v="show">Prikaži</button><button data-v="hide">Sakrij</button></div></div>
      <div class="brow"><span><b>Dostupnost</b><small>rasprodano se prikazuje sivo</small></span><div class="seg" id="sgO"><button data-v="keep" class="on">Ne mijenjaj</button><button data-v="on">Dostupno</button><button data-v="off">Rasprodano</button></div></div></div>
      <div class="row"><button class="btn light" data-close>Odustani</button><button class="btn" id="bkGo">Primijeni</button></div>`);
    o.querySelectorAll('.seg').forEach(sg=>sg.querySelectorAll('button').forEach(b=>b.onclick=()=>{sg.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));}));
    o.querySelector('#bkGo').onclick=()=>{const v=o.querySelector('#sgV .on').dataset.v,a=o.querySelector('#sgO .on').dataset.v;
      sel.forEach(i=>{if(v!=='keep')i.hidden=v==='hide';if(a!=='keep')i.on=a==='on';});bulkDone(`Promijenjeno ${n} artikala`);};
  }
  if(kind==='del'){
    confirmBox(`Obrisati ${n} artikala?`,'Artikli će nestati s menija. Ovo se ne može poništiti.','Obriši',()=>{C.items=C.items.filter(i=>!A.sel.has(i.id));A.sel.clear();save();toast(`Obrisano ${n} artikala`);admItems();});
  }
}
function compress(file){return new Promise((res,rej)=>{
  if(!file||!/^image\//.test(file.type)){rej(new Error('type'));return;}
  const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{
    const max=720,s=Math.min(1,max/Math.max(im.width,im.height));const cv=document.createElement('canvas');
    cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);const x=cv.getContext('2d');
    x.fillStyle='#ffffff';x.fillRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height);
    res(cv.toDataURL('image/jpeg',0.82));};im.src=fr.result;};fr.readAsDataURL(file);});}

function editItem(id,fresh){
  const isNew=!!fresh; const src=fresh||itemById(id); if(!src)return; const d=JSON.parse(JSON.stringify(src));
  const ov=overlay(`<div class="ed" role="dialog" aria-label="Uredi artikl">
    <div class="ed-head"><h3>${isNew?'NOVI ARTIKL':'UREDI ARTIKL'}</h3><button class="x" data-close aria-label="Zatvori">✕</button></div>
    <div class="ed-body">
      <div class="photo">
        <div class="art" id="edArt"></div>
        <div class="row">
          <label class="btn y sm" for="edFile" id="edUpLbl">Dodaj fotografiju</label>
          <button class="btn light sm" id="edRm" hidden>Ukloni</button>
        </div>
        <input type="file" id="edFile" accept="image/*">
        <small id="edPhotoNote">Najbolje izgleda kvadratna fotografija hrane na neutralnoj pozadini. Slika se automatski smanjuje prije spremanja.</small>
        <label class="f"><span>Sličica ako nema fotografije</span><input class="inp emo" id="edE" value="${esc(d.e)}" maxlength="4"></label>
      </div>
      <div class="ed-fields">
        <label class="f"><span>Naziv</span><input class="inp" id="edName" value="${esc(d.name)}" placeholder="npr. Classic Smash"></label>
        <label class="f"><span>Opis</span><input class="inp" id="edDesc" value="${esc(d.desc)}" placeholder="Sastojci ili kratki opis"></label>
        <div class="ed-row">
          <label class="f"><span>Cijena (€)</span><input class="inp" id="edPrice" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(d.price)}"></label>
          <label class="f"><span>Kategorija</span><select class="inp" id="edCat">${C.cats.map(c=>`<option value="${esc(c.id)}" ${c.id===d.cat?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label class="f"><span>Oznaka</span><input class="inp" id="edBadge" value="${esc(d.badge)}" placeholder="npr. Novo, Ljuto" list="badges"></label>
        </div>
        <div class="f"><span>Prikaži i u kategorijama (sekundarne)</span><div class="chips" id="edCats2"></div></div>
        <datalist id="badges"><option>Najprodavanije</option><option>Novo</option><option>Ljuto</option><option>Veggie</option><option>18+</option><option>Akcija</option></datalist>
        <label class="chk"><input type="checkbox" id="edShow" ${d.hidden?'':'checked'}> Prikaži na jelovniku</label>
        <label class="chk"><input type="checkbox" id="edOn" ${d.on?'checked':''}> Dostupno za narudžbu (isključite kad je rasprodano)</label>
        <div class="f"><span>Opcije koje kupac bira</span><div class="gpick" id="edGroups"></div></div>
      </div>
    </div>
    <div class="ed-foot">${isNew?'':'<button class="btn light sm del" id="edDel">Obriši artikl</button>'}
      ${isNew?'':'<button class="btn light sm" id="edDup">Kopiraj</button>'}<span class="sp"></span>
      <button class="btn light sm" data-close>Odustani</button><button class="btn sm" id="edSave">Spremi</button></div>
  </div>`);
  const q=s=>ov.querySelector(s);
  const paintArt=()=>{q('#edArt').style.background=tint(d.id);q('#edArt').className='art'+(d.img?' has':'');
    q('#edArt').innerHTML=d.img?`<img src="${esc(d.img)}" alt="">`:esc(d.e||'🍽️');q('#edRm').hidden=!d.img;q('#edUpLbl').textContent=d.img?'Zamijeni fotografiju':'Dodaj fotografiju';};
  const paintGroups=()=>{q('#edGroups').innerHTML=C.groups.length?C.groups.map(g=>`<button class="gp ${d.groups.includes(g.id)?'on':''}" data-g="${esc(g.id)}">${esc(g.name)}<small>${g.opts.length} opcija · ${g.type==='multi'?'više izbora':'jedan izbor'}</small></button>`).join(''):'<small style="color:var(--muted)">Nema grupa opcija. Dodajte ih u kartici „Opcije i dodaci”.</small>';
    q('#edGroups').querySelectorAll('.gp').forEach(b=>b.onclick=()=>{const g=b.dataset.g;d.groups=d.groups.includes(g)?d.groups.filter(x=>x!==g):C.groups.map(x=>x.id).filter(x=>d.groups.includes(x)||x===g);paintGroups();});};
  d.cats2=(d.cats2||[]).filter(x=>x!==d.cat&&cat(x));
  const paintCats2=()=>{q('#edCats2').innerHTML=C.cats.filter(c=>c.id!==d.cat).map(c=>`<button class="chip ${d.cats2.includes(c.id)?'on':''}" data-c="${esc(c.id)}">${esc(c.e)} ${esc(c.name)}</button>`).join('');
    q('#edCats2').querySelectorAll('.chip').forEach(b=>b.onclick=()=>{const id=b.dataset.c;d.cats2=d.cats2.includes(id)?d.cats2.filter(x=>x!==id):[...d.cats2,id];paintCats2();});};
  paintArt();paintGroups();paintCats2();
  let uploading=false;
  q('#edFile').onchange=async e=>{const f=e.target.files[0];if(!f)return; e.target.value='';
    let dataUrl; try{dataUrl=await compress(f);}catch(err){toast('Datoteka nije slika. Odaberite JPG ili PNG.',true);return;}
    if(!CLOUD){d.img=dataUrl;paintArt();return;}
    uploading=true; q('#edSave').classList.add('uploading'); q('#edPhotoNote').textContent='Šaljem fotografiju…'; d.img=dataUrl; paintArt();
    try{d.img=await Cloud.uploadPhoto(dataUrl,d.id);q('#edPhotoNote').textContent='Fotografija je spremljena.';}
    catch(err){d.img=src.img||'';paintArt();const m=String((err&&err.message)||err||'');q('#edPhotoNote').textContent=/security|policy|unauthor|403|bucket/i.test(m)?'Fotografija nije spremljena: baza ne dopušta upload. Pokrenite fix-fotografije.sql u Supabaseu. ('+m+')':'Fotografija nije poslana. Provjerite internetsku vezu i pokušajte ponovno. ('+m+')';}
    finally{uploading=false;q('#edSave').classList.remove('uploading');}
  };
  q('#edRm').onclick=()=>{d.img='';paintArt();};
  q('#edE').oninput=e=>{d.e=e.target.value;paintArt();};
  q('#edCat').onchange=e=>{d.cat=e.target.value; d.cats2=d.cats2.filter(x=>x!==d.cat); if(isNew||!d.groups.length)d.groups=[...cat(d.cat).groups];paintGroups();paintCats2();};
  q('#edSave').onclick=()=>{
    if(uploading)return;
    d.name=q('#edName').value.trim(); d.desc=q('#edDesc').value.trim(); d.badge=q('#edBadge').value.trim();
    d.price=Math.max(0,parseFloat(String(q('#edPrice').value).replace(',','.'))||0); d.on=q('#edOn').checked; d.hidden=!q('#edShow').checked;
    if(!d.name){q('#edName').focus();toast('Upišite naziv artikla.',true);return;}
    const backup=JSON.stringify(C.items);
    if(isNew)C.items.push(d);else C.items[C.items.findIndex(i=>i.id===d.id)]=d;
    if(!save()){C.items=JSON.parse(backup);return;}
    closeOverlay();toast(isNew?'Artikl dodan':'Artikl spremljen');admItems();};
  if(!isNew){
    q('#edDel').onclick=()=>confirmBox(`Obrisati „${d.name}”?`,'Artikl će nestati s menija. Ovo se ne može poništiti.','Obriši',()=>{C.items=C.items.filter(i=>i.id!==d.id);save();admItems();toast('Artikl obrisan');});
    q('#edDup').onclick=()=>{closeOverlay();editItem(null,{...d,id:uid('i'),name:d.name+' (kopija)'});};
  }
}

/* ---- Categories ---- */
function admCats(){
  const w=$('#admWrap');
  w.innerHTML=`<div class="adm-head"><div><h2>KATEGORIJE</h2><p class="adm-note">Redoslijed ovdje je redoslijed na kiosku. Zadane opcije automatski se dodjeljuju novim artiklima u kategoriji.</p></div>
    <button class="btn y sm" id="addCat">+ Nova kategorija</button></div>`+
  C.cats.map((c,i)=>{const n=C.items.filter(x=>x.cat===c.id).length;return `<div class="panel" data-id="${esc(c.id)}">
    <div class="panel-top">
      <input class="inp emo" data-k="e" value="${esc(c.e)}" maxlength="4" aria-label="Sličica">
      <label class="f grow"><span>Naziv</span><input class="inp" data-k="name" value="${esc(c.name)}"></label>
      <button class="ic" data-mv="-1" ${i===0?'disabled':''} aria-label="Gore">↑</button>
      <button class="ic" data-mv="1" ${i===C.cats.length-1?'disabled':''} aria-label="Dolje">↓</button>
      <button class="ic red" data-del aria-label="Obriši">✕</button>
    </div>
    <label class="f"><span>Podnaslov na kiosku</span><input class="inp" data-k="sub" value="${esc(c.sub)}"></label>
    <div class="f"><span>Zadane opcije za nove artikle · ${n} artikala u kategoriji</span><div class="chips">${C.groups.map(g=>`<button class="chip ${c.groups.includes(g.id)?'on':''}" data-g="${esc(g.id)}">${esc(g.name)}</button>`).join('')}</div></div>
    ${n?`<button class="btn ghost sm" data-apply style="align-self:flex-start">Primijeni zadane opcije na svih ${n} artikala</button>`:''}
  </div>`}).join('');
  bindInputs(w,inp=>cat(inp.closest('.panel').dataset.id));
  w.querySelectorAll('.panel').forEach(p=>{const c=cat(p.dataset.id);
    p.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{const i=C.cats.indexOf(c),j=i+ +b.dataset.mv;[C.cats[i],C.cats[j]]=[C.cats[j],C.cats[i]];save();admCats();});
    p.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const g=b.dataset.g;c.groups=c.groups.includes(g)?c.groups.filter(x=>x!==g):C.groups.map(x=>x.id).filter(x=>c.groups.includes(x)||x===g);save();admCats();});
    const ap=p.querySelector('[data-apply]');if(ap)ap.onclick=()=>confirmBox('Primijeniti opcije?',`Svi artikli u kategoriji „${c.name}” dobit će iste opcije.`,'Primijeni',()=>{C.items.filter(i=>i.cat===c.id).forEach(i=>i.groups=[...c.groups]);save();toast('Opcije primijenjene');});
    p.querySelector('[data-del]').onclick=()=>{const n=C.items.filter(x=>x.cat===c.id).length;
      if(n){toast(`Kategorija ima ${n} artikala. Premjestite ili obrišite ih prije brisanja.`,true);return;}
      confirmBox(`Obrisati „${c.name}”?`,'Kategorija nema svojih artikala i bit će uklonjena s kioska.','Obriši',()=>{C.cats=C.cats.filter(x=>x!==c);C.items.forEach(i=>{if(i.cats2)i.cats2=i.cats2.filter(x=>x!==c.id);});save();admCats();});};
  });
  $('#addCat').onclick=()=>{C.cats.push({id:uid('c'),name:'Nova kategorija',e:'🍽️',sub:'',groups:[]});save();admCats();$('#admBody').scrollTop=1e6;};
}

/* ---- Option groups ---- */
function admGroups(){
  const w=$('#admWrap');
  w.innerHTML=`<div class="adm-head"><div><h2>OPCIJE I DODACI</h2><p class="adm-note">Strelicama mijenjate redoslijed grupa i opcija; kupac ih vidi istim redom. Grupe izbora koje kupac vidi kad dodirne artikl, npr. meni, umak ili veličina. Cijena se dodaje na cijenu artikla; 0 znači uključeno u cijenu. „Obavezno” znači da je prva opcija unaprijed odabrana.</p></div>
    <button class="btn y sm" id="addGrp">+ Nova grupa</button></div>`+
  C.groups.map(g=>{const used=C.items.filter(i=>(i.groups||[]).includes(g.id)).length;return `<div class="panel" data-id="${esc(g.id)}">
    <div class="panel-top">
      <label class="f grow"><span>Naziv grupe</span><input class="inp" data-k="name" value="${esc(g.name)}"></label>
      <label class="f grow"><span>Pomoćni tekst</span><input class="inp" data-k="hint" value="${esc(g.hint)}" placeholder="npr. odaberite više"></label>
      <div class="mvgrp" style="align-self:flex-end"><button class="ic" data-gmv="-1" aria-label="Grupu gore" ${C.groups.indexOf(g)===0?'disabled':''}>↑</button><button class="ic" data-gmv="1" aria-label="Grupu dolje" ${C.groups.indexOf(g)===C.groups.length-1?'disabled':''}>↓</button><button class="ic red" data-del aria-label="Obriši grupu">✕</button></div>
    </div>
    <div class="panel-top">
      <label class="f"><span>Način izbora</span><select class="inp" data-k="type"><option value="single" ${g.type==='single'?'selected':''}>Jedan izbor</option><option value="multi" ${g.type==='multi'?'selected':''}>Više izbora</option></select></label>
      <label class="chk" style="align-self:flex-end;padding-bottom:12px"><input type="checkbox" data-k="req" ${g.req?'checked':''}> Obavezno</label>
      <span class="adm-note" style="align-self:flex-end;padding-bottom:12px">Koristi ${used} artikala</span>
    </div>
    <div class="f"><span>Opcije · naziv i doplata (€)</span>
      <div style="display:flex;flex-direction:column;gap:8px">${g.opts.map((o,k)=>`<div class="optrow" data-o="${k}">
        <input class="inp" data-ok="n" value="${esc(o.n)}" aria-label="Naziv opcije">
        <input class="inp" data-ok="p" type="number" step="0.1" min="0" inputmode="decimal" value="${esc(o.p)}" aria-label="Doplata">
        <button class="ic" data-omv="-1" aria-label="Opciju gore" ${k===0?'disabled':''}>↑</button><button class="ic" data-omv="1" aria-label="Opciju dolje" ${k===g.opts.length-1?'disabled':''}>↓</button>
        <button class="ic red" data-odel aria-label="Ukloni opciju">✕</button></div>`).join('')}</div>
      <button class="btn ghost sm" data-oadd style="align-self:flex-start">+ Dodaj opciju</button></div>
  </div>`}).join('');
  bindInputs(w,inp=>grp(inp.closest('.panel').dataset.id));
  w.querySelectorAll('.panel').forEach(p=>{const g=grp(p.dataset.id);
    p.querySelectorAll('[data-ok]').forEach(inp=>inp.addEventListener('input',()=>{const o=g.opts[+inp.closest('.optrow').dataset.o];
      o[inp.dataset.ok]=inp.dataset.ok==='p'?Math.max(0,parseFloat(String(inp.value).replace(',','.'))||0):inp.value;save();}));
    p.querySelectorAll('[data-omv]').forEach(b=>b.onclick=()=>{const k=+b.closest('.optrow').dataset.o,j=k+ +b.dataset.omv;[g.opts[k],g.opts[j]]=[g.opts[j],g.opts[k]];save();keepScroll(admGroups);});
    p.querySelectorAll('[data-gmv]').forEach(b=>b.onclick=()=>{const k=C.groups.indexOf(g),j=k+ +b.dataset.gmv;[C.groups[k],C.groups[j]]=[C.groups[j],C.groups[k]];save();admGroups();const el=document.querySelector(`.panel[data-id="${g.id}"]`);el&&el.scrollIntoView({block:'center'});});
    p.querySelectorAll('[data-odel]').forEach(b=>b.onclick=()=>{if(g.opts.length<=1){toast('Grupa mora imati barem jednu opciju.',true);return;}g.opts.splice(+b.closest('.optrow').dataset.o,1);save();admGroups();});
    p.querySelector('[data-oadd]').onclick=()=>{g.opts.push({n:'Nova opcija',p:0});save();admGroups();const r=document.querySelector(`.panel[data-id="${g.id}"] .optrow:last-child input`);r&&(r.focus(),r.select());};
    p.querySelector('[data-del]').onclick=()=>confirmBox(`Obrisati grupu „${g.name}”?`,'Grupa će se ukloniti sa svih artikala koji je koriste.','Obriši',()=>{
      C.groups=C.groups.filter(x=>x!==g);C.items.forEach(i=>i.groups=(i.groups||[]).filter(x=>x!==g.id));C.cats.forEach(c=>c.groups=c.groups.filter(x=>x!==g.id));save();admGroups();});
  });
  $('#addGrp').onclick=()=>{C.groups.push({id:uid('g'),name:'Nova grupa',hint:'',type:'single',req:false,opts:[{n:'Opcija 1',p:0}]});save();admGroups();$('#admBody').scrollTop=1e6;};
}

function keepScroll(fn){const b=$('#admBody'),y=b.scrollTop;fn();b.scrollTop=y;}

/* ---- Settings ---- */
function admSettings(){
  const w=$('#admWrap'),s=C.settings;
  let size=0;try{size=new Blob([JSON.stringify(C)]).size;}catch(e){}
  const modeName={kiosk:'Kiosk',blagajna:'Blagajna',admin:'Administracija'}[MODE];
  w.innerHTML=`<div class="adm-head"><div><h2>POSTAVKE</h2><p class="adm-note">Poruka na početnom ekranu, PIN za osoblje i ponašanje kioska. Poruka koja počinje s „Danas:”, „Novo:” ili „Akcija:” ističe tu riječ žutom bojom; prazna poruka se ne prikazuje.</p></div></div>
  <div class="panel"><div class="two">
    <label class="f" style="grid-column:1/-1"><span>Poruka na početnom ekranu</span><input class="inp" data-k="promo" value="${esc(s.promo||'')}" placeholder="npr. Danas: domaća štrudla 2,00 €" maxlength="60"></label>
    <label class="f"><span>PIN za osoblje (4–6 znamenki)</span><input class="inp" id="pinInp" inputmode="numeric" maxlength="6" value="${esc(s.pin)}"></label>
    <label class="f"><span>Stopa PDV-a (%)</span><input class="inp" data-k="vat" type="number" min="0" max="30" value="${esc(s.vat)}"></label>
    <label class="f"><span>Neaktivnost prije upozorenja (s)</span><input class="inp" data-k="idle" type="number" min="20" max="600" value="${esc(s.idle)}"></label>
  </div><p class="adm-note" id="pinMsg">Na kiosku: 5 brzih dodira na logo u gornjem lijevom kutu menija otvara uređivanje.</p></div>
  <div class="panel"><div class="f"><span>Ovaj uređaj</span>
    <p class="adm-note">Način rada: <b>${modeName}</b> · ${CLOUD?`povezan s oblakom (lokal ${esc(String(RID).slice(0,8))}…)`:'demo, podaci samo na ovom uređaju'} · oznaka uređaja ${esc(DEVICE)}</p>
    ${CLOUD?'<button class="btn ghost sm" id="logoutBtn" style="align-self:flex-start">Odjavi uređaj</button>':''}</div></div>
  <div class="panel"><div class="f"><span>Početni ekran (čuvar zaslona)</span>
    <p class="adm-note" style="margin:0">Prikazuje se kad kiosk miruje. Zadano su ugrađene fotografije burgera, pommesa i Pepsija. Artikli ispod vrijede samo za prikaz „Fotografije odabranih artikala”.</p></div>
    <div class="two">
      <label class="f"><span>Prikaz</span><select class="inp" id="svStyle"><option value="hero">Burger, pommes i Pepsi (ugrađene fotografije)</option><option value="photo">Fotografije odabranih artikala (krugovi)</option><option value="neon">Neonska ilustracija (u stilu logotipa)</option></select></label>
      <label class="f"><span>Glavni artikl (velika fotografija)</span><select class="inp" id="svMain"></select></label>
      <label class="f"><span>Prilog (fotografija)</span><select class="inp" id="svSide"></select></label>
      <label class="f"><span>Piće (fotografija)</span><select class="inp" id="svDrink"></select></label>
    </div></div>
  <div class="panel"><div class="f"><span>KSS jela iz Wolta</span>
    <p class="adm-note" id="impNote">Dodaje sva jela i kategorije iz vaše Wolt tablice (149 jela, 15 kategorija) s fotografijama. Jela se dodaju kao „Nije na jelovniku”: kupci ih ne vide dok ih ne uključite u kartici Artikli. Postojeći artikli ostaju. Ponovni uvoz ne stvara duplikate.</p>
    <div class="panel-top"><button class="btn y sm" id="impBtn">Uvezi KSS jela</button>${CLOUD?'<button class="btn ghost sm" id="migBtn">Prebaci Wolt fotografije u naš oblak</button>':''}</div>
    <p class="adm-note" id="migNote">${(()=>{const n=C.items.filter(i=>/^https:\/\/imageproxy\.wolt\.com\//.test(i.img||'')).length;return n?`${n} fotografija učitava se izravno s Wolta.`+(CLOUD?' Prebacivanjem ih spremate u svoj Supabase, pa ne ovise o Woltu.':''):'';})()}</p></div></div>
  <div class="panel"><div class="f"><span>Sigurnosna kopija menija</span>
    <p class="adm-note">Meni ima ${Math.round(size/1024)} KB. Kopirajte podatke i spremite ih negdje, ili ih zalijepite ovdje za uvoz.</p>
    <textarea class="inp" id="bk" placeholder="Zalijepite kopiju ovdje za uvoz"></textarea>
    <div class="panel-top"><button class="btn ghost sm" id="bkCopy">Kopiraj podatke</button><button class="btn ghost sm" id="bkShow">Prikaži podatke</button><button class="btn y sm" id="bkImport">Uvezi iz polja</button></div></div></div>
  <div class="panel danger"><div class="f"><span>Vraćanje na početno</span><p class="adm-note">Briše sve vaše artikle, kategorije i opcije i vraća primjerni meni${CLOUD?' na svim uređajima lokala':''}.</p>
    <button class="btn ghost sm" id="rst" style="align-self:flex-start;color:var(--bad)">Vrati početni meni</button></div></div>`;
  bindInputs(w,()=>C.settings,()=>brand());
  $('#pinInp').oninput=e=>{const v=e.target.value.replace(/\D/g,'');e.target.value=v;
    if(v.length>=4){s.pin=v;save();$('#pinMsg').textContent='PIN spremljen.';}else $('#pinMsg').textContent='PIN mora imati najmanje 4 znamenke. Vrijedi stari PIN dok ne upišete novi.';};
  const lo=$('#logoutBtn'); if(lo)lo.onclick=()=>confirmBox('Odjaviti uređaj?','Uređaj će tražiti ponovnu prijavu računom lokala.','Odjavi',()=>Cloud.logout());
  const sv=C.settings.saver=Object.assign({style:'hero',main:'',side:'',drink:''},C.settings.saver||{}), cur=saverItems();
  [['svMain','main'],['svSide','side'],['svDrink','drink']].forEach(([id,k])=>{const el=$('#'+id);el.innerHTML=`<option value="">— automatski (${esc((cur[k]||{name:'nema'}).name)}) —</option>`+C.items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} · ${eur(i.price)}</option>`).join('');el.value=sv[k]||'';el.onchange=()=>{sv[k]=el.value;save();brand();};});
  $('#svStyle').value=sv.style||'hero'; $('#svStyle').onchange=e=>{sv.style=e.target.value;save();brand();};
  $('#impBtn').onclick=()=>importKss();
  const mg=$('#migBtn'); if(mg)mg.onclick=()=>migratePhotos(mg);
  $('#bkShow').onclick=()=>{$('#bk').value=JSON.stringify(C);$('#bk').select();};
  $('#bkCopy').onclick=()=>{const t=JSON.stringify(C);
    const fb=()=>{$('#bk').value=t;$('#bk').select();toast('Označeno u polju, kopirajte ručno.');};
    try{navigator.clipboard.writeText(t).then(()=>toast('Podaci kopirani')).catch(fb);}catch(e){fb();}};
  $('#bkImport').onclick=()=>{let d;try{d=JSON.parse($('#bk').value);}catch(e){toast('Tekst nije ispravna kopija menija.',true);return;}
    if(!validConfig(d)){toast('Kopiji nedostaju artikli, kategorije ili opcije.',true);return;}
    confirmBox('Uvesti kopiju?',`Trenutni meni zamijenit će se s ${d.items.length} artikala iz kopije.`,'Uvezi',()=>{const old=C;C=d;if(!save()){C=old;return;}brand();toast('Meni uvezen');admSettings();});};
  $('#rst').onclick=()=>confirmBox('Vratiti početni meni?','Sve vaše izmjene bit će izgubljene.','Vrati',()=>{C=freshConfig();save();brand();admSettings();toast('Vraćen početni meni');});
}

/* ---- KSS import (app/data/kss-jela.json) ---- */
async function importKss(){
  const b=$('#impBtn'); b.disabled=true;
  try{
    const d=await (await fetch('data/kss-jela.json',{cache:'no-store'})).json();
    let nc=0,ni=0,ng=0;
    d.groups.forEach(g=>{if(!grp(g.id)){C.groups.push(JSON.parse(JSON.stringify(g)));ng++;}});
    d.cats.forEach(c=>{if(!cat(c.id)){C.cats.push(JSON.parse(JSON.stringify(c)));nc++;}});
    d.items.forEach(i=>{if(!itemById(i.id)){C.items.push(JSON.parse(JSON.stringify(i)));ni++;}});
    C._imports=Object.assign({},C._imports,{[d.id]:new Date().toISOString()});
    save();
    toast(ni||nc?`Dodano ${ni} jela i ${nc} kategorija`:'Sva jela su već uvezena');
    A.tab='items';A.filter='hidden';renderAdmin();
  }catch(e){toast('Uvoz nije uspio: datoteka s jelima nije pronađena.',true);b.disabled=false;}
}
async function blobToJpeg(blob){
  const url=URL.createObjectURL(blob);
  try{
    const im=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
    const max=720,s=Math.min(1,max/Math.max(im.width,im.height));const cv=document.createElement('canvas');
    cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);const x=cv.getContext('2d');
    x.fillStyle='#ffffff';x.fillRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height);
    return cv.toDataURL('image/jpeg',0.82);
  }finally{URL.revokeObjectURL(url);}
}
async function migratePhotos(btn){
  const todo=C.items.filter(i=>/^https:\/\/imageproxy\.wolt\.com\//.test(i.img||''));
  if(!todo.length){toast('Nema fotografija za prebacivanje');return;}
  btn.disabled=true; let ok=0,fail=0; const note=$('#migNote');
  for(const it of todo){
    note.textContent=`Prebacujem ${ok+fail+1} od ${todo.length}…`;
    try{const r=await fetch(it.img);if(!r.ok)throw new Error(r.status);
      it.img=await Cloud.uploadPhoto(await blobToJpeg(await r.blob()),it.id);ok++;
      if(ok%10===0)save();
    }catch(e){fail++;}
  }
  save();
  note.textContent=fail?`Prebačeno ${ok}, nije uspjelo ${fail}. Fotografije koje nisu prebačene i dalje se učitavaju s Wolta; možete pokušati ponovno ili ih učitati ručno.`:`Prebačeno svih ${ok} fotografija.`;
  btn.disabled=false;
}

/* =====================================================================
   BOOT
   ===================================================================== */
function enterMode(){
  brand(); paintSync();
  if(MODE==='blagajna'){$('#admExit').textContent='Zaključaj';$('#admTitle').textContent='BLAGAJNA';go('lock');}
  else if(MODE==='admin'){$('#admExit').hidden=true;$('#admTitle').textContent='ADMINISTRACIJA';A.tab='items';go('admin');}
  else go('attract');
}
async function afterLogin(){
  if(CLOUD){
    await syncMenu();
    Cloud.subscribe();
    Cloud.fetchOrders().catch(()=>{});
    flushQueue();
    setInterval(flushQueue,20000);
    setInterval(()=>{Cloud.fetchOrders().catch(()=>{});},60000);   // sigurnosno osvježavanje ako realtime zastane
    if(MODE==='blagajna')Cloud.cleanup();
    window.addEventListener('online',()=>{flushQueue();Cloud.fetchOrders().catch(()=>{});});
  }else onOrders();
  enterMode();
}
function showLogin(msg){
  go('login'); $('#lgErr').textContent=msg||'';
  $('#loginTitle').textContent={kiosk:'Prijava kioska',blagajna:'Prijava blagajne',admin:'Prijava'}[MODE];
}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const email=$('#lgEmail').value.trim(), pw=$('#lgPass').value;
  if(!email||!pw){$('#lgErr').textContent='Upišite e-mail i lozinku.';return;}
  $('#lgBtn').disabled=true; $('#lgErr').textContent='';
  try{await Cloud.login(email,pw);await afterLogin();}
  catch(err){
    $('#lgErr').textContent=err.message==='nomember'?'Račun nije povezan ni s jednim lokalom. Pokrenite setup-lokal.sql u Supabaseu.'
      :/invalid/i.test(err.message||'')?'Pogrešan e-mail ili lozinka.':'Prijava nije uspjela. Provjerite internetsku vezu.';
  }finally{$('#lgBtn').disabled=false;}
});

async function boot(){
  if(!CLOUD){afterLogin();return;}
  let ok=false;
  try{ok=await Cloud.start();}
  catch(e){if(e.message==='nomember'){showLogin('Račun nije povezan ni s jednim lokalom. Pokrenite setup-lokal.sql u Supabaseu.');return;}ok=false;}
  if(!ok){showLogin();return;}
  afterLogin();
}
try{navigator.wakeLock&&navigator.wakeLock.request('screen').catch(()=>{});}catch(e){}
boot();
})();
