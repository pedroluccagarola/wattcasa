/* WattCasa — cálculo (sem tela, sem 3D)
 *
 * Fórmulas:
 *   Aparelho por tempo:   kWh/mês = potência (W) × horas por dia × dias no mês × fator de funcionamento ÷ 1000
 *                         (horas por dia = minutos por dia ÷ 60)
 *   Geladeira:            kWh/mês = consumo mensal de referência (valor publicado; a fonte está no catálogo)
 *   Custo:                R$ = kWh exibido × tarifa
 *
 * Arredondamento (uma regra só, usada em tudo):
 *   - kWh exibido com 1 casa decimal; internamente guardado em DÉCIMOS de kWh (inteiro).
 *   - R$ exibido com 2 casas; internamente guardado em CENTAVOS (inteiro).
 *   - O total vem do valor exato. O valor exibido de cada aparelho vem do "maior resto"
 *     (dentro de resumo()), para a soma dos aparelhos ser exatamente o total exibido.
 *     Linhas de grupo (luzes) e cômodos são a soma dos aparelhos.
 *   - Variações (quanto muda ao mexer em algo) são sempre a variação do TOTAL exibido,
 *     para bater com o medidor.
 *   - Custo exibido = kWh exibido × tarifa (assim a conta confere na calculadora).
 *   - Economia exibida = valor exibido ANTES − valor exibido DEPOIS; economia anual = mensal exibida × 12.
 */
(function (raiz) {
  'use strict';

  var EPS = 1e-9;

  // ---------- arredondamento ----------
  function arredondar(x) { // meio para cima, simétrico, com tolerância ao erro de ponto flutuante
    var s = x < 0 ? -1 : 1, a = Math.abs(x);
    return s * Math.floor(a + 0.5 + EPS);
  }
  function paraDecimos(kwh) { return arredondar(kwh * 10); }
  function paraCentesimos(kwh) { return arredondar(kwh * 100); }

  // Distribui um total inteiro entre valores exatos (na mesma unidade), pelo maior resto.
  // Funciona também com valores negativos. A soma do resultado é sempre igual a "alvo".
  function distribuir(valores, alvo) {
    var base = valores.map(function (v) { return Math.floor(v + EPS); });
    var resto = alvo - base.reduce(function (a, b) { return a + b; }, 0);
    var ordem = valores.map(function (v, i) {
      return { i: i, frac: v - base[i], v: v };
    });
    ordem.sort(function (a, b) {
      if (Math.abs(b.frac - a.frac) > EPS) return b.frac - a.frac;
      if (Math.abs(b.v - a.v) > EPS) return b.v - a.v;
      return a.i - b.i;
    });
    var out = base.slice();
    var k = 0;
    while (resto > 0 && ordem.length) { out[ordem[k % ordem.length].i]++; resto--; k++; }
    k = ordem.length - 1;
    while (resto < 0 && ordem.length) { out[ordem[((k % ordem.length) + ordem.length) % ordem.length].i]--; resto++; k--; }
    return out;
  }

  // ---------- formatação pt-BR ----------
  function milhar(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtInteiroDecimal(inteiro, casas) {
    var neg = inteiro < 0, a = Math.abs(inteiro), p = Math.pow(10, casas);
    var ip = Math.floor(a / p), dp = String(a % p);
    while (dp.length < casas) dp = '0' + dp;
    return (neg ? '−' : '') + milhar(ip) + (casas ? ',' + dp : '');
  }
  function fmtKwh(decimos) { return fmtInteiroDecimal(decimos, 1); }
  function fmtKwh2(centesimos) { return fmtInteiroDecimal(centesimos, 2); }
  function fmtReais(centavos) { return 'R$ ' + fmtInteiroDecimal(centavos, 2); } // espaço que não quebra: "R$" nunca fica sozinho no fim da linha
  function fmtNum(x) { // número de entrada (potência, fator) sem arredondar
    var s = String(x).split('.');
    return milhar(s[0]) + (s[1] ? ',' + s[1] : '');
  }
  // exato (opcional): valor exato da parte; se for zero de verdade mostra "0%", e não "<1%"
  function fmtPct(p, exato) { if (exato != null && exato <= EPS) return '0%'; return p === 0 ? '<1%' : p + '%'; }
  function fmtDecimal(x, casas) { return fmtInteiroDecimal(arredondar(x * Math.pow(10, casas)), casas); }

  // ---------- catálogo e estado ----------
  function mapa(cat) {
    var m = {};
    cat.aparelhos.forEach(function (a) { m[a.id] = a; });
    return m;
  }

  function estadoReferencia(cat) {
    var e = { ligado: {}, uso: {} };
    cat.aparelhos.forEach(function (a) {
      e.ligado[a.id] = true;
      e.uso[a.id] = a.uso ? a.uso.padrao : null;
    });
    return e;
  }

  function copiar(e) { return { ligado: Object.assign({}, e.ligado), uso: Object.assign({}, e.uso) }; }

  function definirUso(cat, e, id, valor) {
    var a = mapa(cat)[id];
    if (!a || !a.uso) return e;
    var u = a.uso;
    var v = Math.min(u.max, Math.max(u.min, valor));
    v = u.min + Math.round((v - u.min) / u.passo) * u.passo; // alinha ao passo
    var n = copiar(e);
    n.uso[id] = v;
    return n;
  }
  function passo(cat, e, id, sentido) { // sentido: +1 aumenta, -1 diminui
    var a = mapa(cat)[id];
    if (!a || !a.uso) return e;
    return definirUso(cat, e, id, e.uso[id] + sentido * a.uso.passo);
  }
  function alternar(cat, e, id) { var n = copiar(e); n.ligado[id] = !e.ligado[id]; return n; }
  function ligar(cat, e, id, v) { var n = copiar(e); n.ligado[id] = !!v; return n; }

  // ---------- consumo de um aparelho ----------
  // Aqui o aparelho é calculado sozinho (decimos = arredondamento simples). Para MOSTRAR na tela,
  // use resumo().itens: lá o valor exibido vem do maior resto e soma o total.
  function detalhe(cat, e, id) {
    var a = mapa(cat)[id];
    var ligado = !!e.ligado[id];
    var d = {
      id: id, nome: a.nome, modelo: a.modelo, ligado: ligado,
      potenciaW: a.potenciaW, dias: a.dias, fator: a.fator
    };
    if (a.modelo === 'consumoMensal') {
      d.minutosDia = null;
      d.kwhMesEmUso = a.consumoMensalKwh;
      d.kwhDiaEmUso = a.consumoMensalKwh / a.dias;
    } else {
      d.valorUso = e.uso[id];
      d.minutosDia = e.uso[id] * a.uso.minutosPorUnidade;
      d.horasDia = d.minutosDia / 60;
      d.kwhDiaEmUso = a.potenciaW * d.horasDia * a.fator / 1000;
      d.kwhMesEmUso = d.kwhDiaEmUso * a.dias;
    }
    d.kwhMes = ligado ? d.kwhMesEmUso : 0;
    d.kwhDia = ligado ? d.kwhDiaEmUso : 0;
    d.decimos = paraDecimos(d.kwhMes);
    d.formula = textoFormula(a, d);
    return d;
  }

  function textoTempo(minutos) {
    if (minutos % 60 === 0) return fmtNum(minutos / 60) + ' h';
    return '(' + fmtNum(minutos) + ' min ÷ 60)';
  }

  // decimos = valor exibido; quando o arredondamento muda o número, mostra antes o valor com 2 casas
  function textoFormula(a, d, decimos) {
    var dec = decimos != null ? decimos : paraDecimos(d.kwhMesEmUso), cent = paraCentesimos(d.kwhMesEmUso);
    var res = (cent !== dec * 10 ? fmtKwh2(cent) + ' ≈ ' : '') + fmtKwh(dec) + ' kWh/mês';
    if (a.modelo === 'consumoMensal') {
      return 'Consumo mensal de referência = ' + res;
    }
    var f = fmtNum(a.potenciaW) + ' W × ' + textoTempo(d.minutosDia) + ' × ' + a.dias + ' dias';
    if (a.fator !== 1) f += ' × ' + fmtNum(a.fator);
    return f + ' ÷ 1000 = ' + res;
  }

  // Corrente só quando é conhecida de verdade, ou calculável (carga resistiva com tensão conhecida).
  function corrente(a) {
    if (a.correnteA != null) return { valor: a.correnteA, origem: 'informada' };
    if (a.carga === 'resistiva' && a.tensaoV != null && a.potenciaW != null) {
      return { valor: a.potenciaW / a.tensaoV, origem: 'calculada: I = P ÷ V' };
    }
    return null;
  }

  // ---------- custo ----------
  function custoCentavos(decimosKwh, tarifa) {
    return arredondar(decimosKwh * tarifa * 10); // (décimos ÷ 10) kWh × tarifa × 100 centavos
  }

  // ---------- resumo da casa ----------
  function resumo(cat, e, opcoes) {
    var tarifa = (opcoes && opcoes.tarifa != null) ? opcoes.tarifa : cat.tarifa.reaisPorKwh;
    var itens = cat.aparelhos.map(function (a) { return detalhe(cat, e, a.id); });
    var totalExato = itens.reduce(function (s, d) { return s + d.kwhMes; }, 0);
    var totalDecimos = paraDecimos(totalExato);

    // valor exibido de cada aparelho: maior resto entre os ligados, somando o total exibido
    var comConsumo = itens.filter(function (d) { return d.kwhMes > EPS; });
    var dist = distribuir(comConsumo.map(function (d) { return d.kwhMes * 10; }), totalDecimos);
    comConsumo.forEach(function (d, k) { d.decimos = dist[k]; });
    itens.forEach(function (d, i) {
      if (d.kwhMes <= EPS) d.decimos = 0;
      if (d.ligado) d.formula = textoFormula(cat.aparelhos[i], d, d.decimos);
    });

    // linhas por grupo (luzes juntas), só as que têm consumo, em ordem decrescente; valor = soma dos aparelhos
    var porGrupo = {}, decGrupo = {};
    cat.aparelhos.forEach(function (a, i) {
      var g = a.grupo || a.id;
      porGrupo[g] = (porGrupo[g] || 0) + itens[i].kwhMes;
      decGrupo[g] = (decGrupo[g] || 0) + itens[i].decimos;
    });
    var grupos = Object.keys(porGrupo).filter(function (g) { return porGrupo[g] > EPS; });
    grupos.sort(function (x, y) { return porGrupo[y] - porGrupo[x]; });
    var exatosG = grupos.map(function (g) { return porGrupo[g]; });
    var decimosG = grupos.map(function (g) { return decGrupo[g]; });
    var pctG = totalExato > EPS ? distribuir(exatosG.map(function (v) { return v / totalExato * 100; }), 100) : grupos.map(function () { return 0; });
    var linhas = grupos.map(function (g, i) {
      return { grupo: g, nome: cat.grupos[g] || g, kwhExato: exatosG[i], decimos: decimosG[i], pct: pctG[i] };
    });

    // maior aparelho (item, não grupo) — usado no palpite
    var maior = null;
    itens.forEach(function (d) { if (d.kwhMes > EPS && (!maior || d.kwhMes > maior.kwhMes + EPS)) maior = d; });

    return {
      tarifa: tarifa,
      itens: itens,
      totalExato: totalExato,
      totalDecimos: totalDecimos,
      custoCentavos: custoCentavos(totalDecimos, tarifa),
      linhas: linhas,
      maiorAparelho: maior ? maior.id : null,
      maiorGrupo: linhas.length ? linhas[0].grupo : null
    };
  }

  // ---------- ANTES × DEPOIS ----------
  function comparar(cat, antes, depois) {
    var economiaDecimos = antes.totalDecimos - depois.totalDecimos;
    var economiaCentavos = antes.custoCentavos - depois.custoCentavos;
    var mudancas = [];
    antes.itens.forEach(function (a, i) {
      var b = depois.itens[i];
      var mudouUso = a.minutosDia !== b.minutosDia, mudouLigado = a.ligado !== b.ligado;
      if (!mudouUso && !mudouLigado) return;
      mudancas.push({ id: a.id, nome: a.nome, antes: a, depois: b, exato: a.kwhMes - b.kwhMes });
    });
    var dist = distribuir(mudancas.map(function (m) { return m.exato * 10; }), economiaDecimos);
    mudancas.forEach(function (m, i) { m.decimos = dist[i]; });
    mudancas.sort(function (x, y) { return Math.abs(y.exato) - Math.abs(x.exato); }); // maior impacto primeiro (subindo ou descendo)
    return {
      economiaDecimos: economiaDecimos,
      economiaCentavos: economiaCentavos,
      economiaAnualCentavos: economiaCentavos * 12,
      economiaAnualDecimos: economiaDecimos * 12,
      mudancas: mudancas
    };
  }

  // ---------- palpite ----------
  function palpite(res, id) {
    return { escolhido: id, maior: res.maiorAparelho, acertou: id === res.maiorAparelho };
  }

  // ---------- por cômodo (soma dos aparelhos exibidos, então somam o total; % somam 100) ----------
  function porComodo(cat, res) {
    var ordem = [], soma = {}, somaDec = {};
    cat.aparelhos.forEach(function (a, i) {
      if (!(a.comodo in soma)) { soma[a.comodo] = 0; somaDec[a.comodo] = 0; ordem.push(a.comodo); }
      soma[a.comodo] += res.itens[i].kwhMes;
      somaDec[a.comodo] += res.itens[i].decimos;
    });
    var ex = ordem.map(function (c) { return soma[c]; });
    var dec = ordem.map(function (c) { return somaDec[c]; });
    var pct = res.totalExato > EPS ? distribuir(ex.map(function (v) { return v / res.totalExato * 100; }), 100) : ex.map(function () { return 0; });
    return ordem.map(function (c, i) { return { comodo: c, kwhExato: ex[i], decimos: dec[i], pct: pct[i] }; });
  }

  // ---------- consumo que não para (aparelhos que funcionam o dia todo) ----------
  // ehContinuo: o aparelho é, por natureza, de ficar ligado o dia todo (usado nas sugestões e no "Você sabia?").
  function ehContinuo(a) { return a.modelo === 'consumoMensal' || !!(a.uso && a.uso.padrao * a.uso.minutosPorUnidade >= 1440); }
  // continuos: os que AGORA estão ligados o dia todo (desligado ou com menos de 24 h fica de fora)
  function continuos(cat, res) {
    var ids = [], ex = 0, dec = 0;
    cat.aparelhos.forEach(function (a, i) {
      var d = res.itens[i];
      if (!ehContinuo(a) || !d.ligado || (d.minutosDia != null && d.minutosDia < 1440)) return;
      ids.push(a.id); ex += d.kwhMes; dec += d.decimos;
    });
    return { ids: ids, kwhExato: ex, decimos: dec, pct: res.totalExato > EPS ? arredondar(ex / res.totalExato * 100) : 0 };
  }

  // ---------- sugestões de economia, calculadas a partir do estado atual ----------
  // Para cada aparelho ligado com tempo ajustável (e que não seja contínuo): quanto economiza reduzindo
  // 1 passo (ou 2 minutos por banho no chuveiro). Não sugere desligar nada.
  // A economia é a queda do TOTAL exibido (o que o medidor mostraria).
  function sugestoes(cat, e) {
    var lista = [], total = resumo(cat, e).totalDecimos;
    cat.aparelhos.forEach(function (a) {
      if (!a.uso || ehContinuo(a) || !e.ligado[a.id]) return;
      var v = e.uso[a.id], passos = a.uso.unidade === 'min por banho' ? 2 : 1;
      var alvo = Math.max(a.uso.min, v - passos * a.uso.passo);
      if (alvo >= v) return;
      var d0 = detalhe(cat, e, a.id), d1 = detalhe(cat, definirUso(cat, e, a.id, alvo), a.id);
      var dec = total - resumo(cat, definirUso(cat, e, a.id, alvo)).totalDecimos;
      if (dec <= 0) return;
      lista.push({ id: a.id, de: v, para: alvo, decimos: dec, kwhExato: d0.kwhMes - d1.kwhMes });
    });
    lista.sort(function (x, y) { return y.kwhExato - x.kwhExato; });
    return lista;
  }

  // Quanto UM passo do controle muda o total exibido agora (o que o medidor vai mostrar).
  // Usa o passo para baixo; se já está no mínimo, o passo para cima. Devolve décimos (sempre ≥ 0).
  function valorDoPasso(cat, e, id) {
    var a = mapa(cat)[id];
    if (!a || !a.uso) return 0;
    var v = e.uso[id], outro = definirUso(cat, e, id, v > a.uso.min ? v - a.uso.passo : v + a.uso.passo);
    return Math.abs(resumo(cat, e).totalDecimos - resumo(cat, outro).totalDecimos);
  }

  var CALCULO = {
    arredondar: arredondar, paraDecimos: paraDecimos, paraCentesimos: paraCentesimos, distribuir: distribuir,
    fmtKwh: fmtKwh, fmtKwh2: fmtKwh2, fmtReais: fmtReais, fmtNum: fmtNum, fmtPct: fmtPct, fmtDecimal: fmtDecimal,
    estadoReferencia: estadoReferencia, definirUso: definirUso, passo: passo, alternar: alternar, ligar: ligar,
    detalhe: detalhe, corrente: corrente, custoCentavos: custoCentavos, resumo: resumo, comparar: comparar, palpite: palpite,
    porComodo: porComodo, ehContinuo: ehContinuo, continuos: continuos, sugestoes: sugestoes, valorDoPasso: valorDoPasso,
    mapa: mapa
  };

  raiz.WattCasa = raiz.WattCasa || {};
  raiz.WattCasa.calculo = CALCULO;
  if (typeof module !== 'undefined' && module.exports) module.exports = CALCULO;
})(typeof window !== 'undefined' ? window : globalThis);
