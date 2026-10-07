import { renderInstagramCard, hasReviewScore, cardStyles } from './instagram-card.js?v=2';

export function openInstagramShare(post, siteUrl) {
  document.querySelector('#instagram-dialog')?.close();
  const originalFocus = document.activeElement;
  const dialog = document.createElement('dialog'); dialog.id = 'instagram-dialog'; dialog.className = 'instagram-dialog';
  dialog.setAttribute('aria-labelledby', 'instagram-title');
  dialog.innerHTML = `<div class="instagram-panel"><header><div><p class="eyebrow">FERRAMENTA DA REDAÇÃO</p><h2 id="instagram-title">Post para Instagram</h2></div><button type="button" data-instagram-close aria-label="Fechar prévia">✕</button></header><p class="muted">PNG de feed · 1080 × 1350 · a publicação no Instagram é feita por você.</p><fieldset class="instagram-customize"><legend>Personalizar este card</legend><label>Paleta<select data-instagram-style>${Object.entries(cardStyles).map(([key,value])=>`<option value="${key}">${value.label}</option>`).join('')}</select></label><label class="instagram-upload">Trocar imagem só nesta arte<input type="file" accept="image/png,image/jpeg,image/webp" data-instagram-upload></label></fieldset><div class="instagram-status" role="status" aria-live="polite">Preparando a arte...</div><img class="instagram-preview" alt="Prévia do post para Instagram" hidden><div class="instagram-actions"><button class="primary-button" type="button" data-instagram-download disabled>Baixar PNG</button><button class="primary-button" type="button" data-instagram-native hidden>Compartilhar PNG</button><button class="text-link" type="button" data-instagram-caption>Copiar legenda</button></div></div>`;
  document.body.append(dialog);
  const status = dialog.querySelector('.instagram-status'), preview = dialog.querySelector('.instagram-preview');
  const download = dialog.querySelector('[data-instagram-download]'), native = dialog.querySelector('[data-instagram-native]');
  let result, generation = 0, override = '', style = 'marte', previousOverflow = document.body.style.overflow;
  const urls = new Set();
  const makeUrl = blob => { const url = URL.createObjectURL(blob); urls.add(url); return url; };
  dialog.addEventListener('close', () => {
    generation++; urls.forEach(url => URL.revokeObjectURL(url)); dialog.remove();
    document.body.style.overflow = previousOverflow;
    if (originalFocus?.isConnected) originalFocus.focus();
  }, { once: true });
  dialog.querySelector('[data-instagram-close]').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  async function generate() {
    const run = ++generation; result = null; download.disabled = true; native.hidden = true; preview.hidden = true;
    status.textContent = 'Preparando a arte...';
    try {
      const card = await renderInstagramCard(post, { imageOverride: override, siteUrl, style });
      if (run !== generation || !dialog.open) return;
      result = card; preview.src = makeUrl(card.blob); preview.hidden = false; download.disabled = false;
      status.textContent = card.warnings.length ? card.warnings.join(' ') : 'Arte pronta. Confira a prévia e baixe o PNG.';
      const file = new File([card.blob], card.filename, { type: 'image/png' });
      native.hidden = !navigator.canShare?.({ files: [file] });
    } catch (error) {
      if (run === generation && dialog.open) status.textContent = 'Não foi possível gerar a arte. ' + error.message + ' Tente novamente ou selecione outra imagem.';
    }
  }
  download.onclick = () => {
    if (!result) return;
    const link = document.createElement('a'); link.href = makeUrl(result.blob); link.download = result.filename;
    document.body.append(link); link.click(); link.remove();
  };
  native.onclick = async () => {
    if (!result) return;
    try { await navigator.share({ title: post.title, files: [new File([result.blob], result.filename, { type: 'image/png' })] }); }
    catch (error) { if (error.name !== 'AbortError') status.textContent = 'Seu navegador não conseguiu compartilhar o arquivo. Use Baixar PNG.'; }
  };
  dialog.querySelector('[data-instagram-caption]').onclick = async () => {
    const url = new URL('?artigo=' + encodeURIComponent(post.slug || post.id), siteUrl).href;
    const caption = [post.title, hasReviewScore(post) ? `Nota: ${Number(post.reviewScore)}/100` : '', post.excerpt || '', `Leia no Marte Alma: ${url}`].filter(Boolean).join('\n\n');
    try { await navigator.clipboard.writeText(caption); status.textContent = 'Legenda copiada. O link abre a matéria completa.'; }
    catch { status.textContent = 'Não foi possível copiar automaticamente. Você pode compartilhar o link da matéria pelo botão Copiar link.'; }
  };
  dialog.querySelector('[data-instagram-upload]').onchange = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) { status.textContent = 'Escolha PNG, JPEG ou WebP de até 15 MB.'; return; }
    override = makeUrl(file); generate();
  };
  dialog.querySelector('[data-instagram-style]').onchange = event => { style = event.target.value; generate(); };
  document.body.style.overflow = 'hidden'; dialog.showModal(); generate();
}
