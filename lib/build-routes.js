// Gerador de rotas de patrulha (rodar uma vez): node lib/build-routes.js
//
// Usa o OSRM para transformar ancoras em avenidas reais de Porto Alegre em
// poligonais que seguem as RUAS. Como o OSRM so roteia sobre a malha viaria,
// nenhuma viatura cai no Lago Guaiba. Saida: lib/routes.json.

const fs = require('fs');
const path = require('path');
const https = require('https');

// Ancoras (lat,lng) sobre avenidas reais, todas em terra (leste do Guaiba).
// Cada loop e fechado: o gerador volta a primeira ancora ao final.
// Cada rota corresponde ao territorio de um BPM em Porto Alegre.
const LOOPS = [
  { id: 'centro', name: '9º BPM - Centro', anchors: [
    [-30.0346, -51.2177], [-30.0400, -51.2200], [-30.0455, -51.2140],
    [-30.0420, -51.2080], [-30.0360, -51.2110],
  ]},
  { id: 'norte', name: '11º BPM - Zona Norte', anchors: [
    [-30.0250, -51.1860], [-30.0120, -51.1760], [-30.0030, -51.1700],
    [-30.0140, -51.1880], [-30.0220, -51.1950],
  ]},
  { id: 'leste', name: '19º BPM - Zona Leste', anchors: [
    [-30.0540, -51.1860], [-30.0640, -51.1720], [-30.0700, -51.1620],
    [-30.0610, -51.1760], [-30.0520, -51.1900],
  ]},
  { id: 'ipiranga', name: '1º BPM - Zona Sul', anchors: [
    [-30.0700, -51.2100], [-30.0800, -51.2000], [-30.0900, -51.1900],
    [-30.0820, -51.1950], [-30.0720, -51.2080],
  ]},
  { id: 'moinhos', name: '20º BPM - Zona Nordeste', anchors: [
    [-30.0100, -51.1500], [-30.0120, -51.1300], [-30.0180, -51.1200],
    [-30.0050, -51.1350], [-30.0020, -51.1450],
  ]},
  { id: 'menino', name: '21º BPM - Extremo Sul', anchors: [
    [-30.1200, -51.1750], [-30.1350, -51.1550], [-30.1500, -51.1400],
    [-30.1400, -51.1600], [-30.1250, -51.1800],
  ]},
];

function osrm(coordsLngLat) {
  const seg = coordsLngLat.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${seg}?overview=full&geometries=geojson`;
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.code !== 'Ok') return reject(new Error('OSRM: ' + j.code));
          resolve(j.routes[0].geometry.coordinates); // [[lng,lat],...]
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const out = [];
  for (const loop of LOOPS) {
    const closed = [...loop.anchors, loop.anchors[0]];          // fecha o loop
    const lngLat = closed.map(([lat, lng]) => [lng, lat]);
    const geom = await osrm(lngLat);                            // [[lng,lat],...]
    const coords = geom.map(([lng, lat]) => [lat, lng]);        // -> [lat,lng]
    out.push({ id: loop.id, name: loop.name, coords });
    console.log(`${loop.id}: ${coords.length} pontos`);
  }
  const dest = path.join(__dirname, 'routes.json');
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log('Salvo em', dest);
})();
