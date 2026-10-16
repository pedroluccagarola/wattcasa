/* WattCasa — catálogo de aparelhos (SÓ ENTRADAS)
 *
 * Regras deste arquivo:
 * - Guarda apenas dados de entrada: potência, tempo de uso, dias, fator e a origem de cada um.
 * - NUNCA guarda kWh, R$ ou %. Esses valores são sempre calculados por js/calculo.js.
 * - Cada número tem um "status":
 *     'confirmado' = lido na etiqueta/plaqueta de um aparelho real (nenhum ainda);
 *     'estimado'   = valor publicado em tabela de referência (concessionária/Eletrobras), não é um modelo específico;
 *     'hipotese'   = escolha nossa para a simulação, deixada explícita.
 * - Tensão (V) e corrente (A) só são preenchidas quando conhecidas de verdade. Hoje: nenhuma.
 */
(function (raiz) {
  'use strict';

  var FONTES = {
    cemig: {
      nome: 'CEMIG — "Guia Melhor Consumo" (cartilha), tabela de consumo de eletrodomésticos (dados médios)',
      url: 'https://portal.trt3.jus.br/internet/institucional/responsabilidade-socioambiental/download/voce-pode-fazer/GUIA_MELHOR_CONSUMO_CARTILHA_CEMIG.pdf',
      tipo: 'Tabela de concessionária (aparelho típico, não um modelo). A cartilha não informa o ano da tabela.'
    },
    eletrobras: {
      nome: 'Tabela de consumo médio de eletrodomésticos (fonte indicada no documento: eletrobras.gov.br), publicada pela UNESP Rio Claro',
      url: 'https://igce.rc.unesp.br/Home/ComissaoSupervisora-old/ConservacaodeEnergiaCICE/tabela_consumo.pdf',
      tipo: 'Tabela de referência antiga (inclui TVs de tubo); usada só onde ajuda a justificar um valor.'
    },
    equatorial: {
      nome: 'Equatorial Goiás, valores citados em reportagem do Jornal Opção (14/05/2025)',
      url: 'https://www.jornalopcao.com.br/ultimas-noticias/conheca-os-5-eletrodomesticos-que-mais-gastam-energia-706670/',
      tipo: 'Fonte secundária: reportagem que reproduz estimativas da concessionária.'
    },
    canaltech: {
      nome: 'Canaltech — "Geladeira frost free aumenta muito a conta de luz? Fizemos as contas"',
      url: 'https://canaltech.com.br/eletro/geladeira-frost-free-aumenta-muito-a-conta-de-luz-fizemos-as-contas',
      tipo: 'Fonte secundária: reportagem com consumos de modelos do PBE/Inmetro. Usada só como comparação.'
    }
  };

  // Textos sobre a relação entre potência, tensão e corrente, por tipo de carga.
  var CARGAS = {
    resistiva: 'Carga resistiva: P = V × I. Se a plaqueta informar a tensão (127 V ou 220 V), a corrente pode ser calculada por I = P ÷ V.',
    motor: 'Motor: P = V × I × fator de potência. Sem o fator de potência da etiqueta, não calculamos a corrente.',
    compressor: 'Compressor (motor): P = V × I × fator de potência, e a potência varia enquanto ele liga e desliga. Não calculamos a corrente.',
    eletronica: 'Eletrônico com fonte: P = V × I × fator de potência. Sem esse dado da etiqueta, não calculamos a corrente.'
  };

  var APARELHOS = [
    {
      id: 'chu', nome: 'Chuveiro elétrico', comodo: 'Banheiro', grupo: 'chu', carga: 'resistiva', modelo: 'tempo',
      potenciaW: 5500, potenciaStatus: 'estimado', potenciaFonte: 'equatorial',
      potenciaNota: 'Valor de placa na posição mais quente (inverno). Na posição verão a potência é menor, mas não temos esse número de uma fonte.',
      tensaoV: null, correnteA: null,
      uso: {
        unidade: 'min por banho', minutosPorUnidade: 4, padrao: 8, min: 3, max: 15, passo: 1,
        quantidadeTexto: '4 banhos por dia'
      },
      usoStatus: 'hipotese', usoFonte: 'equatorial',
      usoNota: 'A fonte usa 32 min de banho por dia. Dividimos em 4 banhos de 8 min (hipótese: casa com 4 moradores).',
      dias: 30, diasStatus: 'estimado', diasFonte: 'equatorial',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'A resistência aquece a água com potência praticamente constante enquanto o chuveiro está ligado. A fórmula simples (potência × tempo) representa bem.'
    },
    {
      id: 'sec', nome: 'Secador de cabelo', comodo: 'Banheiro', grupo: 'sec', carga: 'resistiva', modelo: 'tempo',
      potenciaW: 1400, potenciaStatus: 'estimado', potenciaFonte: 'cemig',
      potenciaNota: 'A tabela Eletrobras traz o mesmo valor (secador grande, 1.400 W).',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'min por dia', minutosPorUnidade: 1, padrao: 10, min: 5, max: 30, passo: 5 },
      usoStatus: 'estimado', usoFonte: 'eletrobras', usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'eletrobras',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Resistência com motor pequeno. A fórmula simples representa bem; o valor real depende da posição de temperatura escolhida.'
    },
    {
      id: 'ac', nome: 'Ar-condicionado split', comodo: 'Quarto', grupo: 'ac', carga: 'compressor', modelo: 'tempo',
      potenciaW: 800, potenciaStatus: 'estimado', potenciaFonte: 'cemig',
      potenciaNota: 'Linha "split 10.001 a 15.000 BTU/h" da tabela. Varia muito entre modelos (convencional × inverter).',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 8, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig',
      usoNota: 'As três fontes (CEMIG, Equatorial e Eletrobras) usam 8 h por dia para o ar-condicionado.',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 0.5, fatorStatus: 'hipotese', fatorFonte: 'eletrobras',
      fatorNota: 'A tabela Eletrobras lista 1.000 W × 8 h × 30 dias = 120 kWh, que é metade de 240 kWh: ela considera o compressor trabalhando cerca de 50% do tempo. A CEMIG não aplica redução (800 W × 8 h × 30 dias = 192 kWh). Adotamos 50% como hipótese e deixamos isso explícito.',
      avaliacao: 'A fórmula simples superestima: o termostato liga e desliga o compressor, e o modelo inverter reduz a potência. O quanto isso reduz depende do clima e do modelo, por isso usamos um fator de funcionamento.'
    },
    {
      id: 'nb', nome: 'Notebook', comodo: 'Quarto', grupo: 'nb', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 30, potenciaStatus: 'estimado', potenciaFonte: 'cemig', potenciaNota: '',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 8, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig',
      usoNota: 'A tabela informa 30 W e 7,2 kWh/mês em 30 dias, o que corresponde a 8 h por dia.',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'O consumo varia com o uso (tela, processador, bateria carregando). A fórmula simples com a potência média da tabela é uma aproximação aceitável.'
    },
    {
      id: 'lq', nome: 'Luz do quarto', comodo: 'Quarto', grupo: 'luz', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 8, potenciaStatus: 'hipotese', potenciaFonte: 'cemig',
      potenciaNota: '1 lâmpada LED. Os 8 W por lâmpada vêm da tabela; a quantidade de lâmpadas no cômodo é hipótese.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 5, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Lâmpada ligada consome a potência dela o tempo todo. A fórmula simples representa bem.'
    },
    {
      id: 'ls', nome: 'Luz da sala', comodo: 'Sala', grupo: 'luz', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 16, potenciaStatus: 'hipotese', potenciaFonte: 'cemig',
      potenciaNota: '2 lâmpadas LED de 8 W cada. Os 8 W por lâmpada vêm da tabela; a quantidade de lâmpadas no cômodo é hipótese.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 5, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Lâmpada ligada consome a potência dela o tempo todo. A fórmula simples representa bem.'
    },
    {
      id: 'lc', nome: 'Luz da cozinha', comodo: 'Cozinha', grupo: 'luz', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 16, potenciaStatus: 'hipotese', potenciaFonte: 'cemig',
      potenciaNota: '2 lâmpadas LED de 8 W cada. Os 8 W por lâmpada vêm da tabela; a quantidade de lâmpadas no cômodo é hipótese.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 5, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Lâmpada ligada consome a potência dela o tempo todo. A fórmula simples representa bem.'
    },
    {
      id: 'lb', nome: 'Luz do banheiro', comodo: 'Banheiro', grupo: 'luz', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 8, potenciaStatus: 'hipotese', potenciaFonte: 'cemig',
      potenciaNota: '1 lâmpada LED. Os 8 W por lâmpada vêm da tabela; a quantidade de lâmpadas no cômodo é hipótese.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 2, min: 1, max: 12, passo: 1 },
      usoStatus: 'hipotese', usoFonte: 'cemig',
      usoNota: 'A tabela usa 5 h por dia para lâmpadas. No banheiro usamos 2 h (hipótese: o cômodo fica ocupado menos tempo).',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Lâmpada ligada consome a potência dela o tempo todo. A fórmula simples representa bem.'
    },
    {
      id: 'tv', nome: 'TV LED 32"', comodo: 'Sala', grupo: 'tv', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 95, potenciaStatus: 'estimado', potenciaFonte: 'cemig',
      potenciaNota: 'Tamanho e tecnologia mudam muito a potência. A Equatorial estima 30 kWh/mês para uma TV LED de 42" com 5 h por dia, o dobro deste valor.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 5, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'A potência muda um pouco com o brilho da imagem. O consumo em espera (stand-by) não está incluído.'
    },
    {
      id: 'vent', nome: 'Ventilador', comodo: 'Sala', grupo: 'vent', carga: 'motor', modelo: 'tempo',
      potenciaW: 90, potenciaStatus: 'estimado', potenciaFonte: 'cemig',
      potenciaNota: 'Linha "ventilador pequeno/médio". A potência muda com a velocidade escolhida.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 8, min: 1, max: 12, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'O motor funciona direto enquanto está ligado. A fórmula simples representa bem, considerando a velocidade da tabela.'
    },
    {
      id: 'rot', nome: 'Roteador Wi-Fi', comodo: 'Sala', grupo: 'rot', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 10, potenciaStatus: 'estimado', potenciaFonte: 'cemig', potenciaNota: '',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'h por dia', minutosPorUnidade: 60, padrao: 24, min: 1, max: 24, passo: 1 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: 'Ligado o dia inteiro.',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Funciona 24 h com potência pequena e quase constante. A fórmula simples representa bem.'
    },
    {
      id: 'gel', nome: 'Geladeira frost-free', comodo: 'Cozinha', grupo: 'gel', carga: 'compressor', modelo: 'consumoMensal',
      essencial: true,
      potenciaW: null, potenciaStatus: null, potenciaFonte: null,
      potenciaNota: 'Não usamos potência × tempo: o compressor liga e desliga sozinho, então não existe um "tempo de uso" fixo.',
      tensaoV: null, correnteA: null,
      consumoMensalKwh: 57, consumoStatus: 'estimado', consumoFonte: 'equatorial',
      consumoNota: 'Frost-free de 2 portas, funcionando continuamente. Para comparação: a CEMIG lista 50 kWh/mês para geladeira de 2 portas, e uma reportagem com dados do PBE/Inmetro cita modelos frost-free de 35 a 39,4 kWh/mês.',
      uso: null, usoStatus: null, usoFonte: null, usoNota: '',
      dias: 30, diasStatus: 'estimado', diasFonte: 'equatorial',
      fator: null, fatorStatus: null, fatorFonte: null,
      avaliacao: 'Potência × 24 h superestima muito, porque o compressor trabalha só parte do tempo. O jeito correto é usar o consumo mensal medido em laboratório e informado na etiqueta do Inmetro (ENCE).'
    },
    {
      id: 'mic', nome: 'Micro-ondas', comodo: 'Cozinha', grupo: 'mic', carga: 'eletronica', modelo: 'tempo',
      potenciaW: 1200, potenciaStatus: 'estimado', potenciaFonte: 'cemig',
      potenciaNota: 'A tabela Eletrobras traz o mesmo valor.',
      tensaoV: null, correnteA: null,
      uso: { unidade: 'min por dia', minutosPorUnidade: 1, padrao: 20, min: 5, max: 40, passo: 5 },
      usoStatus: 'estimado', usoFonte: 'cemig', usoNota: 'A tabela Eletrobras traz o mesmo tempo.',
      dias: 30, diasStatus: 'estimado', diasFonte: 'cemig',
      fator: 1, fatorStatus: 'estimado', fatorFonte: null,
      avaliacao: 'Potência alta por pouco tempo. A fórmula simples representa bem; em potência reduzida o forno liga e desliga.'
    }
  ];

  var GRUPOS = {
    chu: 'Chuveiro', sec: 'Secador', ac: 'Ar-condicionado', nb: 'Notebook', luz: 'Luzes',
    tv: 'TV', vent: 'Ventilador', rot: 'Roteador Wi-Fi', gel: 'Geladeira', mic: 'Micro-ondas'
  };

  var CATALOGO = {
    versao: '2026-10-06',
    casa: 'Casa de referência fictícia, com 4 moradores (hipótese). Não é a casa do visitante.',
    tarifa: {
      reaisPorKwh: 1.00, status: 'hipotese',
      nome: 'Tarifa simulada',
      texto: 'A tarifa de R$1,00/kWh foi adotada como valor didático para facilitar a visualização dos impactos. Ela pode ser alterada para uma tarifa real para simulações específicas.'
    },
    fontes: FONTES,
    cargas: CARGAS,
    grupos: GRUPOS,
    aparelhos: APARELHOS
  };

  raiz.WattCasa = raiz.WattCasa || {};
  raiz.WattCasa.catalogo = CATALOGO;
  if (typeof module !== 'undefined' && module.exports) module.exports = CATALOGO;
})(typeof window !== 'undefined' ? window : globalThis);
