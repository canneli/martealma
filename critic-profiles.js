const profiles = {
  'felip0fonseca@gmail.com': {
    name: 'Felipe R. Fonseca',
    role: 'Fundador e editor',
    bio: 'Felipe R. Fonseca é fundador e editor do Marte Alma. Escreve sobre música, cinema e cultura pop com atenção ao contexto, à personalidade da obra e ao que sobra depois dos créditos.'
  },
  'poulldark@gmail.com': {
    name: 'Paulo Silva',
    role: 'Crítico colaborador',
    bio: 'Paulo Silva é crítico colaborador do Marte Alma. No site, assina textos de música, cinema e cultura pop a partir do seu próprio olhar, sem diluir a opinião numa média sem graça.'
  }
};

export const writerProfiles = Object.values(profiles);
export const profileForEmail = email => profiles[String(email || '').trim().toLowerCase()] || null;
export const profileForPost = post => profileForEmail(post?.authorEmail) || Object.values(profiles).find(profile => profile.name === post?.author) || null;
