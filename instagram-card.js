import { workOf, kindLabels, slugify } from './review-model.js';

export const CARD_SIZE = { width: 1080, height: 1350 };
export const cardStyles = {
  marte: { label: 'Marte Alma', background: '#f7f5ef', panel: '#315f47', ink: '#18211c', paper: '#f7f5ef', accent: '#aa6b4b', muted: '#697168' },
  noite: { label: 'Noite em Marte', background: '#18211c', panel: '#22382c', ink: '#f7f5ef', paper: '#f7f5ef', accent: '#dd8c64', muted: '#c2cec3' },
  solar: { label: 'Solar', background: '#dd8c64', panel: '#a94e35', ink: '#18211c', paper: '#fff8eb', accent: '#315f47', muted: '#603126' }
};
export const hasReviewScore = post => post.reviewScore !== null && post.reviewScore !== undefined && post.reviewScore !== '' && Number.isFinite(Number(post.reviewScore)) && Number(post.reviewScore) >= 0 && Number(post.reviewScore) <= 100;
export const scoreColors = score => score >= 70 ? ['#a4dd74', '#1c3e20'] : score < 50 ? ['#f5988c', '#64261f'] : ['#f3d36b', '#554313'];
export const cardFilename = post => `marte-alma-${hasReviewScore(post) ? 'critica' : 'noticia'}-${slugify(post.slug || post.title).slice(0, 90) || 'materia'}-1080x1350.png`;
export const cleanCardText = value => String(value || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();

export function wrapLines(context, text, width) {
  const lines = []; let line = '';
  for (const word of cleanCardText(text).split(' ').filter(Boolean)) {
    if (context.measureText(word).width > width) {
      if (line) { lines.push(line); line = ''; }
      for (const character of Array.from(word)) {
        if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
        line += character;
      }
    } else if (line && context.measureText(line + ' ' + word).width > width) {
      lines.push(line); line = word;
    } else line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
}

export function fitText(context, text, { width, height, maxSize = 60, minSize = 30, weight = 700, lineRatio = 1.13 }) {
  let lines = [], size = maxSize;
  for (; size >= minSize; size -= 2) {
    context.font = `${weight} ${size}px Outfit, Arial, sans-serif`;
    lines = wrapLines(context, text, width);
    if (lines.length * size * lineRatio <= height) return { lines, size, lineHeight: size * lineRatio, truncated: false };
  }
  size = minSize;
  context.font = `${weight} ${size}px Outfit, Arial, sans-serif`;
  lines = wrapLines(context, text, width);
  const maxLines = Math.max(1, Math.floor(height / (size * lineRatio)));
  const truncated = lines.length > maxLines;
  lines = lines.slice(0, maxLines);
  if (truncated) {
    let last = lines.at(-1);
    while (last && context.measureText(last + '…').width > width) last = Array.from(last).slice(0, -1).join('');
    lines[lines.length - 1] = last.trimEnd() + '…';
  }
  return { lines, size, lineHeight: size * lineRatio, truncated };
}

function textBox(context, text, x, y, options) {
  const fit = fitText(context, text, options);
  context.textBaseline = 'top';
  fit.lines.forEach((line, index) => context.fillText(line, x, y + index * fit.lineHeight));
  return fit;
}
function rounded(context, x, y, width, height, radius = 14) {
  context.beginPath(); context.roundRect(x, y, width, height, radius); context.fill();
}
function drawContained(context, image, x, y, width, height) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  context.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}
function drawCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
  context.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h); context.restore();
}
function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (!source) return reject(new Error('Imagem não informada.'));
    const image = new Image(); image.crossOrigin = 'anonymous'; image.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => { image.src = ''; reject(new Error('A imagem demorou a carregar.')); }, 9000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('A imagem não permite exportação ou está indisponível.')); };
    image.src = source;
  });
}
function dateLabel(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace('.', '');
}

export async function renderInstagramCard(post, { imageOverride = '', siteUrl = 'https://canneli.github.io/martealma/', style = 'marte' } = {}) {
  const review = hasReviewScore(post), work = workOf(post), warnings = [];
  const theme = cardStyles[style] || cardStyles.marte;
  const logoSource = new URL(`./${style === 'noite' ? 'brand-logo-dark.svg' : 'brand-logo.svg'}?v=2`, import.meta.url).href;
  const markSource = new URL('./brand-mark.svg?v=2', import.meta.url).href;
  const [logo, artwork, mark] = await Promise.all([
    loadImage(logoSource),
    loadImage(imageOverride || (review ? work.image : post.image)).catch(() => null),
    loadImage(markSource),
    Promise.race([document.fonts.load('700 60px Outfit'), new Promise(resolve => setTimeout(resolve, 4500))])
  ]);
  const canvas = document.createElement('canvas'); Object.assign(canvas, CARD_SIZE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador não conseguiu gerar a imagem.');
  context.fillStyle = theme.background; context.fillRect(0, 0, 1080, 1350);
  const lightHeader = style === 'noite';
  context.drawImage(logo, 64, 45, 365, 365 * 80 / 382);
  context.fillStyle = lightHeader ? theme.paper : theme.muted; context.font = '600 24px Outfit, Arial, sans-serif'; context.textAlign = 'right'; context.textBaseline = 'top';
  context.fillText(dateLabel(post.publishedAt), 1016, 82); context.textAlign = 'left';
  context.fillStyle = theme.accent; context.fillRect(64, 151, 952, 7);
  context.fillStyle = lightHeader ? theme.paper : theme.panel; context.font = '800 27px Outfit, Arial, sans-serif';
  const label = review ? `CRÍTICA · ${kindLabels[work.workKind] || 'CULTURA'}${post.revisiting ? ' · REVISITANDO' : ''}` : `NOTÍCIAS${post.category && post.category !== 'Notícias' ? ' · ' + post.category : ''}`;
  textBox(context, label.toLocaleUpperCase('pt-BR'), 64, 190, { width: 952, height: 42, maxSize: 27, minSize: 23 });

  if (review) {
    context.fillStyle = theme.panel; rounded(context, 64, 250, 952, 520, 22);
    if (artwork) drawContained(context, artwork, 92, 275, 896, 470);
    else {
      context.fillStyle = theme.paper; textBox(context, work.workTitle, 125, 400, { width: 830, height: 210, maxSize: 82, minSize: 42 });
      warnings.push('A capa não pôde ser incorporada. Você pode selecionar uma imagem do seu dispositivo para completar a arte.');
    }
    const [background, foreground] = scoreColors(Number(post.reviewScore));
    context.fillStyle = background; rounded(context, 748, 675, 184, 184, 92);
    context.fillStyle = foreground; context.font = `800 ${Number(post.reviewScore) === 100 ? 93 : 112}px Outfit, Arial, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(String(Number(post.reviewScore)), 840, 766); context.textAlign = 'left'; context.textBaseline = 'top';
    context.fillStyle = theme.ink;
    textBox(context, work.workTitle, 64, 815, { width: 650, height: 55, maxSize: 31, minSize: 24, weight: 700 });
    context.fillStyle = theme.muted; textBox(context, [work.artist, work.releaseYear].filter(Boolean).join(' · '), 64, 872, { width: 650, height: 45, maxSize: 25, minSize: 21, weight: 500 });
    context.fillStyle = theme.ink;
    const headline = textBox(context, post.title, 64, 940, { width: 952, height: 245, maxSize: 76, minSize: 39, weight: 800, lineRatio: 1.04 });
    if (headline.truncated) warnings.push('A manchete foi abreviada para caber no template.');
    context.globalAlpha=.12; context.drawImage(mark, 850, 1105, 170, 170); context.globalAlpha=1;
  } else {
    context.fillStyle = theme.panel; rounded(context, 64, 250, 952, 570, 22);
    if (artwork) drawCover(context, artwork, 64, 250, 952, 570);
    else {
      context.globalAlpha=.7; context.drawImage(mark, 365, 375, 350, 350); context.globalAlpha=1;
      warnings.push('A imagem da notícia não pôde ser incorporada. Você pode selecionar uma imagem do seu dispositivo.');
    }
    context.fillStyle = theme.accent; context.fillRect(64, 862, 142, 10);
    context.fillStyle = theme.ink;
    const headline = textBox(context, post.title, 64, 915, { width: 952, height: 280, maxSize: 82, minSize: 40, weight: 800, lineRatio: 1.03 });
    if (headline.truncated) warnings.push('A manchete foi abreviada para caber no template.');
  }
  context.fillStyle = theme.panel; context.fillRect(0, 1255, 1080, 95);
  context.fillStyle = theme.paper; textBox(context, post.author || 'Redação Marte Alma', 64, 1271, { width: 560, height: 32, maxSize: 24, minSize: 20, weight: 700 });
  context.font = '800 20px Outfit, Arial, sans-serif'; context.textAlign = 'right'; context.textBaseline = 'top';
  context.fillText(review ? 'CRÍTICA COMPLETA' : 'NOTÍCIA COMPLETA', 1016, 1275);
  context.font = '500 20px Outfit, Arial, sans-serif'; context.fillText(new URL(siteUrl).host.replace(/^www\./, ''), 1016, 1305); context.textAlign = 'left';
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível criar o PNG.')), 'image/png'));
  return { canvas, blob, warnings, filename: cardFilename(post), review };
}
