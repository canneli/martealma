export const slugify = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
import { repairedPosters } from './posters.js';
export const legacyWorks = {
  'lost-in-lust-pabllo-vittar-critica': { workKind: 'album', workTitle: 'Lost in Lust', artist: 'Pabllo Vittar', releaseYear: 2026 },
  challengers: { workKind: 'film', workTitle: 'Challengers', releaseYear: 2024 },
  'puss-last-wish': { workKind: 'film', workTitle: 'Gato de Botas 2: O Último Pedido', releaseYear: 2022 },
  interstellar: { workKind: 'film', workTitle: 'Interestelar', releaseYear: 2014 },
  saltburn: { workKind: 'film', workTitle: 'Saltburn', releaseYear: 2023 },
  'top-gun-maverick': { workKind: 'film', workTitle: 'Top Gun: Maverick', releaseYear: 2022 },
  'halloween-1978': { workKind: 'film', workTitle: 'Halloween', releaseYear: 1978 },
  'avatar-way-water': { workKind: 'film', workTitle: 'Avatar: O Caminho da Água', releaseYear: 2022 },
  'the-core': { workKind: 'film', workTitle: 'O Núcleo', releaseYear: 2003 }
};
export const kindLabels = { album: 'Música · Álbum', artist: 'Música · Artista', film: 'Filme', series: 'Série' };
export function workIdFor({ workKind, workTitle, artist = '', releaseYear = '' }) {
  return [workKind, slugify(workTitle), workKind === 'album' ? slugify(artist) : '', ['film','series'].includes(workKind) ? releaseYear : ''].filter(Boolean).join('--');
}
export function workOf(post) {
  const known = legacyWorks[post.id] || {};
  const workKind = post.workKind || known.workKind || (post.reviewType === 'Música' ? 'album' : post.category === 'Séries' ? 'series' : 'film');
  const image = post.assetVersion === 2 ? (post.poster || post.image) : (repairedPosters[post.id] || post.poster || post.image);
  const work = { workKind, workTitle: post.workTitle || known.workTitle || post.title, artist: post.artist || known.artist || '', releaseYear: post.releaseYear || known.releaseYear || '', image: image || '', spotifyId: post.spotifyId || post.spotifyEmbed?.match(/\/album\/([A-Za-z0-9]{22})/)?.[1] || '', trailerId: post.trailerId || '' };
  return { ...work, id: post.workId || workIdFor(work) };
}
export const criticIdFor = post => post.authorId || `legacy-${slugify(post.author || 'Redação')}`;
const timeOf = post => post.publishedAt?.toMillis?.() || new Date(post.publishedAt || 0).getTime() || 0;
export function buildCatalog(posts) {
  const groups = new Map();
  for (const post of posts) {
    if (post.status !== 'published' || post.reviewScore == null || !Number.isFinite(Number(post.reviewScore))) continue;
    const work = workOf(post);
    if (!groups.has(work.id)) groups.set(work.id, { ...work, reviews: [] });
    groups.get(work.id).reviews.push(post);
  }
  for (const group of groups.values()) {
    const byCritic = new Map();
    group.reviews.sort((a,b) => timeOf(b)-timeOf(a)).forEach(post => { const key = criticIdFor(post); if (!byCritic.has(key)) byCritic.set(key,post); });
    group.reviews = [...byCritic.values()];
    group.score = Math.round(group.reviews.reduce((sum,p) => sum + Number(p.reviewScore),0) / group.reviews.length);
    group.count = group.reviews.length;
  }
  // Artistas têm página própria, mas a nota de um álbum não vira nota do artista.
  for (const group of [...groups.values()]) {
    if (group.workKind !== 'album' || !group.artist) continue;
    const artistWork = { workKind: 'artist', workTitle: group.artist, artist: '', releaseYear: '', image: group.image };
    const id = workIdFor(artistWork);
    if (!groups.has(id)) groups.set(id, { ...artistWork, id, reviews: [], score: null, count: 0 });
  }
  return [...groups.values()].sort((a,b) => a.workTitle.localeCompare(b.workTitle, 'pt-BR'));
}
