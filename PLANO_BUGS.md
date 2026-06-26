# Plano de Correção — 5 Bugs Reais (Code Review)

## Status: ✅ CONCLUÍDO — Bugs #1 a #5 corrigidos e validados (endpoints 200; JS inline sem erro de sintaxe)

---

## Bug #1 — ✅ CONCLUÍDO — Onda de Cessão segue linha reta (viola regra "ruas sempre")

> FEITO: criado `api/forecast.js`, rota em `local-server.js:41`, `renderYieldWave()` async
> com fetch + fallback. Validado: 16 pontos sobre ruas, 0 no Guaíba; 404/405/OPTIONS ok.


**Arquivo:** `public/index.html` — função `projectForecast()` (aprox. linha 2278)  
**Problema:** `renderYieldWave()` chama `projectForecast()` que faz interpolação linear
entre posição atual e pontos futuros estimados → linha reta que pode cruzar o Guaíba.  
**Solução:**
1. Criar `api/forecast.js` — endpoint GET `/api/forecast?vehicleId=X&nowMs=Y` que chama
   `calculateForecast(vehicle, nowMs)` de `lib/simulation.js` (já retorna pontos sobre ruas).
2. Adicionar rota em `local-server.js`: `app.all('/api/forecast', wrapHandler('./api/forecast'))`.
3. Em `public/index.html`, reescrever `renderYieldWave(v)` para fazer `fetch('/api/forecast?vehicleId='+v.id+'&nowMs='+Date.now())`
   e usar os pontos retornados no lugar de `projectForecast()`.

**Arquivo `api/forecast.js` a criar:**
```js
const { calculateForecast, VEHICLES } = require('../lib/simulation');
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { vehicleId, nowMs } = req.query;
  const vehicle = VEHICLES.find(v => v.id === vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  const points = calculateForecast(vehicle, parseInt(nowMs) || Date.now());
  return res.status(200).json({ vehicleId, points });
};
```

---

## Bug #2 — ✅ CONCLUÍDO — Polling não dispara Onda de Cessão

> FEITO: no caminho do polling (`setInterval` de `/api/vehicles`), após `showEmergencyAlert` + `playAlertSound`, adicionado `renderYieldWave(v)` (passando o veículo `v`, que tem `.id`).


**Arquivo:** `public/index.html` — função do polling, onde `showEmergencyAlert(v)` é chamado
(aprox. linha 1912, dentro do loop de `updateVehicles` ou similar).  
**Problema:** Quando outra aba/sessão dispara emergência e o polling detecta `status === 'emergency'`,
chama `showEmergencyAlert(v)` mas NÃO chama `renderYieldWave(v)`.  
**Solução:** Adicionar `renderYieldWave(v)` logo após a chamada `showEmergencyAlert(v)` no caminho do polling.

```js
// Onde já existe:
showEmergencyAlert(v);
// Adicionar logo abaixo:
renderYieldWave(v);
```

---

## Bug #3 — ✅ CONCLUÍDO — VTR solicitante continua patrulhando após emergência

> FEITO: criado `const frozenVehicles = new Map()` (id→{lat,lng}); `showEmergencyAlert` congela a solicitante; `updateMarkers` aplica a posição congelada; `finishEmergencyCleanup` faz `frozenVehicles.clear()` ao fim do atendimento.


**Arquivo:** `public/index.html` — `updateMarkers()` e `dismissAlert()`  
**Problema:** A viatura que acionou a emergência continua recebendo posições do polling e seu
marcador se move, afastando-se do ponto de emergência.  
**Solução:** Criar Set `frozenVehicles` que guarda o vehicleId + posição congelada.

```js
// No topo, junto com respondingUnits:
const frozenVehicles = new Map(); // vehicleId -> {lat, lng}

// Em triggerEmergency(), após definir emergencyVehicle:
frozenVehicles.set(emergencyVehicle.id, { lat: emergencyVehicle.lat, lng: emergencyVehicle.lng });

// Em updateMarkers(), antes de atualizar posição:
if (frozenVehicles.has(v.id)) {
  const pos = frozenVehicles.get(v.id);
  v = { ...v, lat: pos.lat, lng: pos.lng }; // override posição
}

// Em dismissAlert() / clearResponse():
frozenVehicles.clear();
```

---

## Bug #4 — ✅ CONCLUÍDO — Ocultar VTRs quebra animação de resposta

> FEITO: removido o early return de `updateMarkers`; agora os respondedores são tratados/criados ANTES do `if (!vtrsVisible) return`, e `toggleVTRs` não oculta marcadores de VTRs em `respondingUnits` — a animação continua visível com a camada desligada.


**Arquivo:** `public/index.html` — função `updateMarkers()` (aprox. linha 2177)  
**Problema:** Quando `!vtrsVisible`, a função retorna cedo e nunca cria marcadores para
veículos em `respondingUnits`. A animação `rAF` tenta mover marcadores que não existem.  
**Solução:** No early return de `!vtrsVisible`, ainda processar os veículos respondendo:

```js
function updateMarkers(vehicles) {
  if (!vtrsVisible) {
    // Mesmo ocultos, manter marcadores dos respondedores para a animação funcionar
    vehicles.forEach(v => {
      if (respondingUnits[v.id] && !markers[v.id]) {
        // criar marcador invisível ou manter visível apenas para respondedores
        const m = L.marker([v.lat, v.lng], { icon: createVehicleIcon(v) });
        m.addTo(map);
        markers[v.id] = m;
      }
    });
    return; // ainda retorna cedo para os demais
  }
  // ... resto normal
}
```

**Alternativa mais simples:** Remover o early return e deixar a lógica de visibilidade
controlar via `marker.setOpacity(vtrsVisible ? 1 : 0)` mas sempre criar o marcador.

---

## Bug #5 — ✅ CONCLUÍDO — Timer de limpeza (12s) corta animação de chegada

> FEITO: `dismissAlert` troca o `setTimeout(12s)` fixo por um poller (500ms) que chama `finishEmergencyCleanup` quando `allRespondersArrived()` OU ao atingir o deadline de 20s. Endurecido contra limpeza prematura: como `routeBetween` é assíncrono, contamos `expectedResponders`/`resolvedResponders` (rotas que falham chamam `cb(null)`) e o atalho de chegada só vale quando TODAS as rotas resolveram. Nova emergência cancela o poller pendente.


**Arquivo:** `public/index.html` — `setTimeout` de cleanup (aprox. linha 2593)  
**Problema:** O timer de 12s pode disparar antes de todos os callbacks OSRM assíncronos
terminarem de criar as animações (delay de até 11s até animação começar).  
**Solução:** Rastrear chegada por unidade; limpar apenas quando todas chegaram OU timeout de 18s.

```js
// Em startResponder(v, route):
respondingUnits[v.id] = { route, arrived: false, animStart: null };

// Na animação, quando chegou ao final:
respondingUnits[v.id].arrived = true;
checkAllArrived();

function checkAllArrived() {
  const all = Object.values(respondingUnits);
  if (all.length > 0 && all.every(u => u.arrived)) {
    clearResponse(); // limpa só quando todos chegaram
  }
}

// Fallback: timeout máximo de 18s (em vez de 12s)
setTimeout(() => clearResponse(), 18000);
```

---

## Ordem de implementação recomendada

1. Bug #5 (mais seguro, só muda timeout e lógica de cleanup)
2. Bug #4 (ajuste em updateMarkers — cuidado para não quebrar visibilidade normal)
3. Bug #3 (adicionar frozenVehicles Map)
4. Bug #2 (uma linha: adicionar renderYieldWave no polling)
5. Bug #1 (maior: criar api/forecast.js + reescrever renderYieldWave para fetch async)

## Depois: commit + push

```bash
git add -A
git commit -m "fix: corrige 5 bugs reais (Onda de Cessão, polling, VTR congelada, animação)"
git push
```

---

## Follow-ups conhecidos — emergências sobrepostas

Levantados no code-review. O estado de emergência é **global** (uma emergência
por vez é o caso de uso real). As arestas de **emergências sobrepostas** foram
tornadas SEGURAS (sem construir um simulador multi-emergência completo):

- ✅ **CONCLUÍDO — `frozenVehicles.clear()` global → `delete` por evento.**
  `showEmergencyAlert` agora registra `currentEmergencyVehicleId` (a solicitante
  daquele atendimento). O `finishEmergencyCleanup` faz `frozenVehicles.delete(currentEmergencyVehicleId)`
  em vez de `.clear()`, então limpar um atendimento não descongela a VTR de outra
  emergência ainda ativa. Rede de segurança no polling: VTR congelada que não é a
  atual é liberada por TTL de 30s (mesma janela do backend; vale com/sem banco).
- ✅ **CONCLUÍDO — nova emergência não "sequestra" o atendimento anterior.**
  Decisão: ao iniciar uma nova emergência, `showEmergencyAlert` chama
  `finishResponseVisuals()` (extraída de `finishEmergencyCleanup`) que finaliza
  LIMPAMENTE os visuais da anterior — cancela `cleanupTimer`, apaga rotas/animações
  (`clearResponse`), círculo, radar, painel e onda — SEM descongelar viatura
  alguma. Assim nada da emergência anterior fica órfão, e a VTR solicitante
  anterior permanece congelada (sua emergência pode seguir ativa <30s); ela só é
  liberada por evento (delete) ou pelo TTL de segurança.
- ✅ **CONCLUÍDO — Altitude do congelamento.** O "parar para aguardar apoio" agora
  é aplicado UMA vez no ponto de entrada dos dados, em vez de só no marcador.

  **Investigação (fatos):**
  - `/api/sectors` deriva de `routes.json` + `generateFleet()` — setores são
    polígonos FIXOS de patrulha, não usam posição corrente. Não havia
    inconsistência ali (a viatura andar não muda o setor).
  - `lib/coverage.js` é puro (recebe `vehicles`), mas NÃO é chamado por nenhum
    endpoint. O "Mapa do Medo" real roda 100% no frontend (`medoRisk`), iterando
    sobre a variável global `vehicles` — que era a resposta CRUA de `/api/vehicles`
    (posição de patrulha), enquanto o marcador aparecia congelado. Mesma coisa para
    ETA e lista lateral. **Essa** era a inconsistência real, e ela ocorria com OU
    sem banco.
  - Mover o freeze só para `api/vehicles.js` NÃO resolveria, porque (a) sem banco o
    backend não conhece a emergência e (b) os derivados do frontend leem a `vehicles`
    global, não o override do marcador.

  **Solução (mínima, cobre os dois modos):**
  - Frontend (`public/index.html`, polling): o congelamento (`frozenVehicles`) é
    aplicado UMA vez sobre os dados recebidos, gerando a `vehicles` global já
    congelada (`lat/lng` no local do chamado + `status:'emergency'`). Assim
    marcadores, Mapa do Medo, ETA e lista compartilham EXATAMENTE a mesma posição.
    A detecção de nova emergência roda antes, sobre os dados crus, para o local do
    chamado ser a posição real do momento. O override duplicado em `updateMarkers`
    foi removido.
  - Backend (`api/vehicles.js`, só COM banco): o SELECT de emergências ativas (<30s)
    agora traz `lat,lng` e o endpoint emite a posição CONGELADA (não a de patrulha).
    Garante consistência até para um cliente recém-carregado durante a emergência.
  - **Modo sem banco intacto:** `isConfigured=false` faz `vehicles.js` retornar antes
    do bloco SQL; o freeze do frontend continua sendo a fonte de verdade.

  Validado: `/api/health`, `/api/vehicles`, `/api/sectors`, home → 200; `node --check`
  e verificação dos scripts inline sem erro de sintaxe.
