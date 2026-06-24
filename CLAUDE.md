# Rastreamento de Veículos de Emergência

## Sobre
Aplicação web de rastreamento em tempo real de veículos de emergência com botão de apoio, cálculo de rotas e comunicação via WebSocket.

## Como rodar
```bash
npm install && node server.js
# Abrir http://localhost:3000
```

## Stack
- Backend: Node.js + Express + Socket.IO (server.js)
- Frontend: HTML/CSS/JS inline (public/index.html)
- Mapas: Leaflet.js 1.9.4 + CartoDB dark tiles
- Roteamento: Leaflet Routing Machine + OSRM
- Design: Glassmorphism dark theme com animações CSS

## Estrutura
- `server.js` — Servidor Express + Socket.IO, simulação de GPS
- `public/index.html` — SPA completa (HTML + CSS + JS inline)
- `package.json` — Dependências (express, socket.io)

## Regras
- UI sempre em Português (Brasil)
- Visual é prioridade #1 — glassmorphism, animações, efeitos dramáticos
- Cores: azul elétrico (#00d4ff), vermelho (#ff3b3b), verde neon (#00ff88), fundo escuro (#0a0a1a)
- Usar agentes especializados para tarefas complexas
