/* WattCasa — música de fundo
 *
 * Gerada pelo próprio navegador (Web Audio), sem arquivo de áudio:
 * funciona offline e não tem direitos autorais de terceiros.
 * Ambiente calmo: acordes suaves + baixo + notas soltas com eco. Volume baixo.
 * O navegador só deixa tocar som depois do primeiro toque do visitante.
 */
(function (raiz) {
  'use strict';
  var BPM = 70, TEMPO = 60 / BPM, VOLUME = 0.5; // VOLUME: troque para deixar mais alto ou mais baixo
  // Fmaj7 → Em7 → Dm7 → Cmaj7 (2 compassos cada); notas em MIDI
  var ACORDES = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
  var ctx = null, mestre = null, eco = null, filtro = null, timer = null;
  var proxima = 0, passo = 0, ligada = true, tocando = false;

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function montar(externo) {
    var AC = raiz.AudioContext || raiz.webkitAudioContext;
    if (!externo && !AC) return false;
    ctx = externo || new AC();
    mestre = ctx.createGain(); mestre.gain.value = 0.0001; mestre.connect(ctx.destination);
    filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1400; filtro.connect(mestre);
    eco = ctx.createDelay(1); eco.delayTime.value = TEMPO * 0.75;
    var volta = ctx.createGain(); volta.gain.value = 0.32;
    var saidaEco = ctx.createGain(); saidaEco.gain.value = 0.35;
    eco.connect(volta); volta.connect(eco); eco.connect(saidaEco); saidaEco.connect(filtro);
    return true;
  }

  function nota(m, t, dur, tipo, vol, ataque, comEco) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(filtro); if (comEco) g.connect(eco);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // um "passo" = colcheia (meio tempo); 8 colcheias por compasso de 4 tempos
  function agendar(t) {
    var compasso = Math.floor(passo / 8), ac = ACORDES[Math.floor(compasso / 2) % ACORDES.length], p = passo % 8;
    if (p === 0 && compasso % 2 === 0) { // acorde: dura 2 compassos
      ac.forEach(function (m, i) { nota(m, t + i * 0.03, TEMPO * 8.2, 'triangle', 0.035, 1.4, false); });
    }
    if (p === 0) nota(ac[0] - 12, t, TEMPO * 3.5, 'sine', 0.09, 0.05, false); // baixo
    if (p === 4) nota(ac[0] - 12 + 7, t, TEMPO * 1.8, 'sine', 0.05, 0.05, false);
    // notas soltas, sem padrão fixo, em cima do acorde
    if (Math.random() < (p % 2 ? 0.22 : 0.42)) {
      var m = ac[Math.floor(Math.random() * ac.length)] + 12 + (Math.random() < 0.25 ? 12 : 0);
      nota(m, t, TEMPO * 1.6, 'sine', 0.045, 0.01, true);
    }
    passo++;
  }

  function relogio() {
    while (proxima < ctx.currentTime + 0.35) { agendar(proxima); proxima += TEMPO / 2; }
  }

  function iniciar() {
    if (!ligada || tocando) return;
    if (!ctx && !montar()) return;
    if (ctx.state === 'suspended') ctx.resume();
    tocando = true; proxima = ctx.currentTime + 0.1;
    mestre.gain.cancelScheduledValues(ctx.currentTime);
    mestre.gain.setValueAtTime(Math.max(0.0001, mestre.gain.value), ctx.currentTime);
    mestre.gain.exponentialRampToValueAtTime(VOLUME, ctx.currentTime + 2.5);
    timer = setInterval(relogio, 100); relogio();
  }
  function parar() {
    if (!tocando) return;
    tocando = false; clearInterval(timer);
    mestre.gain.cancelScheduledValues(ctx.currentTime);
    mestre.gain.setValueAtTime(Math.max(0.0001, mestre.gain.value), ctx.currentTime);
    mestre.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
  }
  // aba escondida: para de agendar (economiza o computador) e volta depois
  document.addEventListener('visibilitychange', function () { if (document.hidden) parar(); else if (ligada && ctx) iniciar(); });

  raiz.WattCasa = raiz.WattCasa || {};
  raiz.WattCasa.musica = {
    iniciar: iniciar,
    alternar: function () { ligada = !ligada; if (ligada) iniciar(); else parar(); return ligada; },
    ligada: function () { return ligada; },
    tocando: function () { return tocando; },
    // só para teste: gera N segundos da música sem tocar e devolve pico e volume médio
    _medir: function (seg) {
      var salvo = [ctx, mestre, eco, filtro, passo], off = new OfflineAudioContext(1, 44100 * seg, 44100);
      montar(off); mestre.gain.value = VOLUME; passo = 0;
      for (var t = 0.05; t < seg - 0.5; t += TEMPO / 2) agendar(t);
      ctx = salvo[0]; mestre = salvo[1]; eco = salvo[2]; filtro = salvo[3]; passo = salvo[4];
      return off.startRendering().then(function (b) {
        var d = b.getChannelData(0), pico = 0, soma = 0;
        for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i]); if (v > pico) pico = v; soma += d[i] * d[i]; }
        return { pico: pico, rms: Math.sqrt(soma / d.length), segundos: seg };
      });
    }
  };
})(window);
