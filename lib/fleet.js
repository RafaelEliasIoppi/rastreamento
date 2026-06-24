// Gerador da frota da Brigada Militar (PM/RS).
//
// Produz as viaturas de forma programatica — basta ajustar a especificacao
// (categorias e quantidades) para escalar a frota, sem mexer na simulacao.
// Todas sao type 'policia' (define icone/cor no mapa); `kind` guarda a
// categoria PM. O `seed` (1,2,3...) e usado pela simulacao para escolher a
// rota de patrulha e espalhar as viaturas.

const NATO = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrote', 'Golf', 'Hotel'];

// Especificacao padrao: reproduz a frota atual (6 viaturas).
const DEFAULT_SPEC = [
  { kind: 'radiopatrulha', prefix: 'RP',    label: 'Radiopatrulha', count: 2, numbering: 'serial', start: 1490, step: 5 },
  { kind: 'forca-tatica',  prefix: 'FT',    label: 'Forca Tatica',  count: 2, numbering: 'nato' },
  { kind: 'rocam',         prefix: 'ROCAM', label: 'ROCAM',         count: 1, numbering: 'pad2' },
  { kind: 'comando',       prefix: 'CMD',   label: 'Comando',       count: 1, numbering: 'fixed', suffix: 'CPC' },
];

function nameFor(group, i) {
  switch (group.numbering) {
    case 'serial': {
      const n = group.start + i * (group.step || 1);
      return { id: `${group.prefix}-${n}`, name: `${group.label} ${n}` };
    }
    case 'nato': {
      const n = String(i + 1).padStart(2, '0');
      return { id: `${group.prefix}-${n}`, name: `${group.label} ${NATO[i] || n}` };
    }
    case 'pad2': {
      const n = String(i + 1).padStart(2, '0');
      return { id: `${group.prefix}-${n}`, name: `${group.label} ${n}` };
    }
    case 'fixed':
    default: {
      const n = String(i + 1).padStart(2, '0');
      return { id: `${group.prefix}-${n}`, name: `${group.label} ${group.suffix || n}` };
    }
  }
}

/**
 * Gera a frota a partir de uma especificacao de grupos.
 * @param {Array} spec  grupos de viaturas (default: DEFAULT_SPEC)
 * @returns {{id,name,type,kind,seed}[]}
 */
function generateFleet(spec = DEFAULT_SPEC) {
  const fleet = [];
  let seed = 1;
  for (const group of spec) {
    for (let i = 0; i < group.count; i++) {
      const { id, name } = nameFor(group, i);
      fleet.push({ id, name, type: 'policia', kind: group.kind, seed: seed++ });
    }
  }
  return fleet;
}

module.exports = { generateFleet, DEFAULT_SPEC, NATO };
