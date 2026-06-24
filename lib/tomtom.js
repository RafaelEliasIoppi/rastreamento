// Helpers puros para o roteamento com TRANSITO REAL (TomTom Routing API).
//
// A escolha da "menor rota" para a emergencia passa a considerar o
// congestionamento atual: o TomTom devolve travelTimeInSeconds JA com transito
// e trafficDelayInSeconds (atraso causado pelo trafego). Aqui ficam apenas as
// funcoes puras (montar URL / parsear) para serem testaveis sem rede; a chamada
// HTTP e o segredo da chave ficam em api/route.js.

const TOMTOM_BASE = 'https://api.tomtom.com/routing/1/calculateRoute';

/**
 * Monta a URL da Routing API para o trajeto from -> to, com transito ligado.
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {string} key  chave da API (TOMTOM_KEY)
 */
function buildRouteUrl(from, to, key) {
  // TomTom usa ordem lat,lng e pares separados por ":" (encodados no path).
  const loc = `${from.lat},${from.lng}:${to.lat},${to.lng}`;
  const params = new URLSearchParams({
    key,
    traffic: 'true',        // usa dados de transito ao vivo
    travelMode: 'car',
    routeType: 'fastest',   // mais rapido considerando o trafego atual
    routeRepresentation: 'polyline',
  });
  return `${TOMTOM_BASE}/${encodeURIComponent(loc)}/json?${params.toString()}`;
}

/**
 * Normaliza a resposta do TomTom para o formato usado pelo frontend.
 * @returns {{durationSec:number,distanceM:number,trafficDelaySec:number,points:Array<[number,number]>}}
 * @throws se a resposta nao tiver rota
 */
function parseRoute(json) {
  const route = json && json.routes && json.routes[0];
  if (!route || !route.summary) {
    throw new Error('TomTom: resposta sem rota');
  }
  const s = route.summary;
  const points = [];
  for (const leg of route.legs || []) {
    for (const p of leg.points || []) {
      points.push([p.latitude, p.longitude]);
    }
  }
  if (points.length < 2) {
    throw new Error('TomTom: rota sem geometria');
  }
  return {
    durationSec: s.travelTimeInSeconds,
    distanceM: s.lengthInMeters,
    trafficDelaySec: s.trafficDelayInSeconds || 0,
    points,
  };
}

module.exports = { buildRouteUrl, parseRoute, TOMTOM_BASE };
