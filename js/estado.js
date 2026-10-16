/* WattCasa — estado da experiência
 *
 * Guarda em que fase o visitante está e o estado da casa (ligado / tempo de uso).
 * Toda conta passa por calculo.js; aqui não há fórmula de consumo.
 * Fases: 'intro' → 'palpite' → 'explorar' → 'conta' (e volta para 'explorar').
 */
(function (raiz) {
  'use strict';

  function criarEstado(cat, C) {
    var REF = C.estadoReferencia(cat);
    var RES_REF = C.resumo(cat, REF);
    var ouvintes = [];
    var s = {};

    function avisar(ev) { ouvintes.forEach(function (fn) { fn(ev, s); }); }
    function zerar() {
      s.fase = 'intro';
      s.casa = REF;
      s.resumo = RES_REF;
      s.palpite = null;
      s.selecionado = null;
      s.experimentou = false; // já mudou algum aparelho pelo menos uma vez
    }
    function mudarCasa(nova, id) {
      if (nova === s.casa) return;
      var antes = s.resumo, depois = C.resumo(cat, nova);
      s.casa = nova; s.resumo = depois; s.experimentou = true;
      avisar({
        tipo: 'casa', id: id,
        // diferença do total exibido, em décimos de kWh (é o que o medidor mostra)
        deltaTotal: depois.totalDecimos - antes.totalDecimos,
        antes: antes, depois: depois
      });
    }

    s.referencia = RES_REF;
    s.estadoReferencia = REF;
    s.ouvir = function (fn) { ouvintes.push(fn); };
    // aparelho com o valor exibido (maior resto), o mesmo que aparece na conta
    function itemDe(res, id) { return res.itens.filter(function (d) { return d.id === id; })[0]; }
    s.detalhe = function (id) { return itemDe(s.resumo, id); };
    s.detalheReferencia = function (id) { return itemDe(RES_REF, id); };
    // quanto o aparelho mudou desde o início, como aparece em "o que mudou" na conta (décimos; + = subiu)
    s.mudancaDesdeInicio = function (id) {
      var m = C.comparar(cat, RES_REF, s.resumo).mudancas.filter(function (x) { return x.id === id; })[0];
      return m ? -m.decimos : 0;
    };

    s.entrar = function () { s.fase = 'palpite'; avisar({ tipo: 'fase' }); };
    s.palpitar = function (id) {
      if (s.fase !== 'palpite') return;
      s.palpite = id; s.fase = 'explorar';
      avisar({ tipo: 'palpite', id: id }); avisar({ tipo: 'fase' });
    };
    s.pularPalpite = function () { if (s.fase === 'palpite') { s.fase = 'explorar'; avisar({ tipo: 'fase' }); } };
    s.selecionar = function (id) {
      if (s.fase !== 'explorar') return;
      s.selecionado = id; avisar({ tipo: 'selecao', id: id });
    };
    s.passo = function (id, sentido) {
      if (!s.casa.ligado[id]) return;
      mudarCasa(C.passo(cat, s.casa, id, sentido), id);
    };
    s.alternar = function (id) { mudarCasa(C.alternar(cat, s.casa, id), id); };
    s.verConta = function () { if (s.fase === 'explorar') { s.selecionado = null; s.fase = 'conta'; avisar({ tipo: 'selecao', id: null }); avisar({ tipo: 'fase' }); } };
    s.voltarCasa = function () { if (s.fase === 'conta') { s.fase = 'explorar'; avisar({ tipo: 'fase' }); } };
    s.recomecar = function () { zerar(); avisar({ tipo: 'reinicio' }); avisar({ tipo: 'fase' }); };

    zerar();
    return s;
  }

  raiz.WattCasa = raiz.WattCasa || {};
  raiz.WattCasa.criarEstado = criarEstado;
  if (typeof module !== 'undefined' && module.exports) module.exports = criarEstado;
})(typeof window !== 'undefined' ? window : globalThis);
