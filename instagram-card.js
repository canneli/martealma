import { workOf, kindLabels, slugify } from './review-model.js';

export const CARD_SIZE = { width: 1080, height: 1350 };
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

export async function renderInstagramCard(post, { imageOverride = '', siteUrl = 'https://canneli.github.io/martealma/' } = {}) {
  const review = hasReviewScore(post), work = workOf(post), warnings = [];
  const logoSource = new URL('./brand-logo.svg?v=2', import.meta.url).href;
  const [logo, artwork] = await Promise.all([
    loadImage(logoSource),
    loadImage(imageOverride || (review ? work.image : post.image)).catch(() => null),
    Promise.race([document.fonts.load('700 60px Outfit'), new Promise(resolve => setTimeout(resolve, 4500))])
  ]);
  const canvas = document.createElement('canvas'); Object.assign(canvas, CARD_SIZE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este navegador não conseguiu gerar a imagem.');
  context.fillStyle = '#f7f5ef'; context.fillRect(0, 0, 1080, 1350);
  context.drawImage(logo, 64, 45, 390, 390 * 80 / 382);
  context.fillStyle = '#62685f'; context.font = '500 23px Outfit, Arial, sans-serif'; context.textAlign = 'right'; context.textBaseline = 'top';
  context.fillText(dateLabel(post.publishedAt), 1016, 88); context.textAlign = 'left';
  context.fillStyle = '#315f47'; context.fillRect(64, 160, 952, 3);
  context.font = '700 25px Outfit, Arial, sans-serif';
  const label = review ? `CRÍTICA · ${kindLabels[work.workKind] || 'CULTURA'}${post.revisiting ? ' · REVISITANDO' : ''}` : `NOTÍCIAS${post.category && post.category !== 'Notícias' ? ' · ' + post.category : ''}`;
  textBox(context, label.toLocaleUpperCase('pt-BR'), 64, 194, { width: 952, height: 40, maxSize: 25, minSize: 21 });

  if (review) {
    context.fillStyle = '#dfe8dc'; rounded(context, 64, 252, 380, 570);
    if (artwork) drawContained(context, artwork, 78, 266, 352, 542);
    else {
      context.fillStyle = '#315f47'; textBox(context, work.workTitle, 96, 390, { width: 316, height: 250, maxSize: 52, minSize: 32 });
      warnings.push('A capa não pôde ser incorporada. Você pode selecionar uma imagem do seu dispositivo para completar a arte.');
    }
    context.fillStyle = '#232923';
    const workTitle = textBox(context, work.workTitle, 500, 272, { width: 516, height: 220, maxSize: 57, minSize: 34 });
    if (workTitle.truncated) warnings.push('O nome da obra foi abreviado para caber no template.');
    context.fillStyle = '#62685f';
    textBox(context, [work.artist, work.releaseYear].filter(Boolean).join(' · '), 500, 516, { width: 516, height: 78, maxSize: 30, minSize: 22, weight: 500 });
    const [background, foreground] = scoreColors(Number(post.reviewScore));
    context.fillStyle = background; rounded(context, 500, 636, 148, 148, 12);
    context.fillStyle = foreground; context.font = `800 ${Number(post.reviewScore) === 100 ? 78 : 96}px Outfit, Arial, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(String(Number(post.reviewScore)), 574, 713); context.textAlign = 'left'; context.textBaseline = 'top';
    context.fillStyle = '#315f47'; textBox(context, 'NOTA DO CRÍTICO', 674, 662, { width: 342, height: 38, maxSize: 24, minSize: 22 });
    context.fillStyle = '#62685f'; textBox(context, 'de 0 a 100', 674, 709, { width: 342, height: 36, maxSize: 27, minSize: 23, weight: 500 });
    context.fillStyle = '#232923';
    const headline = textBox(context, post.title, 64, 873, { width: 952, height: 210, maxSize: 59, minSize: 33 });
    if (headline.truncated) warnings.push('A manchete foi abreviada para caber no template.');
    context.fillStyle = '#62685f'; textBox(context, post.excerpt, 64, 1110, { width: 952, height: 104, maxSize: 31, minSize: 25, weight: 400 });
  } else {
    context.fillStyle = '#dfe8dc'; rounded(context, 64, 252, 952, 490);
    if (artwork) drawCover(context, artwork, 64, 252, 952, 490);
    else {
      context.fillStyle = '#315f47'; context.drawImage(logo, 180, 427, 720, 720 * 80 / 382);
      warnings.push('A imagem da notícia não pôde ser incorporada. Você pode selecionar uma imagem do seu dispositivo.');
    }
    context.fillStyle = '#aa6b4b'; context.fillRect(64, 782, 76, 7);
    context.fillStyle = '#232923';
    const headline = textBox(context, post.title, 64, 823, { width: 952, height: 290, maxSize: 64, minSize: 34 });
    if (headline.truncated) warnings.push('A manchete foi abreviada para caber no template.');
    context.fillStyle = '#62685f'; textBox(context, post.excerpt, 64, 1133, { width: 952, height: 91, maxSize: 30, minSize: 24, weight: 400 });
  }
  context.fillStyle = '#315f47'; textBox(context, post.author || 'Redação Marte Alma', 64, 1250, { width: 650, height: 31, maxSize: 24, minSize: 20, weight: 600 });
  context.fillStyle = '#dcded5'; context.fillRect(64, 1294, 952, 2);
  context.fillStyle = '#315f47'; context.font = '700 21px Outfit, Arial, sans-serif'; context.textBaseline = 'top';
  context.fillText(review ? 'LEIA A CRÍTICA COMPLETA' : 'LEIA A NOTÍCIA COMPLETA', 64, 1312);
  context.font = '500 21px Outfit, Arial, sans-serif'; context.textAlign = 'right';
  context.fillText(new URL(siteUrl).host.replace(/^www\./, ''), 1016, 1312); context.textAlign = 'left';
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Não foi possível criar o PNG.')), 'image/png'));
  return { canvas, blob, warnings, filename: cardFilename(post), review };
}
