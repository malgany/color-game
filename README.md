# Color Game

Jogo simples de memoria de cores feito com Vite e TypeScript. A cada rodada, uma imagem aparece com uma area transparente; o jogador ajusta matiz, saturacao e brilho para tentar chegar na cor original. No fim, o jogo soma cinco rodadas e pode salvar o placar no ranking.

## Como rodar

Instale as dependencias:

```bash
npm install
```

Rode em modo desenvolvimento:

```bash
npm run dev
```

Por padrao, o Vite abre em `http://localhost:5173`.

Para gerar a build de producao:

```bash
npm run build
```

Para testar a build localmente:

```bash
npm run preview
```

## Configuracao

O projeto funciona sem backend usando os prompts locais e salva scores no `localStorage`. Para usar Supabase, crie um `.env.local` com:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_DEBUG_TOOLS=false
```

O schema do Supabase fica em `supabase/schema.sql`.
