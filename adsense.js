import { MARTE_ALMA } from './firebase-config.js';
// O editor e as prévias locais nunca solicitam anúncios.
export function enableAds() {
  const client = MARTE_ALMA.adsenseClient;
  if (!/^ca-pub-\d{16}$/.test(client || '') || location.hostname === 'localhost' || location.hostname === '127.0.0.1' || document.querySelector('#adsense-loader')) return;
  const script = document.createElement('script');
  script.id = 'adsense-loader'; script.async = true; script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + client;
  document.head.appendChild(script);
}
