# Rastreamento de Veículos de Emergência

## Sobre
Aplicação web de rastreamento em tempo real de veículos de emergência (ambulância, polícia, bombeiros) com botão de apoio/emergência, posições simuladas via GPS, cálculo de rotas e mapa interativo. Arquitetura **serverless** (Vercel) com banco **Neon Postgres**.

## Como rodar (local)
```bash
npm install
npm start          # roda local-server.js na porta 3000
# Abrir http://localhost:3000
```
> `npm start` → `node local-server.js`. O `local-server.js` emula o roteamento da Vercel: carrega as funções de `api/` dinamicamente (com cache busting) e serve `public/`. Não precisa da Vercel CLI para testar.

Para rodar igual à produção: `npm run dev` (`vercel dev`, exige Vercel CLI + login).

## Variáveis de ambiente
- `DATABASE_URL` — string de conexão Neon Postgres (ver `.env.example`). Sem ela, `/api/vehicles` funciona (simulação), mas emergências falham graciosamente.

## Stack
- **Backend**: Funções serverless Node.js em `api/` (`@vercel/node`), sem framework no deploy. Express só no `local-server.js` para DX local.
- **Banco**: Neon Postgres serverless via `@neondatabase/serverless` (`lib/db.js`). Tabela única `emergencies`.
- **Frontend**: SPA estática — HTML/CSS/JS inline em `public/index.html`. Faz **polling** em `/api/vehicles` (não há mais WebSocket).
- **Mapas**: Leaflet.js 1.9.4 + CartoDB dark tiles. Roteamento: Leaflet Routing Machine + OSRM.
- **Design**: Glassmorphism dark theme com animações CSS.

## Estrutura
- `public/index.html` — SPA completa (HTML + CSS + JS inline)
- `api/health.js` — `GET` healthcheck → `{status:'ok'}`
- `api/vehicles.js` — `GET` posições atuais dos 6 veículos; marca `status:'emergency'` se houver emergência ativa (<30s) no banco
- `api/emergency.js` — `POST` cria emergência (grava posição atual do veículo); `GET` lista últimas 20
- `api/init.js` — `POST` cria a tabela `emergencies` (rodar uma vez após configurar o banco)
- `lib/db.js` — cliente Neon (`sql`)
- `lib/simulation.js` — simulação **determinística** de 6 veículos em São Paulo (curvas de Lissajous baseadas no tempo; mesma posição para um dado timestamp em qualquer invocação serverless). Exporta `getAllVehiclePositions()` e `VEHICLES`
- `local-server.js` — servidor Express local que emula a Vercel
- `vercel.json` — builds (`api/**` serverless, `public/**` estático) e rotas
- `package.json` — deps: `express` (local), `@neondatabase/serverless`

## Convenções importantes
- **Estado é stateless**: cada função serverless é isolada. Nunca guarde estado em memória entre requisições — posições vêm da simulação determinística, o resto vai pro Neon.
- Todo handler em `api/` seta headers CORS e trata `OPTIONS` (preflight) + método inválido (405).
- A tabela `emergencies` é a única fonte persistente; "veículo em emergência" = registro <30s atrás.

## Regras
- UI sempre em Português (Brasil)
- **Visual é prioridade #1** — glassmorphism, animações, efeitos dramáticos
- Cores: azul elétrico `#00d4ff`, vermelho `#ff3b3b`, verde neon `#00ff88`, fundo escuro `#0a0a1a`
- **Sempre usar o agente `rastreamento-dev`** (`.claude/agents/`) para tarefas deste projeto
- Deploy: Vercel + Neon. Commit + push ao final de cada tarefa.
