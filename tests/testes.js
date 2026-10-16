/* WattCasa — testes do cálculo.
 * Rodam no navegador (tests/calculo.html) e no Node (node tests/testes.js).
 * Os valores esperados escritos aqui foram calculados à mão e servem para conferir o código.
 */
(function (raiz) {
  'use strict';
  var NODE = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  var cat = NODE ? require('../js/catalogo.js') : raiz.WattCasa.catalogo;
  var C = NODE ? require('../js/calculo.js') : raiz.WattCasa.calculo;

  var resultados = [];
  function teste(grupo, nome, fn) {
    try { fn(); resultados.push({ grupo: grupo, nome: nome, ok: true }); }
    catch (e) { resultados.push({ grupo: grupo, nome: nome, ok: false, erro: e.message }); }
  }
  function igual(obtido, esperado, msg) {
    if (obtido !== esperado) throw new Error((msg || '') + ' — esperado ' + JSON.stringify(esperado) + ', obtido ' + JSON.stringify(obtido));
  }
  function perto(obtido, esperado, msg) {
    if (Math.abs(obtido - esperado) > 1e-9) throw new Error((msg || '') + ' — esperado ' + esperado + ', obtido ' + obtido);
  }
  function verdade(c, msg) { if (!c) throw new Error(msg || 'condição falsa'); }

  var REF = C.estadoReferencia(cat);
  var R = C.resumo(cat, REF);
  function item(res, id) { return res.itens.filter(function (d) { return d.id === id; })[0]; }

  // 1. Cálculo individual (conferido à mão)
  teste('Individual', 'Chuveiro: 5.500 W × (32 min ÷ 60) × 30 dias ÷ 1000 = 88 kWh', function () {
    perto(item(R, 'chu').kwhMes, 88);
  });
  teste('Individual', 'Ar-condicionado: 800 W × 8 h × 30 dias × 0,5 ÷ 1000 = 96 kWh', function () {
    perto(item(R, 'ac').kwhMes, 96);
  });
  teste('Individual', 'TV: 95 W × 5 h × 30 dias ÷ 1000 = 14,25 kWh; exibido 14,2 (o décimo que sobra vai para a luz do banheiro, 0,48, que tem resto maior)', function () {
    perto(item(R, 'tv').kwhMes, 14.25); igual(C.fmtKwh(item(R, 'tv').decimos), '14,2'); igual(C.fmtKwh(item(R, 'lb').decimos), '0,5');
    igual(item(R, 'tv').formula, '95 W × 5 h × 30 dias ÷ 1000 = 14,25 ≈ 14,2 kWh/mês');
  });
  teste('Individual', 'Micro-ondas: 1.200 W × (20 min ÷ 60) × 30 dias ÷ 1000 = 12 kWh', function () {
    perto(item(R, 'mic').kwhMes, 12);
  });
  teste('Individual', 'Roteador: 10 W × 24 h × 30 dias ÷ 1000 = 7,2 kWh', function () {
    perto(item(R, 'rot').kwhMes, 7.2);
  });
  teste('Individual', 'Geladeira usa o consumo mensal de referência (57 kWh), sem potência × tempo', function () {
    perto(item(R, 'gel').kwhMes, 57); igual(item(R, 'gel').minutosDia, null);
  });
  teste('Individual', 'Consumo diário = consumo mensal ÷ dias (todos os aparelhos)', function () {
    R.itens.forEach(function (d) { perto(d.kwhDia * d.dias, d.kwhMes, d.id); });
  });
  teste('Individual', 'Cada aparelho por tempo bate com P × h × dias × fator ÷ 1000 refeito a partir do catálogo', function () {
    cat.aparelhos.forEach(function (a) {
      if (a.modelo !== 'tempo') return;
      var h = a.uso.padrao * a.uso.minutosPorUnidade / 60;
      perto(item(R, a.id).kwhMes, a.potenciaW * h * a.dias * a.fator / 1000, a.id);
    });
  });
  teste('Individual', 'O resultado escrito na fórmula é o mesmo valor exibido (2 casas antes, só quando o arredondamento muda o número)', function () {
    R.itens.forEach(function (d) {
      var fim = d.formula.split('= ').pop(), cent = C.paraCentesimos(d.kwhMesEmUso);
      igual(fim, (cent !== d.decimos * 10 ? C.fmtKwh2(cent) + ' ≈ ' : '') + C.fmtKwh(d.decimos) + ' kWh/mês', d.id);
    });
    igual(item(R, 'chu').formula.split('= ').pop(), '88,0 kWh/mês');
  });

  // 2. Soma
  teste('Soma', 'Total exato = soma dos 13 aparelhos = 316,73 kWh (conferido à mão)', function () {
    var s = R.itens.reduce(function (a, d) { return a + d.kwhMes; }, 0);
    perto(R.totalExato, s); perto(R.totalExato, 316.73);
  });
  teste('Soma', 'Total exibido = 316,7 kWh (316,73 arredondado)', function () {
    igual(R.totalDecimos, 3167); igual(C.fmtKwh(R.totalDecimos), '316,7');
  });
  teste('Soma', 'Linhas da conta somam exatamente o total exibido', function () {
    igual(R.linhas.reduce(function (a, l) { return a + l.decimos; }, 0), R.totalDecimos);
  });
  teste('Soma', 'Percentuais somam 100%', function () {
    igual(R.linhas.reduce(function (a, l) { return a + l.pct; }, 0), 100);
  });
  teste('Soma', 'Luzes aparecem juntas: 1,2 + 2,4 + 2,4 + 0,48 = 6,48 kWh (exibido 6,5)', function () {
    var l = R.linhas.filter(function (x) { return x.grupo === 'luz'; })[0];
    perto(l.kwhExato, 6.48); igual(l.decimos, 65);
  });

  // 3. Custo
  teste('Custo', 'Tarifa simulada R$ 1,00: 316,7 kWh × R$ 1,00 = R$ 316,70', function () {
    igual(R.custoCentavos, 31670); igual(C.fmtReais(R.custoCentavos), 'R$ 316,70');
  });
  teste('Custo', 'Outra tarifa (R$ 0,85): 316,7 × 0,85 = 269,195 → R$ 269,20', function () {
    igual(C.resumo(cat, REF, { tarifa: 0.85 }).custoCentavos, 26920);
  });
  teste('Custo', 'Custo exibido = kWh exibido × tarifa (confere na calculadora)', function () {
    igual(C.custoCentavos(R.totalDecimos, 1), R.totalDecimos * 10);
  });

  // 4. Alteração de tempo
  teste('Tempo', 'Chuveiro de 8 para 5 min por banho: 4 × 5 = 20 min/dia → 55 kWh', function () {
    var e = C.definirUso(cat, REF, 'chu', 5);
    igual(e.uso.chu, 5); perto(C.detalhe(cat, e, 'chu').kwhMes, 55);
  });
  teste('Tempo', 'Cada passo do chuveiro (1 min por banho) vale 11 kWh/mês', function () {
    var e = C.passo(cat, REF, 'chu', -1);
    perto(C.detalhe(cat, REF, 'chu').kwhMes - C.detalhe(cat, e, 'chu').kwhMes, 11);
  });
  teste('Tempo', 'Limites: não passa do mínimo nem do máximo, e respeita o passo', function () {
    igual(C.definirUso(cat, REF, 'chu', 1).uso.chu, 3);
    igual(C.definirUso(cat, REF, 'chu', 99).uso.chu, 15);
    igual(C.definirUso(cat, REF, 'mic', 17).uso.mic, 15);
    igual(C.passo(cat, C.definirUso(cat, REF, 'ac', 1), 'ac', -1).uso.ac, 1);
  });
  teste('Tempo', 'Geladeira não tem controle de tempo (mudar o uso não faz nada)', function () {
    var e = C.definirUso(cat, REF, 'gel', 5);
    igual(e, REF);
  });
  teste('Tempo', 'Mudar o tempo não altera o estado original (estado novo a cada ação)', function () {
    C.definirUso(cat, REF, 'ac', 4); igual(REF.uso.ac, 8);
  });
  teste('Tempo', 'Padrões do catálogo estão dentro dos limites e alinhados ao passo', function () {
    cat.aparelhos.forEach(function (a) {
      if (!a.uso) return;
      verdade(a.uso.padrao >= a.uso.min && a.uso.padrao <= a.uso.max, a.id + ' fora dos limites');
      igual((a.uso.padrao - a.uso.min) % a.uso.passo, 0, a.id + ' fora do passo');
    });
  });

  // 5. Aparelho desligado
  teste('Desligado', 'Ar-condicionado desligado: consome 0 e o total cai para 220,73 → 220,7 kWh', function () {
    var r = C.resumo(cat, C.ligar(cat, REF, 'ac', false));
    perto(item(r, 'ac').kwhMes, 0); perto(r.totalExato, 220.73); igual(r.totalDecimos, 2207);
  });
  teste('Desligado', 'Aparelho desligado some da lista da conta', function () {
    var r = C.resumo(cat, C.ligar(cat, REF, 'tv', false));
    verdade(!r.linhas.some(function (l) { return l.grupo === 'tv'; }));
  });
  teste('Desligado', 'Casa toda desligada: 0,0 kWh e R$ 0,00, sem linhas', function () {
    var e = REF; cat.aparelhos.forEach(function (a) { e = C.ligar(cat, e, a.id, false); });
    var r = C.resumo(cat, e);
    igual(r.totalDecimos, 0); igual(r.custoCentavos, 0); igual(r.linhas.length, 0); igual(r.maiorAparelho, null);
  });
  teste('Desligado', 'Religar volta exatamente ao valor anterior', function () {
    var e = C.alternar(cat, C.alternar(cat, REF, 'chu'), 'chu');
    igual(C.resumo(cat, e).totalDecimos, R.totalDecimos);
  });

  // 6. ANTES × DEPOIS, economia mensal e anual
  function cenario(mudar) { var e = REF; mudar.forEach(function (m) { e = C.definirUso(cat, e, m[0], m[1]); }); return C.resumo(cat, e); }
  teste('Antes × Depois', 'Banho 8→5 min e ar 8→6 h: economia 33 + 24 = 57,0 kWh', function () {
    var c = C.comparar(cat, R, cenario([['chu', 5], ['ac', 6]]));
    igual(c.economiaDecimos, 570); igual(c.economiaCentavos, 5700);
  });
  teste('Antes × Depois', 'Economia anual = mensal exibida × 12: R$ 57,00 × 12 = R$ 684,00', function () {
    var c = C.comparar(cat, R, cenario([['chu', 5], ['ac', 6]]));
    igual(c.economiaAnualCentavos, 68400); igual(C.fmtReais(c.economiaAnualCentavos), 'R$ 684,00');
  });
  teste('Antes × Depois', '"O que mudou": chuveiro −33,0 e ar −24,0, somando a economia exibida', function () {
    var c = C.comparar(cat, R, cenario([['chu', 5], ['ac', 6]]));
    igual(c.mudancas.length, 2); igual(c.mudancas[0].id, 'chu'); igual(c.mudancas[0].decimos, 330); igual(c.mudancas[1].decimos, 240);
  });
  teste('Antes × Depois', 'Caso com meio décimo: TV 5→4 h (2,85) + luz do quarto 5→4 h (0,24) → 2,9 + 0,2 = 3,1', function () {
    var c = C.comparar(cat, R, cenario([['tv', 4], ['lq', 4]]));
    igual(c.economiaDecimos, 31);
    var tv = c.mudancas.filter(function (m) { return m.id === 'tv'; })[0], lq = c.mudancas.filter(function (m) { return m.id === 'lq'; })[0];
    igual(tv.decimos, 29); igual(lq.decimos, 2);
  });
  teste('Antes × Depois', 'Sem mudança: economia 0 e nenhuma linha', function () {
    var c = C.comparar(cat, R, C.resumo(cat, REF));
    igual(c.economiaDecimos, 0); igual(c.mudancas.length, 0);
  });
  teste('Antes × Depois', 'Conta que sobe: AC 8→12 h dá economia negativa (−48,0 kWh)', function () {
    var c = C.comparar(cat, R, cenario([['ac', 12]]));
    igual(c.economiaDecimos, -480); igual(C.fmtKwh(c.economiaDecimos), '−48,0');
  });
  teste('Antes × Depois', 'Meta de −20% só mudando o tempo: banho 8→5 min + ar 8→5 h', function () {
    var depois = cenario([['chu', 5], ['ac', 5]]);
    verdade(depois.totalExato <= R.totalExato * 0.8, 'não atingiu −20%: ' + depois.totalExato);
  });

  // 7. Arredondamento
  teste('Arredondamento', 'Meio arredonda para cima: 13,5 → 14; −13,5 → −14', function () {
    igual(C.arredondar(13.5), 14); igual(C.arredondar(-13.5), -14);
  });
  teste('Arredondamento', 'Erro de ponto flutuante não engana: 1,35 → 1,4; 2,16 → 2,2; 14,25 → 14,3', function () {
    igual(C.paraDecimos(1.35), 14); igual(C.paraDecimos(2.16), 22); igual(C.paraDecimos(0.1 + 0.2), 3); igual(C.paraDecimos(14.25), 143);
  });
  teste('Arredondamento', 'Maior resto: soma sempre o alvo (inclusive com negativos)', function () {
    igual(C.distribuir([1.35, 2.16, 1.35].map(function (v) { return v * 10; }), 49).reduce(function (a, b) { return a + b; }, 0), 49);
    igual(C.distribuir([-12.5, 3.4], -9).reduce(function (a, b) { return a + b; }, 0), -9);
  });
  teste('Arredondamento', 'Formatação pt-BR (entre R$ e o valor vai um espaço que não quebra a linha)', function () {
    igual(C.fmtKwh(3163), '316,3'); igual(C.fmtReais(123456), 'R$ 1.234,56'); igual(C.fmtReais(5), 'R$ 0,05');
    igual(C.fmtKwh2(31625), '316,25'); igual(C.fmtNum(5500), '5.500'); igual(C.fmtNum(0.5), '0,5'); igual(C.fmtPct(0), '<1%');
  });
  teste('Arredondamento', 'Porcentagem: parte que é zero de verdade mostra "0%"; parte pequena mas maior que zero mostra "<1%"', function () {
    igual(C.fmtPct(0, 0), '0%'); igual(C.fmtPct(0, 0.3), '<1%'); igual(C.fmtPct(27, 80.4), '27%');
  });

  // 8. Valores exibidos = cálculos (300 casas aleatórias, sorteio fixo para repetir igual)
  var semente = 20261006;
  function aleatorio() { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; }
  function casaAleatoria() {
    var e = REF;
    cat.aparelhos.forEach(function (a) {
      if (aleatorio() < 0.2) e = C.ligar(cat, e, a.id, false);
      if (a.uso) e = C.definirUso(cat, e, a.id, a.uso.min + Math.floor(aleatorio() * ((a.uso.max - a.uso.min) / a.uso.passo + 1)) * a.uso.passo);
    });
    return e;
  }
  teste('Exibido = calculado', '300 casas aleatórias: linhas somam o total, nenhuma linha difere do exato em mais de 0,1, % soma 100', function () {
    for (var n = 0; n < 300; n++) {
      var r = C.resumo(cat, casaAleatoria());
      igual(r.totalDecimos, C.paraDecimos(r.totalExato));
      if (r.linhas.length) {
        igual(r.linhas.reduce(function (a, l) { return a + l.decimos; }, 0), r.totalDecimos);
        igual(r.linhas.reduce(function (a, l) { return a + l.pct; }, 0), 100);
      }
      r.linhas.forEach(function (l) { verdade(Math.abs(l.decimos - l.kwhExato * 10) < 1 + 1e-9, 'linha longe do exato'); });
      igual(r.custoCentavos, C.custoCentavos(r.totalDecimos, 1));
    }
  });
  teste('Exibido = calculado', '300 comparações: "o que mudou" soma a economia; R$ = antes − depois; ano = mês × 12', function () {
    for (var n = 0; n < 300; n++) {
      var a = C.resumo(cat, casaAleatoria()), b = C.resumo(cat, casaAleatoria()), c = C.comparar(cat, a, b);
      igual(c.mudancas.reduce(function (s, m) { return s + m.decimos; }, 0), c.economiaDecimos);
      igual(c.economiaCentavos, a.custoCentavos - b.custoCentavos);
      igual(c.economiaAnualCentavos, c.economiaCentavos * 12);
    }
  });

  // 8b. Consistência entre telas: etiqueta, medidor, conta e Banca usam os mesmos números
  function soma(lista, f) { return lista.reduce(function (s, x) { return s + f(x); }, 0); }
  function passoAleatorio(e) { // um clique: + ou − num aparelho ligado com controle, ou liga/desliga
    var a = cat.aparelhos[Math.floor(aleatorio() * cat.aparelhos.length)];
    if (a.uso && e.ligado[a.id] && aleatorio() < 0.7) return { id: a.id, e: C.passo(cat, e, a.id, aleatorio() < 0.5 ? -1 : 1) };
    return { id: a.id, e: C.alternar(cat, e, a.id) };
  }
  teste('Consistência', 'Etiqueta = linha da conta: aparelho sozinho no grupo tem o mesmo valor; grupo (luzes) = soma dos aparelhos (300 casas)', function () {
    for (var n = 0; n < 300; n++) {
      var r = C.resumo(cat, casaAleatoria());
      r.linhas.forEach(function (l) {
        var doGrupo = r.itens.filter(function (d, i) { return (cat.aparelhos[i].grupo || cat.aparelhos[i].id) === l.grupo; });
        igual(l.decimos, soma(doGrupo, function (d) { return d.decimos; }), 'grupo ' + l.grupo);
        if (doGrupo.length === 1) igual(doGrupo[0].decimos, l.decimos, 'aparelho ' + l.grupo);
      });
    }
  });
  teste('Consistência', 'Soma dos aparelhos = soma das linhas = soma dos cômodos = total exibido; cada aparelho a até 0,1 do exato (300 casas)', function () {
    for (var n = 0; n < 300; n++) {
      var r = C.resumo(cat, casaAleatoria());
      igual(soma(r.itens, function (d) { return d.decimos; }), r.totalDecimos, 'aparelhos');
      igual(soma(r.linhas, function (l) { return l.decimos; }), r.totalDecimos, 'linhas');
      igual(soma(C.porComodo(cat, r), function (c) { return c.decimos; }), r.totalDecimos, 'cômodos');
      r.itens.forEach(function (d) { verdade(Math.abs(d.decimos - d.kwhMes * 10) < 1 + 1e-9, d.id + ' longe do exato'); if (!d.ligado) igual(d.decimos, 0, d.id); });
    }
  });
  teste('Consistência', 'Delta do medidor = soma das mudanças; num clique só, a única mudança = delta do medidor (500 cliques)', function () {
    for (var n = 0; n < 500; n++) {
      var e = casaAleatoria(), p = passoAleatorio(e), a = C.resumo(cat, e), b = C.resumo(cat, p.e), c = C.comparar(cat, a, b);
      igual(c.economiaDecimos, a.totalDecimos - b.totalDecimos);
      igual(soma(c.mudancas, function (m) { return m.decimos; }), a.totalDecimos - b.totalDecimos);
      if (c.mudancas.length) { igual(c.mudancas.length, 1); igual(c.mudancas[0].id, p.id); }
    }
  });
  teste('Consistência', 'Dica "cada passo a menos" = o que o medidor vai mostrar ao apertar − (500 casas)', function () {
    for (var n = 0; n < 500; n++) {
      var e = casaAleatoria(), a = cat.aparelhos[Math.floor(aleatorio() * cat.aparelhos.length)];
      if (!a.uso || e.uso[a.id] <= a.uso.min) continue;
      igual(C.valorDoPasso(cat, e, a.id), C.resumo(cat, e).totalDecimos - C.resumo(cat, C.passo(cat, e, a.id, -1)).totalDecimos, a.id);
    }
  });
  teste('Consistência', 'Sugestões da conta = queda do total exibido (o que o medidor mostraria) (300 casas)', function () {
    for (var n = 0; n < 300; n++) {
      var e = casaAleatoria(), t = C.resumo(cat, e).totalDecimos;
      C.sugestoes(cat, e).forEach(function (s) { igual(s.decimos, t - C.resumo(cat, C.definirUso(cat, e, s.id, s.para)).totalDecimos, s.id); });
    }
  });

  // 9. Palpite
  teste('Palpite', 'Na casa de referência o maior é o ar-condicionado (96,0 contra 88,0 do chuveiro)', function () {
    igual(R.maiorAparelho, 'ac'); igual(C.palpite(R, 'ac').acertou, true); igual(C.palpite(R, 'chu').acertou, false);
  });
  teste('Palpite', 'Com o ar em 6 h (72,0), o chuveiro (88,0) passa a ser o maior', function () {
    igual(cenario([['ac', 6]]).maiorAparelho, 'chu');
  });

  // 9b. Dados da conta (cômodos, consumo contínuo, sugestões)
  teste('Conta', 'Cômodos: Sala 45,45 · Cozinha 71,4 · Quarto 104,4 · Banheiro 95,48 → exibidos (maior resto) 45,4 / 71,4 / 104,4 / 95,5', function () {
    var c = {}; C.porComodo(cat, R).forEach(function (x) { c[x.comodo] = x; });
    perto(c.Sala.kwhExato, 45.45); perto(c.Cozinha.kwhExato, 71.4); perto(c.Quarto.kwhExato, 104.4); perto(c.Banheiro.kwhExato, 95.48);
    igual(c.Sala.decimos, 454); igual(c.Cozinha.decimos, 714); igual(c.Quarto.decimos, 1044); igual(c.Banheiro.decimos, 955);
  });
  teste('Conta', 'Cômodos: % pelo maior resto = 14 / 23 / 33 / 30 (soma 100)', function () {
    var c = {}; C.porComodo(cat, R).forEach(function (x) { c[x.comodo] = x.pct; });
    igual(c.Sala, 14); igual(c.Cozinha, 23); igual(c.Quarto, 33); igual(c.Banheiro, 30);
  });
  teste('Conta', 'Cômodos sempre somam o total exibido e 100% (300 casas aleatórias)', function () {
    for (var n = 0; n < 300; n++) {
      var r = C.resumo(cat, casaAleatoria()), c = C.porComodo(cat, r);
      igual(c.reduce(function (s, x) { return s + x.decimos; }, 0), r.totalDecimos);
      if (r.totalExato > 0) igual(c.reduce(function (s, x) { return s + x.pct; }, 0), 100);
    }
  });
  teste('Conta', 'Consumo que não para = geladeira 57 + roteador 7,2 = 64,2 kWh (20% da casa)', function () {
    var b = C.continuos(cat, R);
    igual(b.ids.sort().join(','), 'gel,rot'); igual(b.decimos, 642); igual(b.pct, 20);
  });
  teste('Conta', 'Consumo que não para só conta o que está ligado o dia todo AGORA (roteador em 1 h ou desligado sai; tudo desligado = nada)', function () {
    var b1 = C.continuos(cat, C.resumo(cat, C.definirUso(cat, REF, 'rot', 1)));
    igual(b1.ids.join(','), 'gel'); igual(b1.decimos, 570);
    var b2 = C.continuos(cat, C.resumo(cat, C.ligar(cat, REF, 'gel', false)));
    igual(b2.ids.join(','), 'rot');
    var e = REF; cat.aparelhos.forEach(function (a) { e = C.ligar(cat, e, a.id, false); });
    var b3 = C.continuos(cat, C.resumo(cat, e));
    igual(b3.ids.length, 0); igual(b3.decimos, 0); igual(b3.pct, 0);
  });
  teste('Antes × Depois', '"O que mudou" em ordem de impacto, subindo ou descendo: ar +48,0 vem antes do chuveiro −33,0', function () {
    var c = C.comparar(cat, R, cenario([['chu', 5], ['ac', 12]]));
    igual(c.mudancas[0].id, 'ac'); igual(c.mudancas[1].id, 'chu');
  });
  teste('Conta', 'Sugestões: 1º chuveiro 8→6 min (−22,0), 2º ar 8→7 h (−12,0); nunca geladeira nem roteador', function () {
    var s = C.sugestoes(cat, REF);
    igual(s[0].id, 'chu'); igual(s[0].para, 6); igual(s[0].decimos, 220);
    igual(s[1].id, 'ac'); igual(s[1].para, 7); igual(s[1].decimos, 120);
    verdade(!s.some(function (x) { return x.id === 'gel' || x.id === 'rot'; }));
  });
  teste('Conta', 'Sugestões ignoram aparelho desligado e aparelho já no mínimo', function () {
    var e = C.ligar(cat, C.definirUso(cat, REF, 'chu', 3), 'ac', false), s = C.sugestoes(cat, e);
    verdade(!s.some(function (x) { return x.id === 'chu' || x.id === 'ac'; }));
  });

  // 10. Integridade do catálogo e honestidade dos dados
  teste('Catálogo', 'O catálogo não guarda kWh, R$ nem %', function () {
    cat.aparelhos.forEach(function (a) {
      ['kwhMes', 'kwh', 'custo', 'reais', 'pct'].forEach(function (k) { verdade(!(k in a), a.id + ' guarda ' + k); });
    });
  });
  teste('Catálogo', 'Todo status é "confirmado", "estimado" ou "hipotese", e toda fonte citada existe', function () {
    var ok = ['confirmado', 'estimado', 'hipotese'];
    cat.aparelhos.forEach(function (a) {
      ['potencia', 'uso', 'dias', 'fator', 'consumo'].forEach(function (k) {
        var s = a[k + 'Status'], f = a[k + 'Fonte'];
        if (s != null) verdade(ok.indexOf(s) >= 0, a.id + ' ' + k + ' status ' + s);
        if (f != null) verdade(!!cat.fontes[f], a.id + ' ' + k + ' fonte ' + f);
      });
    });
  });
  teste('Catálogo', 'Nenhuma tensão ou corrente inventada (todas vazias até lermos as etiquetas)', function () {
    cat.aparelhos.forEach(function (a) { igual(a.tensaoV, null, a.id); igual(a.correnteA, null, a.id); igual(C.corrente(a), null, a.id); });
  });
  teste('Catálogo', 'Corrente só é calculada para carga resistiva com tensão conhecida (5.500 W ÷ 220 V = 25 A)', function () {
    perto(C.corrente({ carga: 'resistiva', potenciaW: 5500, tensaoV: 220, correnteA: null }).valor, 25);
    igual(C.corrente({ carga: 'motor', potenciaW: 90, tensaoV: 127, correnteA: null }), null);
  });

  // ----- saída -----
  var ok = resultados.filter(function (r) { return r.ok; }).length;
  var saida = { total: resultados.length, ok: ok, falhas: resultados.length - ok, resultados: resultados };
  raiz.WattCasaTestes = saida;

  if (NODE) {
    // verificação extra só no Node: a página da Banca não pode ter números de consumo digitados no HTML
    var fs = require('fs'), path = require('path');
    var html = fs.readFileSync(path.join(__dirname, '..', 'banca.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '')
      .replace('1 kWh = 1.000 W', ''); // definição da unidade, não é um valor de consumo
    var achou = html.match(/\d+(?:[.,]\d+)?\s*(?:kWh|R\$)|R\$\s*\d/g);
    resultados.push({ grupo: 'Sem números à mão', nome: 'banca.html não tem kWh nem R$ digitados no HTML', ok: !achou, erro: achou ? 'achou: ' + achou.join(' | ') : '' });
    var grupoAtual = '';
    resultados.forEach(function (r) {
      if (r.grupo !== grupoAtual) { grupoAtual = r.grupo; console.log('\n' + r.grupo); }
      console.log((r.ok ? '  ✔ ' : '  ✘ ') + r.nome + (r.ok ? '' : '\n      ' + r.erro));
    });
    var okN = resultados.filter(function (r) { return r.ok; }).length;
    console.log('\n' + okN + ' de ' + resultados.length + ' testes passaram.');
    process.exitCode = okN === resultados.length ? 0 : 1;
  }
})(typeof window !== 'undefined' ? window : globalThis);
