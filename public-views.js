import { buildCatalog, workOf, criticIdFor, kindLabels } from './review-model.js';
import { profileForPost, writerProfiles } from './critic-profiles.js';
const esc = (value='') => String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
const tone = score => score>=70?'score-good':score<50?'score-low':'score-mid';
const date = value => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(value).replace('.','');
const scoreBox = (score,label='') => score == null ? '' : `<span class="catalog-score ${tone(score)}" aria-label="Nota ${score} de 100">${score}</span>${label?`<span class="score-label">${esc(label)}</span>`:''}`;
const cover = (work,className='') => `<img class="work-cover ${work.workKind==='album'||work.workKind==='artist'?'square':'portrait'} ${className}" src="${esc(work.image)}" alt="Capa de ${esc(work.workTitle)}" loading="lazy" referrerpolicy="no-referrer">`;
export function createViews({ getPosts, root, initComments, updateMeta, bindShare, cleanup, canCreateSocial=()=>false }) {
  const published=()=>getPosts().filter(p=>p.status==='published');
  const catalog=()=>buildCatalog(published());
  function start(title,params,push=true){
    cleanup(); document.title=title+' | Marte Alma';
    if(push)history.pushState(null,'',location.pathname+(params?'?'+params:''));
    document.querySelector('link[rel="canonical"]').href='https://canneli.github.io/martealma/'+(params?'?'+params:'');
    document.querySelector('meta[property="og:type"]').content='website';
    document.querySelector('#news-jsonld')?.remove();
    document.body.style.overflow='';
    document.querySelector('#sidebar')?.classList.add('-translate-x-[105%]');
    document.querySelector('#menu-overlay')?.classList.add('opacity-0','pointer-events-none');
  }
  function finish(){
    root.querySelectorAll('[data-article]').forEach(el=>el.onclick=()=>article(el.dataset.article));
    root.querySelectorAll('[data-work]').forEach(el=>el.onclick=()=>work(el.dataset.work));
    root.querySelectorAll('[data-critic]').forEach(el=>el.onclick=()=>critic(el.dataset.critic));
    root.querySelectorAll('[data-catalog]').forEach(el=>el.onclick=()=>list());
    root.querySelectorAll('[data-home]').forEach(el=>el.onclick=()=>home());
    root.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.classList.add('cover-unavailable');img.alt='Capa indisponível: '+img.alt.replace('Capa de ','');});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function card(work){return `<button data-work="${esc(work.id)}" class="work-card" data-search="${esc((work.workTitle+' '+work.artist).toLowerCase())}">${cover(work)}<div class="card-score-row">${scoreBox(work.score)}<span class="muted">${work.count?work.count+' crítica'+(work.count>1?'s':''):'Perfil do artista'}</span></div><h3>${esc(work.workTitle)}</h3><p class="muted">${esc(work.artist||work.releaseYear||'')}</p></button>`;}
  function shelf(title,works){return works.length?`<section class="catalog-section"><div class="section-heading"><h2>${esc(title)}</h2><button data-catalog class="text-link">Ver catálogo ↗</button></div><div class="cover-shelf">${works.map(card).join('')}</div></section>`:'';}
  function reviewRow(post){const work=workOf(post);return `<article class="review-row"><button data-article="${esc(post.slug)}" aria-label="Ler ${esc(post.title)}">${cover(work)}</button><div><p class="eyebrow">${esc(kindLabels[work.workKind])}${post.revisiting?' · Revisitando':''}</p><button data-article="${esc(post.slug)}" class="review-title">${esc(post.title)}</button><div class="review-credit"><button data-critic="${esc(criticIdFor(post))}" class="text-link">${esc(post.author)}</button><span>${date(post.publishedAt)}</span>${scoreBox(post.reviewScore)}</div></div></article>`;}
  function home(push=true){
    start('Críticas de música, cinema e séries','',push);
    const posts=published(),works=catalog(),featured=posts.find(p=>p.featured)||posts[0];
    if(!featured){root.innerHTML='<section class="page-heading"><h1>Marte Alma</h1><p>As primeiras matérias chegam em breve.</p></section>';return finish();}
    const featureWork=workOf(featured);
    root.innerHTML=`<section class="editorial-hero"><div class="hero-copy"><p class="eyebrow">MARTE ALMA · CRÍTICA E CULTURA</p><h1>${esc(featured.title)}</h1><p class="hero-deck">${esc(featured.excerpt)}</p><div class="review-credit">${scoreBox(featured.reviewScore)}<button data-critic="${esc(criticIdFor(featured))}" class="text-link">${esc(featured.author)}</button><span>${date(featured.publishedAt)}</span></div><button data-article="${esc(featured.slug)}" class="primary-button">Ler a crítica ↗</button></div><button data-article="${esc(featured.slug)}" class="hero-cover" aria-label="Ler ${esc(featured.title)}">${cover(featureWork)}</button></section>
      ${shelf('Música',works.filter(w=>w.workKind==='album'))}${shelf('Cinema',works.filter(w=>w.workKind==='film'))}${shelf('Séries',works.filter(w=>w.workKind==='series'))}
      <section class="catalog-section"><div class="section-heading"><h2>Últimas críticas</h2><button data-catalog class="text-link">Todas as obras ↗</button></div><div class="review-grid">${posts.filter(p=>p.reviewScore!=null).slice(0,8).map(reviewRow).join('')}</div></section>
      ${posts.some(p=>p.reviewScore==null)?`<section class="catalog-section"><h2>Notícias</h2><div class="review-grid">${posts.filter(p=>p.reviewScore==null).map(reviewRow).join('')}</div></section>`:''}`;
    finish();
  }
  function list(active='Todos',push=true){
    start('Catálogo e notas','notas=1',push);
    const works=catalog(),filters={'Todos':'','Álbuns':'album','Artistas':'artist','Filmes':'film','Séries':'series'};
    root.innerHTML=`<header class="page-heading"><p class="eyebrow">CATÁLOGO MARTE ALMA</p><h1>Uma obra. Mais de um olhar.</h1><p>Álbuns, artistas, filmes e séries organizados em páginas próprias. A nota é a média das avaliações, com o mesmo peso para cada crítico.</p><input id="catalog-find" type="search" class="catalog-search" placeholder="Buscar obra ou artista" aria-label="Buscar no catálogo"><nav class="catalog-filters">${Object.keys(filters).map(label=>`<button data-filter="${label}" aria-pressed="${active===label}">${label}</button>`).join('')}</nav></header>
      ${Object.entries({album:'Álbuns',artist:'Artistas',film:'Filmes',series:'Séries'}).filter(([kind])=>!filters[active]||filters[active]===kind).map(([kind,label])=>shelf(label,works.filter(w=>w.workKind===kind))).join('')||'<p class="empty-state">Ainda não há avaliações nesta categoria.</p>'}
      <p class="catalog-explainer">Notas de 0 a 100. Verde: 70 ou mais. Amarelo: 50 a 69. Vermelho: abaixo de 50. Rascunhos não entram na média. Cada crítico conta uma vez por obra, e o número de avaliações aparece ao lado da nota.</p>`;
    finish();root.querySelectorAll('[data-filter]').forEach(button=>button.onclick=()=>list(button.dataset.filter));
    root.querySelector('#catalog-find').oninput=event=>{const term=event.target.value.trim().toLowerCase();root.querySelectorAll('.work-card').forEach(el=>el.hidden=!el.dataset.search.includes(term));};
  }
  function work(id,push=true){
    const all=catalog(),entity=all.find(w=>w.id===id);if(!entity)return list('Todos',push);
    start(entity.workTitle,'obra='+encodeURIComponent(id),push);
    const albums=entity.workKind==='artist'?all.filter(w=>w.workKind==='album'&&w.artist.toLowerCase()===entity.workTitle.toLowerCase()):[];
    const artistPage=entity.artist?all.find(w=>w.workKind==='artist'&&w.workTitle.toLowerCase()===entity.artist.toLowerCase()):null;
    root.innerHTML=`<button data-catalog class="text-link back-link">← Catálogo</button><section class="work-heading">${cover(entity)}<div><p class="eyebrow">${kindLabels[entity.workKind]}</p><h1>${esc(entity.workTitle)}</h1><p class="muted">${artistPage?`<button data-work="${esc(artistPage.id)}" class="text-link">${esc(entity.artist)}</button>`:''} ${entity.releaseYear||''}</p><div class="aggregate-score">${scoreBox(entity.score)}<div><strong>${entity.score==null?'Ainda sem avaliação direta':'Média Marte Alma'}</strong><p class="muted">${entity.count} crítico${entity.count===1?'':'s'} · notas de 0 a 100</p></div></div><p>As opiniões de cada crítico ficam separadas. A média reúne as notas, sem apagar as diferenças entre elas.</p><a href="./admin.html" class="primary-button">Sou da redação: avaliar esta obra</a></div></section>
      ${entity.reviews.length?`<section class="catalog-section"><h2>O que os críticos acharam</h2><div class="critic-reviews">${entity.reviews.map(post=>`<article class="critic-review"><div class="review-credit">${scoreBox(post.reviewScore)}<button data-critic="${esc(criticIdFor(post))}" class="text-link">${esc(post.author)}</button><span>${date(post.publishedAt)}</span></div><button data-article="${esc(post.slug)}" class="review-title">${esc(post.title)}</button><p>${esc(post.excerpt)}</p><button data-article="${esc(post.slug)}" class="text-link">Ler crítica completa ↗</button></article>`).join('')}</div></section>`:''}${shelf('Álbuns de '+entity.workTitle,albums)}`;
    finish();
    const evaluateLink=root.querySelector('a[href="./admin.html"]');evaluateLink.href='./admin.html?obra='+encodeURIComponent(entity.id);
  }
  function critic(id,push=true){
    const posts=published().filter(p=>criticIdFor(p)===id);if(!posts.length)return home(push);
    const author=posts[0], profile=profileForPost(author);start(author.author,'critico='+encodeURIComponent(id),push);
    root.innerHTML=`<button data-home class="text-link back-link">← Início</button><header class="page-heading critic-heading">${author.authorPhoto?`<img src="${esc(author.authorPhoto)}" alt="" class="critic-avatar">`:''}<p class="eyebrow">${esc(profile?.role||'CRÍTICO MARTE ALMA')}</p><h1>${esc(profile?.name||author.author)}</h1><p>${esc(profile?.bio||`${posts.filter(p=>p.reviewScore!=null).length} críticas publicadas. Um arquivo das obras avaliadas, notas e textos assinados por este crítico.`)}</p></header><section class="catalog-section"><h2>Críticas e matérias</h2><div class="review-grid">${posts.map(reviewRow).join('')}</div></section>`;
    finish();
  }
  function article(slug,push=true){
    const post=published().find(p=>p.slug===slug||p.id===slug);if(!post)return home(push);
    start(post.title,'artigo='+encodeURIComponent(post.slug),push);updateMeta(post);
    const entity=workOf(post),group=catalog().find(w=>w.id===entity.id);
    const related=published().filter(p=>p.id!==post.id&&workOf(p).workKind===entity.workKind).slice(0,6);
    const extra=related.length?related:published().filter(p=>p.id!==post.id).slice(0,6);
    const html=DOMPurify.sanitize(marked.parse(post.content||''));
    const isReview=post.reviewScore!=null;
    root.innerHTML=`<button data-home class="text-link back-link">← Início</button><header class="article-heading"><p class="eyebrow">${esc(isReview?(kindLabels[entity.workKind]||post.category):(post.category||'Notícias'))}${post.revisiting?' · Revisitando':''}</p><h1>${esc(post.title)}</h1><p class="hero-deck">${esc(post.excerpt)}</p><div class="review-credit"><button data-critic="${esc(criticIdFor(post))}" class="text-link">${esc(post.author)}</button><span>${date(post.publishedAt)}</span><span>${Math.max(1,Math.ceil((post.content||'').split(/\s+/).length/210))} min de leitura</span></div></header>
      <div class="article-share-tools">${canCreateSocial()?'<button data-share="instagram" class="primary-button">Gerar post para Instagram</button>':''}<button data-share="whatsapp" class="text-link">WhatsApp</button><button data-share="copy" class="text-link">Copiar link</button></div>
      <div class="article-layout"><article class="article-main">${isReview?`<div class="article-work-summary">${cover(entity)}<div><p class="eyebrow">${esc(entity.workTitle)}</p><div class="aggregate-score">${scoreBox(post.reviewScore)}<div><strong>Nota de ${esc(post.author)}</strong><p class="muted">0 a 100</p></div></div>${group?`<button data-work="${esc(group.id)}" class="text-link">Ver página da obra · média ${group.score} ↗</button>`:''}</div></div>`:post.image?`<img class="news-article-image" src="${esc(post.image)}" alt="${esc(post.title)}" referrerpolicy="no-referrer">`:''}
      ${post.spotifyEmbed?`<section class="media-embed"><p class="eyebrow">Ouça o álbum</p><iframe src="${esc(post.spotifyEmbed)}" height="352" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="Ouvir ${esc(entity.workTitle)} no Spotify"></iframe></section>`:''}
      ${post.trailerId?`<section class="media-embed"><p class="eyebrow">Trailer</p><iframe class="trailer-frame" src="https://www.youtube-nocookie.com/embed/${esc(post.trailerId)}" title="Trailer de ${esc(entity.workTitle)}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></section>`:''}
      <div class="article-body">${html}</div>
      ${post.reviewScore!=null?`<aside class="rating-summary"><h2>Sobre a nota</h2><p>${['album','artist'].includes(entity.workKind)?'Canções, produção, coesão e contexto do artista entram na avaliação. A crítica acima explica o que funciona e o que pesa contra o projeto.':'A avaliação considera a proposta do filme, a direção, o roteiro e as atuações. A crítica acima explica o que sustenta essa nota.'}</p></aside>`:''}
      <section id="comments" class="comments-section"><div class="section-heading"><h2>Comentários</h2><button id="comment-login" class="primary-button">Entrar para comentar</button></div><div id="comment-form-wrap" class="hidden"><textarea id="comment-text" maxlength="1200" rows="4" placeholder="Escreva seu comentário..."></textarea><div class="review-credit"><span id="comment-user" class="muted"></span><button id="comment-send" class="primary-button">Publicar</button></div></div><div id="comments-list">Carregando comentários...</div></section></article>
      <aside class="recommendations"><h2>Recomendados</h2><p class="muted">Continue lendo no Marte Alma</p>${extra.map(p=>{const w=workOf(p);return `<button data-article="${esc(p.slug)}" class="recommended-item">${cover(w)}<span><span class="eyebrow">${esc(kindLabels[w.workKind])}</span><strong>${esc(w.workTitle)}</strong><span class="muted">${esc(p.author)}</span>${scoreBox(p.reviewScore)}</span></button>`;}).join('')}<div class="share-row"><button data-share="whatsapp" class="text-link">WhatsApp</button><button data-share="copy" class="text-link">Copiar link</button></div></aside></div>`;
    finish();initComments(post);bindShare(post);
  }
  function feed(category,push=true){
    start(category,'categoria='+encodeURIComponent(category),push);
    const posts=published().filter(p=>category==='Notícias'?p.reviewScore==null:category==='Críticas'?p.reviewScore!=null:p.category===category);
    root.innerHTML=`<header class="page-heading"><p class="eyebrow">MARTE ALMA</p><h1>${esc(category)}</h1><p>${category==='Notícias'?'Novidades de música, cinema e cultura.':'Todos os textos, com a assinatura e a nota de cada crítico.'}</p></header><div class="review-grid">${posts.map(reviewRow).join('')}</div>${posts.length?'':'<p class="empty-state">Ainda não há matérias nesta seção.</p>'}`;
    finish();
  }
  function page(name,push=true){
    const pages={
      sobre:['Sobre o Marte Alma','Um site de críticas de música, cinema e séries, com textos assinados e notas de 0 a 100. Cada crítico mantém sua opinião. A página da obra reúne as avaliações e mostra a média com o mesmo peso para todos.'],
      expediente:['Expediente','As matérias são assinadas por seus autores. Escritores autorizados publicam e editam apenas os próprios textos. Os perfis dos críticos reúnem suas publicações e avaliações.'],
      privacidade:['Privacidade','O login usa a conta Google pelo Firebase. O site recebe nome, foto, e-mail e identificador da conta para manter a sessão e verificar o acesso à redação. O e-mail não aparece nos comentários nem no perfil público. Ao comentar, seu nome e o texto ficam públicos. Matérias mostram a assinatura do autor. O navegador guarda a sessão e sua preferência de tema. Os comentários e as matérias são armazenados no Firebase. Players do YouTube e Spotify são serviços externos e seguem suas próprias políticas. Se houver anúncios do Google, eles podem usar cookies e outros identificadores para medir e exibir publicidade. Você pode consultar e controlar a personalização em Minha Central de Anúncios do Google. Não publique dados pessoais ou de terceiros nos comentários.']
    };
    const [title,text]=pages[name]||pages.sobre;start(title,'pagina='+encodeURIComponent(name),push);
    const people=name==='expediente'?`<section class="catalog-section"><h2>Redação</h2><div class="critic-reviews">${writerProfiles.map(profile=>`<article class="critic-review"><p class="eyebrow">${esc(profile.role)}</p><h3>${esc(profile.name)}</h3><p>${esc(profile.bio)}</p></article>`).join('')}</div></section>`:'';
    root.innerHTML=`<header class="page-heading"><p class="eyebrow">MARTE ALMA</p><h1>${title}</h1></header><section class="article-main article-body"><p>${text}</p>${name==='privacidade'?'<p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacidade do Google</a> · <a href="https://myadcenter.google.com/" target="_blank" rel="noopener">Minha Central de Anúncios</a></p>':''}</section>${people}`;finish();
  }
  return { home, catalog:list, article, work, critic, feed, page };
}
