import { firebaseConfig, MARTE_ALMA } from './firebase-config.js';
import { FALLBACK_POSTS, enrichPost } from './articles.js?v=20261006';
import { buildCatalog, workOf, workIdFor, kindLabels, legacyWorks, slugify } from './review-model.js';
import { profileForEmail } from './critic-profiles.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, collection, onSnapshot, query, where, getDoc, getDocs, doc, setDoc, deleteDoc, serverTimestamp, Timestamp, writeBatch, runTransaction } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
let user = null, isAdmin = false, posts = [], catalog = [], stops = [], generation = 0, saving = false;
const owns = post => post.authorId === user?.uid;
setPersistence(auth, browserLocalPersistence).catch(() => {});
$('#author').readOnly = true;
$('#google-login').onclick = async () => {
  $('#login-error').classList.add('hidden');
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch(err) { loginError(err.code === 'auth/popup-blocked' ? 'Permita a janela de login do Google e tente novamente.' : 'Não foi possível entrar: '+err.code); }
};
$('#logout').onclick = () => signOut(auth);
function loginError(text) { $('#login-error').textContent = text; $('#login-error').classList.remove('hidden'); }
onAuthStateChanged(auth, async nextUser => {
  const run = ++generation;
  stops.forEach(stop=>stop()); stops=[];
  user=nextUser; isAdmin=!!user && user.email===MARTE_ALMA.adminEmail;
  $('#login-view').classList.remove('hidden'); $('#app-view').classList.add('hidden');
  $('#login-error').classList.add('hidden');
  if(!user) return;
  try {
    const invited = isAdmin ? true : (await getDoc(doc(db,'writerInvites',user.email))).data()?.active===true;
    if(run!==generation) return;
    if(!invited) { loginError('Você está conectado como leitor e já pode comentar. Para publicar, a redação precisa autorizar seu e-mail.'); $('#google-login').textContent='Trocar conta Google'; return; }
    $('#login-view').classList.add('hidden'); $('#app-view').classList.remove('hidden');
    $('#writer-management').classList.toggle('hidden',!isAdmin);
    resetForm();
    if(isAdmin) { await migrateOriginals(); await persistExpandedReviews(); }
    if(run!==generation) return;
    stops.push(onSnapshot(query(collection(db,'articles'),where('authorId','==',user.uid)),snapshot=>{
      posts=snapshot.docs.map(d=>enrichPost({id:d.id,...d.data()})).sort((a,b)=>(b.publishedAt?.seconds||0)-(a.publishedAt?.seconds||0)); renderList();
    },err=>{$('#posts-list').textContent='Erro ao carregar seus textos: '+err.message;}));
    stops.push(onSnapshot(query(collection(db,'articles'),where('status','==','published')),snapshot=>{
      catalog=buildCatalog(snapshot.docs.map(d=>({id:d.id,...d.data()}))); renderCatalog();
      const requestedWork=new URLSearchParams(location.search).get('obra');
      if(requestedWork&&!$('#post-id').value&&!$('#work-title').value)chooseWork(catalog.find(w=>w.id===requestedWork));
    },err=>{$('#catalog-list').textContent='Erro ao carregar catálogo: '+err.message;}));
    if(isAdmin) stops.push(onSnapshot(collection(db,'writerInvites'),snapshot=>{
      $('#writers-list').innerHTML=snapshot.docs.map(d=>`<div class="rounded-xl bg-white/5 p-3 text-sm"><span>${escapeHtml(d.id)}</span><p class="text-white/60 mt-1">${d.data().active?'Autorizado':'Acesso suspenso'}</p><button data-access="${escapeHtml(d.id)}" data-active="${!d.data().active}" class="underline mt-2">${d.data().active?'Suspender acesso':'Reativar acesso'}</button></div>`).join('');
      $$('[data-access]').forEach(button=>button.onclick=async()=>{if(!confirm('Alterar o acesso de '+button.dataset.access+' à redação?'))return;try{await setDoc(doc(db,'writerInvites',button.dataset.access),{active:button.dataset.active==='true'},{merge:true});}catch(err){$('#invite-message').textContent=err.message;}});
    },err=>{$('#invite-message').textContent=err.message;}));
  } catch(err) { loginError('Não foi possível abrir a redação: '+err.message); }
});

async function migrateOriginals() {
  // Vincula apenas os textos originais, já assinados por Felipe, à conta dele.
  const snapshot=await getDocs(collection(db,'articles'));
  const batch=writeBatch(db); let changes=0;
  for(const entry of snapshot.docs){
    const post={id:entry.id,...entry.data()};
    if(!legacyWorks[post.id] || (post.authorId && post.authorId !== user.uid) || (post.authorId && post.assetVersion===2)) continue;
    const work=workOf(post);
    batch.update(entry.ref,{authorId:user.uid,authorPhoto:user.photoURL||'',workKind:work.workKind,workTitle:work.workTitle,workId:work.id,artist:work.artist,releaseYear:work.releaseYear,image:work.image,poster:work.image,assetVersion:2}); changes++;
  }
  if(snapshot.empty){
    FALLBACK_POSTS.forEach(({id,...post})=>{const work=workOf({id,...post});batch.set(doc(db,'articles',id),{...post,authorId:user.uid,authorPhoto:user.photoURL||'',workId:work.id,workTitle:work.workTitle,workKind:work.workKind,artist:work.artist,releaseYear:work.releaseYear});changes++;});
  }
  if(changes) await batch.commit();
}
async function persistExpandedReviews() {
  // Persiste as ampliações na conta do autor, sem substituir alterações próprias.
  // A transação relê o texto para não apagar uma edição feita em outra aba.
  const ownerId = user.uid;
  const originals = FALLBACK_POSTS.filter(post => post.reviewType === 'Filmes');
  for (const original of originals) {
    if (user?.uid !== ownerId) return;
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'articles', original.id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) return;
      const post = { id: snapshot.id, ...snapshot.data() };
      if (post.authorId !== ownerId) return;
      const enriched = enrichPost(post);
      if (enriched.content === post.content) return;
      transaction.update(ref, { content: enriched.content, updatedAt: serverTimestamp() });
    });
  }
}
function renderList() {
  $('#post-count').textContent=posts.length;
  $('#posts-list').innerHTML=posts.map(p=>`<article class="rounded-xl bg-white/5 p-3"><p class="text-xs text-orange-300">${p.status==='published'?'Publicado':'Rascunho'}${p.reviewScore!=null?' · Nota '+p.reviewScore:''}</p><h3 class="font-semibold my-2">${escapeHtml(p.title)}</h3><div class="flex gap-2"><button data-edit="${escapeHtml(p.id)}" class="flex-1 rounded-lg bg-white/10 py-2 text-sm">Editar meu texto</button><button data-delete="${escapeHtml(p.id)}" class="rounded-lg bg-red-500/10 px-3 text-red-300" aria-label="Excluir meu texto">Excluir</button></div></article>`).join('')||'<p class="text-white/65 py-5">Você ainda não escreveu matérias. Escolha algo do catálogo ou cadastre uma nova obra.</p>';
  $$('[data-edit]').forEach(button=>button.onclick=()=>loadPost(button.dataset.edit));
  $$('[data-delete]').forEach(button=>button.onclick=()=>removePost(button.dataset.delete));
}
function renderCatalog() {
  const search=slugify($('#catalog-search').value);
  $('#catalog-list').innerHTML=catalog.filter(w=>slugify(w.workTitle+' '+w.artist).includes(search)).map(w=>`<button data-work="${escapeHtml(w.id)}" class="block w-full text-left rounded-xl bg-white/5 hover:bg-white/10 p-3"><span class="text-xs text-orange-300">${kindLabels[w.workKind]}</span><span class="block font-semibold">${escapeHtml(w.workTitle)}</span><span class="text-xs text-white/65">${escapeHtml(w.artist)} ${w.releaseYear||''} · ${w.count} crítica(s)${w.score!=null?' · média '+w.score:''}</span></button>`).join('')||'<p class="text-sm text-white/65">Nenhuma obra encontrada. Você pode cadastrar uma nova no formulário.</p>';
  $$('[data-work]').forEach(button=>button.onclick=()=>chooseWork(catalog.find(w=>w.id===button.dataset.work)));
  updateOptions();
}
function updateOptions(){ $('#work-options').innerHTML=catalog.filter(w=>w.workKind===$('#work-kind').value).map(w=>`<option value="${escapeHtml(w.workTitle)}">${escapeHtml(w.artist)} ${w.releaseYear||''}</option>`).join(''); }
function updateKind(){ const kind=$('#work-kind').value; $('#work-fields').classList.toggle('hidden',kind==='news'); $('#artist-field').classList.toggle('hidden',kind!=='album'); updateOptions(); }
function chooseWork(work){
  if(!work)return;
  const mine=posts.find(p=>workOf(p).id===work.id && p.reviewScore!=null);
  if(mine)return loadPost(mine.id);
  resetForm(); applyWork(work); $('#work-hint').textContent='Sua crítica será adicionada à página desta obra. As outras avaliações não serão alteradas.';
  scrollTo({top:0,behavior:'smooth'});
}
function applyWork(work){ $('#work-kind').value=work.workKind; $('#work-title').value=work.workTitle; $('#work-artist').value=work.artist||''; $('#release-year').value=work.releaseYear||''; $('#image').value=work.image||''; $('#spotify-link').value=work.spotifyId?'https://open.spotify.com/album/'+work.spotifyId:''; $('#trailer-link').value=work.trailerId?'https://www.youtube.com/watch?v='+work.trailerId:''; updateKind(); }
function loadPost(id){
  const p=posts.find(x=>x.id===id);if(!p||!owns(p))return;
  resetForm(); $('#post-id').value=p.id;
  ['title','slug','category','author','image','excerpt','content'].forEach(key=>{$('#'+key).value=p[key]||'';});
  $('#tags').value=(p.tags||[]).join(', ');$('#featured').checked=!!p.featured;
  if(p.reviewScore!=null){applyWork(workOf(p));$('#image').value=p.image;$('#review-score').value=p.reviewScore;}else{$('#work-kind').value='news';updateKind();}
  $('#editor-title').textContent='Editar minha matéria'; updatePreview(); scrollTo({top:0,behavior:'smooth'});
}
function resetForm(){ $('#post-form').reset();$('#post-id').value='';$('#author').value=profileForEmail(user?.email)?.name||user?.displayName||'Crítico(a)';$('#editor-title').textContent='Nova matéria';$('#work-hint').textContent='A nota entra na média da obra, sem substituir as avaliações dos outros críticos.';updateKind();updatePreview(); }
function updatePreview(){ $('#preview').innerHTML=DOMPurify.sanitize(marked.parse($('#content').value||'*A prévia aparece aqui.*')); }
$('#catalog-search').oninput=renderCatalog;
$('#work-kind').onchange=updateKind;
$('#work-title').onchange=()=>{const matches=catalog.filter(w=>w.workKind===$('#work-kind').value&&slugify(w.workTitle)===slugify($('#work-title').value));if(matches.length===1&&!$('#post-id').value)applyWork(matches[0]);};
$('#content').oninput=updatePreview;
$('#title').oninput=()=>{if(!$('#post-id').value)$('#slug').value=slugify($('#title').value);};
$('#new-post').onclick=resetForm;
$$('[data-save]').forEach(button=>button.onclick=()=>savePost(button.dataset.save));
function mediaId(value,type){
  if(!value.trim())return '';
  try{const url=new URL(value);if(type==='spotify'&&['open.spotify.com','www.open.spotify.com'].includes(url.hostname))return url.pathname.match(/\/album\/([A-Za-z0-9]{22})/)?.[1]||'';if(type==='youtube'&&['www.youtube.com','youtube.com','m.youtube.com'].includes(url.hostname))return url.searchParams.get('v')?.match(/^[\w-]{11}$/)?.[0]||'';if(type==='youtube'&&url.hostname==='youtu.be')return url.pathname.slice(1).match(/^[\w-]{11}$/)?.[0]||'';}catch{}
  return '';
}
async function savePost(status){
  if(saving||!user)return;
  const title=$('#title').value.trim(),slug=$('#slug').value.trim()||slugify(title),image=$('#image').value.trim(),content=$('#content').value.trim();
  if(!title||!slug||!image||!content)return showMessage('Preencha título, capa e texto.',true);
  try{if(new URL(image).protocol!=='https:')throw new Error();}catch{return showMessage('A capa precisa ser um link HTTPS válido.',true);}
  const workKind=$('#work-kind').value, workTitle=$('#work-title').value.trim(),artist=$('#work-artist').value.trim(),releaseYear=Number($('#release-year').value)||null;
  const scoreValue=$('#review-score').value,reviewScore=workKind==='news'?null:Number(scoreValue);
  if(workKind!=='news'&&(!workTitle||(workKind==='album'&&!artist)||scoreValue===''||!Number.isInteger(reviewScore)||reviewScore<0||reviewScore>100))return showMessage('Preencha a obra, o artista do álbum e uma nota inteira de 0 a 100.',true);
  const workId=workKind==='news'?'':workIdFor({workKind,workTitle,artist,releaseYear});
  const duplicate=posts.find(p=>p.reviewScore!=null&&workOf(p).id===workId&&p.id!==$('#post-id').value);
  if(workKind!=='news'&&duplicate){loadPost(duplicate.id);return showMessage('Você já avaliou essa obra. Edite sua crítica existente.',true);}
  const old=posts.find(p=>p.id===$('#post-id').value);
  if(old&&!owns(old))return showMessage('Você só pode editar sua própria matéria.',true);
  const id=old?.id||(workKind==='news'?slug+'--'+crypto.randomUUID():'review--'+workId+'--'+user.uid);
  // A URL leva a assinatura da conta para não colidir com outra crítica da mesma obra.
  const publicSlug=old?.slug||(slug+'--'+user.uid.slice(0,8));
  const authorProfile=profileForEmail(user.email), authorName=authorProfile?.name||user.displayName||'Crítico(a)';
  const data={title,slug:publicSlug,category:workKind==='film'?'Cinema':workKind==='series'?'Séries':$('#category').value,author:authorName,authorEmail:user.email,authorId:user.uid,authorPhoto:user.photoURL||'',image,excerpt:$('#excerpt').value.trim(),content,tags:$('#tags').value.split(',').map(x=>x.trim()).filter(Boolean),featured:isAdmin&&$('#featured').checked,status,updatedAt:serverTimestamp(),publishedAt:old?.publishedAt||Timestamp.now(),reviewScore,reviewType:['album','artist'].includes(workKind)?'Música':workKind==='film'?'Filmes':'Séries',workKind,workTitle:workKind==='news'?'':workTitle,workId,artist:workKind==='album'?artist:'',releaseYear,spotifyId:mediaId($('#spotify-link').value,'spotify'),trailerId:mediaId($('#trailer-link').value,'youtube'),revisiting:!!releaseYear&&new Date().getFullYear()-releaseYear>=10};
  data.poster=image;data.assetVersion=2;
  if(['album','artist'].includes(workKind))data.category='Críticas';
  saving=true;$$('[data-save]').forEach(button=>button.disabled=true);
  try{await setDoc(doc(db,'articles',id),data,{merge:true});$('#post-id').value=id;$('#slug').value=publicSlug;$('#editor-title').textContent='Editar minha matéria';showMessage(status==='published'?'Crítica publicada. A média e seu perfil são atualizados automaticamente.':'Rascunho salvo. Ele não entra na média.');}
  catch(err){showMessage('Não foi possível salvar: '+err.message,true);}
  finally{saving=false;$$('[data-save]').forEach(button=>button.disabled=false);}
}
async function removePost(id){const p=posts.find(x=>x.id===id);if(!p||!owns(p)||!confirm('Excluir sua matéria “'+p.title+'”?'))return;try{await deleteDoc(doc(db,'articles',id));if($('#post-id').value===id)resetForm();showMessage('Matéria removida. A média será recalculada.');}catch(err){showMessage(err.message,true);}}
function showMessage(text,error=false){$('#save-message').textContent=text;$('#save-message').classList.remove('hidden');$('#save-message').classList.toggle('text-red-300',error);}
$('#invite-writer').onclick=async()=>{const email=$('#invite-email').value.trim().toLowerCase();if(!isAdmin||!email||!$('#invite-email').checkValidity()){ $('#invite-message').textContent='Informe um e-mail válido.';return; }try{await setDoc(doc(db,'writerInvites',email),{active:true,invitedBy:user.uid,updatedAt:serverTimestamp()},{merge:true});$('#invite-message').textContent='Escritor autorizado. Ele pode entrar com essa conta Google.';$('#invite-email').value='';}catch(err){$('#invite-message').textContent='Não foi possível autorizar: '+err.message;}};
