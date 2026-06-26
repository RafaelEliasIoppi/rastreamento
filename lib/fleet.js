// Gerador da frota da Brigada Militar (PM/RS).
//
// Produz as viaturas de forma programatica — basta ajustar a especificacao
// (categorias e quantidades) para escalar a frota, sem mexer na simulacao.
// Todas sao type 'policia' (define icone/cor no mapa); `kind` guarda a
// categoria PM. O `seed` (1,2,3...) e usado pela simulacao para escolher a
// rota de patrulha e espalhar as viaturas.

// BPMs de Porto Alegre (CPC) e seus apelidos.
const BPM_MAP = [
  { id: 'RP-1490', name: '9º BPM - Centro',        abbr: '9ºBPM' },
  { id: 'RP-1495', name: '11º BPM - Zona Norte',   abbr: '11ºBPM' },
  { id: 'FT-01',   name: '19º BPM - Zona Leste',   abbr: '19ºBPM' },
  { id: 'ROCAM-01',name: '1º BPM - Zona Sul',      abbr: '1ºBPM' },
  { id: 'VTR-100', name: '20º BPM - Zona Nordeste',abbr: '20ºBPM' },
  { id: 'VTR-101', name: '21º BPM - Extremo Sul',  abbr: '21ºBPM' },
];

/**
 * Gera a frota — exatamente 6 viaturas, uma por BPM de Porto Alegre.
 * @returns {{id,name,type,kind,seed}[]}
 */
function generateFleet() {
  return BPM_MAP.map((bpm, i) => ({
    id: bpm.id,
    name: bpm.name,
    type: 'policia',
    kind: 'radiopatrulha',   // todas sao radiopatrulha PM
    seed: i + 1,
  }));
}

module.exports = { generateFleet, BPM_MAP };
