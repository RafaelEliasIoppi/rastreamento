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
- `lib/db.js` — cliente Neon (`sql`) + flag `isConfigured` (banco opcional)
- `lib/simulation.js` — simulação **determinística** das 6 viaturas PM. Move cada VTR ao longo de **rotas de rua reais** (interpolação por tempo); mesma posição para um dado timestamp. Exporta `getAllVehiclePositions()`, `calculateForecast()`, `VEHICLES`
- `lib/fleet.js` — **gerador da frota** PM (`generateFleet(spec)`); ajustar quantidade/categorias aqui, não na simulação
- `lib/sectors.js` — **gerador dos setores** de patrulhamento (`generateSectors()`, `sectorForPoint()`); cada setor = área da rota de uma viatura (casco convexo)
- `lib/routes.json` — poligonais de patrulha (geradas por OSRM) que mantêm as VTRs nas ruas, fora do Guaíba
- `lib/build-routes.js` — gerador das rotas (rodar com `node lib/build-routes.js` p/ regerar)
- `lib/coverage.js` — cálculo do "Mapa do Medo" (grid de vulnerabilidade; camada visual ainda pendente)
- `local-server.js` — servidor Express local que emula a Vercel (hot-reload limpa cache de `api/` e `lib/`)
- `start.sh` — sobe local liberando a porta 3000 antes
- `vercel.json` — builds (`api/**` serverless, `public/**` estático) e rotas
- `package.json` — deps: `express` (local), `@neondatabase/serverless`

## Features-assinatura (frontend)
- **Viaturas nas ruas**: NUNCA podem entrar no Lago Guaíba — movem-se sobre `lib/routes.json` (OSRM = caminho mínimo).
- **Resposta à emergência**: botão otimista (funciona sem banco) → as outras VTRs calculam a menor rota OSRM, **percorrem e CHEGAM** ao local; rota é polilinha própria persistente (não some no zoom).
- **Painel de ETA**: ranqueia VTRs por tempo/distância, destaca "MAIS PROXIMA" / "CHEGOU".
- **Onda de Cessão**: corredor verde preditivo à frente da VTR em emergência.

## Convenções importantes
- **Estado é stateless**: cada função serverless é isolada. Nunca guarde estado em memória entre requisições — posições vêm da simulação determinística, o resto vai pro Neon.
- Todo handler em `api/` seta headers CORS e trata `OPTIONS` (preflight) + método inválido (405).
- A tabela `emergencies` é a única fonte persistente; "veículo em emergência" = registro <30s atrás.

## Regras
- **REGRA PRINCIPAL Nº1 — SEMPRE usar o agente `rastreamento-dev`** ([.claude/agents/rastreamento-dev.md](.claude/agents/rastreamento-dev.md)) para QUALQUER tarefa neste projeto. É o agente padrão da sessão (carregado via hook `SessionStart`). Nunca trabalhar sem ele.
- UI sempre em Português (Brasil)
- **Foco operacional: Polícia Militar (Brigada Militar / RS)** — frota de viaturas PM, simulação em **Porto Alegre** (`-30.0346, -51.2177`)
- **Visual é prioridade #2** — glassmorphism, animações, efeitos dramáticos
- Cores: azul elétrico `#00d4ff`, vermelho `#ff3b3b`, verde neon `#00ff88`, fundo escuro `#0a0a1a`
- Banco Neon é **opcional**: sem `DATABASE_URL` a app roda em modo simulação (não quebrar esse fluxo)
- Deploy: Vercel + Neon. Commit + push ao final de cada tarefa.
