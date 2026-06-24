# Rastreamento PM — Brigada Militar / RS

Rastreamento em tempo real de viaturas da **Polícia Militar (Brigada Militar do RS)** em **Porto Alegre**, com botão de apoio, cálculo de rotas (menor caminho via OSRM) e mapa interativo com tema dark glassmorphism.

## Como rodar

```bash
npm install
npm start          # ou ./start.sh
# abre http://localhost:3000
```

O banco **Neon Postgres é opcional**: sem `DATABASE_URL` a aplicação roda em **modo simulação** (viaturas e botão de emergência funcionam; histórico não persiste). Para persistir, copie `.env.example` para `.env` e preencha `DATABASE_URL`.

## Arquitetura

- **Serverless** (Vercel `@vercel/node`): funções em `api/` (`vehicles`, `emergency`, `init`, `health`).
- **Frontend** SPA estática (`public/index.html`) que faz polling em `/api/vehicles`. Sem WebSocket.
- **Simulação** determinística (`lib/simulation.js`): as viaturas se movem sobre **rotas de rua reais** (`lib/routes.json`, geradas por OSRM) — nunca entram no Lago Guaíba.
- **Roteamento** OSRM: menor rota de cada VTR até a emergência, com ETA e animação de chegada.
- **Banco** Neon Postgres (opcional) para o histórico de emergências.

## Destaques

- Viaturas percorrem ruas reais e **chegam** ao local da emergência.
- Painel de **ETA** ranqueando a viatura mais próxima.
- **Onda de Cessão**: corredor preditivo à frente da viatura.

Deploy: Vercel + Neon.
