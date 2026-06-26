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

## Follow-ups conhecidos (FORA do escopo deste plano — não corrigidos aqui)

Levantados no code-review desta sessão. O estado de emergência hoje é **global**
(uma emergência por vez é o caso de uso real). Em cenários de **emergências
sobrepostas** existem arestas a tratar no futuro:

- **`frozenVehicles.clear()` é global:** ao limpar uma emergência, libera TODAS as
  viaturas congeladas — se uma segunda emergência ainda estiver ativa, sua VTR
  solicitante volta a patrulhar cedo. Correção futura: `frozenVehicles.delete(entry.vehicleId)`
  por evento.
- **`respondingUnits` / `expectedResponders` / cleanup são globais:** uma segunda
  emergência reusa o mesmo estado e pode "sequestrar" a limpeza/animação da primeira.
  Correção futura: isolar resposta por emergência (objeto de sessão por evento).
- **Altitude do congelamento:** o "parar para aguardar apoio" é conceito da
  simulação; hoje é um override no frontend (`updateMarkers`). Ideal mover para
  `lib/simulation.js`, para que `/api/vehicles` já emita a posição congelada e
  sectors/Mapa do Medo/ETA fiquem consistentes.
