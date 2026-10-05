import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildCatalog, workIdFor, workOf, criticIdFor } from './review-model.js';
import { FALLBACK_POSTS } from './articles.js';
for(const file of ['editor.js','public-views.js','review-model.js','articles.js','posters.js']){
  new vm.SourceTextModule(fs.readFileSync(file,'utf8'));
}
const html=fs.readFileSync('index.html','utf8');
assert.match(fs.readFileSync('admin.html','utf8'),/src="\.\/editor\.js"/);
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
assert.equal(buildCatalog(FALLBACK_POSTS).filter(w=>w.workKind==='film').length,8);
assert.equal(workOf(FALLBACK_POSTS.find(p=>p.id==='challengers')).workTitle,'Challengers');
console.log('Sintaxe e 12 verificações de catálogo, identidade e média: OK');
