/* WattCasa — placar da feira
 *
 * Guarda, só neste computador (localStorage), quantas pessoas abriram a conta hoje
 * e a soma da economia anual SIMULADA delas. Não guarda nada sobre a pessoa.
 * Muda de dia sozinho. Se o navegador bloquear o armazenamento, tudo continua funcionando sem placar.
 */
(function (raiz) {
  'use strict';
  var CHAVE = 'wattcasa.placar';
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function vazio() { return { data: hoje(), visitantes: 0, economiaAnualCentavos: 0 }; }
  function ler() {
    try {
      var p = JSON.parse(raiz.localStorage.getItem(CHAVE) || 'null');
      if (!p || p.data !== hoje() || typeof p.visitantes !== 'number') return vazio();
      return p;
    } catch (e) { return vazio(); }
  }
  function gravar(p) { try { raiz.localStorage.setItem(CHAVE, JSON.stringify(p)); return true; } catch (e) { return false; } }

  // visita = objeto da rodada atual { contada, economia }; economia anual em centavos (só a parte positiva)
  function registrar(visita, anualCentavos) {
    var p = ler(), e = Math.max(0, anualCentavos);
    if (!visita.contada) { p.visitantes += 1; p.economiaAnualCentavos += e; visita.contada = true; visita.numero = p.visitantes; }
    else p.economiaAnualCentavos = Math.max(0, p.economiaAnualCentavos + e - visita.economia); // nunca negativo (ex.: placar zerado no meio da visita)
    visita.economia = e;
    gravar(p);
    return p;
  }

  raiz.WattCasa = raiz.WattCasa || {};
  raiz.WattCasa.placar = { ler: ler, registrar: registrar, zerar: function () { return gravar(vazio()); } };
})(window);
