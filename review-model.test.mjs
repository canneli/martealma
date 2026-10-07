import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildCatalog, workIdFor, workOf, criticIdFor } from './review-model.js';
import { FALLBACK_POSTS, enrichPost } from './articles.js';
import { expandedFilmReviews } from './film-reviews.js';
import { profileForEmail } from './critic-profiles.js';
for(const file of ['editor.js','public-views.js','review-model.js','articles.js','posters.js','film-reviews.js','critic-profiles.js']){
  new vm.SourceTextModule(fs.readFileSync(file,'utf8'));
}
const html=fs.readFileSync('index.html','utf8');
assert.match(fs.readFileSync('admin.html','utf8'),/src="\.\/editor\.js(?:\?v=\d+)?"/);
new vm.SourceTextModule(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]);
for(const name of ['POSTS','auth','content','escapeHtml'])assert.match(html,new RegExp('(?:let|const) '+name+'(?:[ ,=])'));
const base={status:'published',workKind:'album',workTitle:'Álbum',artist:'Artista',image:'https://example.com/cover.jpg'};
const posts=[{...base,id:'a',authorId:'felipe',reviewScore:70,publishedAt:new Date('2026-01-01')},{...base,id:'b',authorId:'paulo',reviewScore:90,publishedAt:new Date('2026-01-02')}];
const album=catalog=>catalog.find(w=>w.workKind==='album');
assert.equal(album(buildCatalog(posts)).score,80);
assert.equal(album(buildCatalog(posts)).count,2);
assert.equal(album(buildCatalog([...posts,{...posts[0],id:'c',reviewScore:100,publishedAt:new Date('2026-02-01')}])).score,95);
assert.equal(album(buildCatalog([...posts,{...base,id:'draft',authorId:'third',status:'draft',reviewScore:0}])).score,80);
assert.equal(album(buildCatalog(posts.slice(0,1))).score,70);
assert.equal(buildCatalog(posts).find(w=>w.workKind==='artist').score,null);
assert.notEqual(workIdFor({...base,artist:'Outro artista'}),workIdFor(base));
assert.notEqual(workIdFor({workKind:'film',workTitle:'Halloween',releaseYear:1978}),workIdFor({workKind:'film',workTitle:'Halloween',releaseYear:2018}));
assert.equal(workIdFor({...base,workTitle:'Album'}),workIdFor(base));
assert.equal(criticIdFor(posts[0]),'felipe');
assert.equal(profileForEmail('POULLDARK@gmail.com').name,'Paulo Silva');
assert.equal(buildCatalog(FALLBACK_POSTS).filter(w=>w.workKind==='film').length,8);
assert.equal(workOf(FALLBACK_POSTS.find(p=>p.id==='challengers')).workTitle,'Challengers');
console.log('Sintaxe e 12 verificações de catálogo, identidade e média: OK');
for (const post of FALLBACK_POSTS.filter(p => p.reviewType === 'Filmes')) {
  assert.ok(post.content.split(/\s+/).length >= 350, post.id + ': texto desenvolvido');
  assert.doesNotMatch(post.content, /[\u2013\u2014]/);
  assert.match(post.content, /## Resumo sem spoilers/);
  assert.match(post.content, new RegExp('## Por que a nota é ' + post.reviewScore));
  assert.equal(post.content, expandedFilmReviews[post.id].content);
  const edited = { ...post, content: 'Meu texto novo, salvo no editor.' };
  assert.equal(enrichPost(edited).content, edited.content);
}
assert.equal(Object.keys(expandedFilmReviews).length, 8);
assert.equal(enrichPost({id:'nova-critica',content:'Texto de outro escritor'}).content,'Texto de outro escritor');
assert.match(html,/src="\.\/brand-logo\.svg(?:\?v=\d+)?"/);
assert.match(html,/href="\.\/brand-mark\.svg"/);
console.log('8 críticas ampliadas, notas preservadas, sem travessões e sem sobrescrever edições: OK');
