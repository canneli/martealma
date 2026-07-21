# Marte Alma — guia rápido para virar um portal de notícias

## O que este pacote já resolve

- Home mais editorial e responsiva.
- Destaque principal + coluna **Em alta**.
- Grade de **Últimas notícias**.
- Categorias no desktop e barra rolável no celular.
- Busca instantânea.
- Modo claro/escuro.
- Página de matéria com tempo de leitura, linha fina, compartilhamento, matérias relacionadas e JSON-LD `NewsArticle`.
- Markdown sanitizado com DOMPurify.
- Fallback: o site funciona mesmo sem Firebase configurado.
- `admin.html`: painel simples para criar, editar, publicar, salvar rascunho e excluir matérias.

---

## 1. Criar o Firebase

1. Entre no Firebase Console e crie um projeto.
2. Registre um **App Web**.
3. O Firebase vai fornecer um objeto `firebaseConfig`.
4. Abra `firebase-config.js` e substitua os valores `COLE_AQUI` / `SEU-PROJETO`.

O site usa módulos ESM do Firebase diretamente no navegador, o que é prático para esta fase. Para um portal maior, o passo seguinte ideal é migrar para Vite/Astro/Next e instalar o SDK via npm.

---

## 2. Criar o banco de matérias

No Firebase Console:

1. Abra **Firestore Database**.
2. Crie o banco.
3. A coleção usada pelo site se chama exatamente:

`articles`

Você não precisa criar documentos manualmente se usar o `admin.html`; o painel cria os documentos.

### Estrutura de cada matéria

- `title`: título
- `slug`: URL amigável
- `excerpt`: linha fina/resumo
- `category`: Pop, Cinema, Séries ou Críticas
- `author`: autor
- `image`: URL da imagem de capa
- `content`: texto em Markdown
- `tags`: lista de tags
- `featured`: true/false
- `status`: `published` ou `draft`
- `publishedAt`: data/hora de publicação
- `updatedAt`: última atualização

---

## 3. Ativar o login da redação

No Firebase Console:

1. Abra **Authentication**.
2. Ative o provedor **Email/Password**.
3. Crie manualmente o usuário que será o administrador.
4. Coloque o mesmo e-mail em `firebase-config.js`, em `adminEmail`.
5. Coloque o mesmo e-mail em `firestore.rules`, na função `isAdmin()`.

Não coloque uma tela pública de “criar conta de administrador”. Para um site pequeno, é mais seguro criar o usuário pelo console.

---

## 4. Publicar as regras do Firestore

No console do Firestore, abra a aba **Rules/Regras**, substitua pelas regras de `firestore.rules` e publique.

Essas regras deixam o público ler apenas matérias com `status = published` e reservam criação/edição/exclusão ao e-mail do administrador.

---

## 5. Usar o painel de posts

Abra:

`/admin.html`

Faça login e use o formulário.

### Markdown rápido

```md
## Um subtítulo

Texto normal.

**Texto em negrito**

> Uma citação de destaque

[Um link](https://exemplo.com)
```

O painel mostra uma prévia antes de publicar.

---

## 6. Hospedar

A opção mais direta para este projeto é Firebase Hosting.

No terminal, dentro da pasta do site:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```

Quando o `firebase init hosting` perguntar a pasta pública, você pode apontar para a pasta que contém `index.html`, `admin.html` e `firebase-config.js`.

---

## 7. Imagens das matérias

Neste primeiro painel, a capa usa uma **URL de imagem**. Isso deixa o sistema mais simples e barato.

Caminhos bons depois:

- Cloudinary: ótimo para redimensionar/comprimir imagens automaticamente.
- Firebase Storage: integra bem ao Firebase, mas exige configurar upload e regras de Storage.
- Um CMS como Sanity/Storyblok: melhor quando houver vários redatores e fluxo editorial.

---

## 8. O próximo nível para virar um portal “de verdade”

O site atual é uma SPA estática com matérias carregadas do Firestore. Visualmente e funcionalmente já funciona muito bem, mas um portal grande deve evoluir para páginas individuais geradas no servidor ou estaticamente.

### Fase 2 recomendada

**Astro + Firebase/Sanity** é uma combinação excelente para o Marte Alma porque:

- cria uma URL real para cada matéria, como `/pop/nome-da-materia/`;
- melhora SEO e compartilhamento;
- gera sitemap e RSS;
- facilita Google News;
- entrega páginas muito rápidas;
- permite continuar usando praticamente o mesmo design.

### Recursos editoriais que eu adicionaria nessa fase

1. autores com página própria;
2. tags e páginas de assunto;
3. agendamento de publicação;
4. “última atualização” em matérias;
5. galeria de imagens;
6. embeds de YouTube/TikTok/Spotify;
7. newsletter real;
8. comentários, se fizer sentido;
9. sitemap de notícias;
10. painel de SEO com título e descrição específicos;
11. Open Graph para WhatsApp/X/Facebook;
12. analytics e Search Console;
13. fluxo `rascunho → revisão → publicado` para vários redatores.

---

## 9. Uma observação importante sobre SEO

O `index.html` deste pacote já atualiza metadados e inclui JSON-LD de `NewsArticle`, mas como ainda é um site de página única, a melhor arquitetura para SEO jornalístico é gerar uma página HTML real para cada matéria. Por isso, quando o Marte Alma começar a receber volume e depender de Google/Google News, faça a migração para Astro/Next ou outro sistema com rotas reais.
