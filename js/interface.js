/* WattCasa — interface (HUD, convites, etiqueta, medidor)
 *
 * Liga estado.js ↔ cena3d.js. Todo número mostrado vem de calculo.js (via estado),
 * e os textos com números são montados a partir desses valores, nunca digitados.
 */
(function () {
  'use strict';
  var W = window.WattCasa, cat = W.catalogo, C = W.calculo;
  function $(id) { return document.getElementById(id); }
  if (!window.THREE) { $('sem-3d').hidden = false; return; }

  var E = W.criarEstado(cat, C);
  var cena;
  try { cena = W.cena.criar($('c'), cat); } catch (err) { $('sem-3d').hidden = false; console.error(err); return; }
  var porId = C.mapa(cat), TARIFA = cat.tarifa.reaisPorKwh;
  var HEROIS = ['ac', 'chu', 'gel', 'tv'];
  var OCIOSO_S = 90, OCIOSO_CONTA_S = 150, AVISO_S = 10; // na conta a pessoa está lendo: espera mais
  var corpo = document.body;

  function rem() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16; }
  function retrato() { return innerHeight >= innerWidth; }
  function deitado() { return !retrato() && innerHeight < 520; } // celular deitado: tela baixa
  // feira = computador do estande (arquivo local). Fora dele (link no celular do visitante) é o "modo web".
  var FEIRA = (location.protocol === 'file:' && !/[?&]web/.test(location.search)) || /[?&]feira/.test(location.search);
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sinal(dec) { return (dec > 0 ? '+' : '') + C.fmtKwh(dec); }
  function comodoDe(id) { return porId[id].comodo.toLowerCase(); }

  // ---------- enquadramento: a casa usa o espaço livre da tela ----------
  cena.margens(function () {
    var r = rem(), Wd = innerWidth, H = innerHeight;
    if (corpo.classList.contains('f-intro')) return retrato() ? { topo: 2 * r, dir: r, base: H * 0.48, esq: r } : { topo: 2 * r, dir: 2 * r, base: 2 * r, esq: Wd * (deitado() ? 0.46 : 0.4) };
    var cv = $('convite').getBoundingClientRect(), et = $('etiqueta'), etOn = et.classList.contains('on'), er = et.getBoundingClientRect();
    if (retrato()) { // casa entre o medidor e o convite; sobe quando a gaveta da etiqueta abre
      var m = $('medidor').getBoundingClientRect(), baixo = etOn ? er.top : (cv.height ? cv.top : H - 6 * r);
      return { topo: m.bottom + 0.6 * r, dir: 0.4 * r, base: Math.max(4 * r, H - baixo + 0.6 * r), esq: 0.4 * r, justo: true };
    }
    if (deitado()) { // casa entre a etiqueta (esquerda) e o medidor (direita)
      var md = $('medidor').getBoundingClientRect(), tp = $('topo').getBoundingClientRect();
      return { topo: tp.bottom + 0.3 * r, dir: Wd - md.left + 0.4 * r, base: etOn ? 0.6 * r : Math.max(3 * r, H - cv.top + 0.4 * r), esq: etOn ? er.right + 0.4 * r : 0.6 * r, justo: true };
    }
    return { topo: 3.4 * r, dir: 4 * r, base: Math.max(5 * r, innerHeight - cv.top + 0.6 * r), esq: 2 * r };
  }, true);

  // ---------- medidor ----------
  $('med-tarifa').textContent = cat.tarifa.nome + ': ' + C.fmtReais(C.arredondar(TARIFA * 100)) + '/kWh · valores estimados';
  var med = { d: 0, c: 0, anim: null };
  function medidor(res, animar) {
    var d0 = med.d, c0 = med.c, d1 = res.totalDecimos, c1 = res.custoCentavos;
    med.d = d1; med.c = c1;
    if (med.anim) cancelAnimationFrame(med.anim);
    var t0 = performance.now(), dur = animar ? 750 : 0;
    (function passo(t) {
      var f = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - f, 3);
      $('med-kwh').textContent = C.fmtKwh(f < 1 ? Math.round(d0 + (d1 - d0) * e) : d1);
      $('med-reais').textContent = C.fmtReais(f < 1 ? C.custoCentavos(Math.round(d0 + (d1 - d0) * e), TARIFA) : c1); // durante a animação o R$ acompanha o kWh mostrado
      if (f < 1) med.anim = requestAnimationFrame(passo);
    })(t0);
    var ligados = cat.aparelhos.filter(function (a) { return E.casa.ligado[a.id]; }).length;
    $('med-uso').innerHTML = 'Aparelhos em uso: <b>' + ligados + ' de ' + cat.aparelhos.length + '</b>';
    var disco = $('medidor').querySelector('.med-disco i').style;
    disco.animationPlayState = d1 ? 'running' : 'paused';
    disco.animationDuration = d1 ? Math.max(0.6, Math.min(8, 6000 / d1)) + 's' : '2s';
  }
  var deltaTimer = null;
  function mostrarDelta(dDec, dCent) {
    var el = $('med-delta');
    if (!dDec) { el.className = ''; return; }
    el.textContent = (dDec < 0 ? '▼ ' : '▲ ') + C.fmtKwh(Math.abs(dDec)) + ' kWh/mês · ' + C.fmtReais(Math.abs(dCent));
    el.className = 'on ' + (dDec < 0 ? 'desce' : 'sobe');
    $('medidor').classList.remove('bate'); void $('medidor').offsetWidth; $('medidor').classList.add('bate');
    clearTimeout(deltaTimer); deltaTimer = setTimeout(function () { el.classList.remove('on'); }, 2600);
  }
  function flutuar(id, dDec) {
    if (!dDec) return;
    var p = cena.posCentro(id), el = document.createElement('div');
    el.className = 'flut ' + (dDec < 0 ? 'desce' : 'sobe');
    el.textContent = sinal(dDec) + ' kWh';
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    $('flutuantes').appendChild(el); setTimeout(function () { el.remove(); }, 1700);
  }

  // ---------- rótulos dos cômodos ----------
  var rotulos = Object.keys(cena.comodos).map(function (k) {
    var c = cena.comodos[k], el = document.createElement('div');
    el.className = 'rotulo'; el.innerHTML = '<i style="background:' + c.cor + '"></i>' + esc(c.nome);
    $('rotulos').appendChild(el); return [k, el];
  });

  // ---------- etiqueta ----------
  function textoUso(a, v) {
    var u = a.uso.unidade;
    if (u === 'h por dia') return C.fmtNum(v) + ' h/dia';
    if (u === 'min por dia') return C.fmtNum(v) + ' min/dia';
    if (u === 'min por banho') return C.fmtNum(v) + ' min/banho';
    return C.fmtNum(v) + ' ' + u;
  }
  function textoPasso(a) {
    var u = a.uso.unidade;
    if (u === 'h por dia') return C.fmtNum(a.uso.passo) + ' h por dia';
    if (u === 'min por banho') return C.fmtNum(a.uso.passo) + ' min em cada banho';
    return C.fmtNum(a.uso.passo) + ' min por dia';
  }
  function htmlEtiqueta(id) {
    var a = porId[id], d = E.detalhe(id), lig = E.casa.ligado[id];
    var cor = cena.comodos[comodoDe(id)].cor, h = '';
    h += '<div class="et-cab"><span class="et-cor" style="background:' + cor + '"></span><div><b>' + esc(a.nome) + '</b><small>' + esc(a.comodo) + '</small></div><button class="et-x" data-a="fechar" aria-label="Fechar">×</button></div>';
    h += '<button class="et-liga ' + (lig ? 'on' : 'off') + '" data-a="liga"><i></i>' + (lig ? 'EM USO' : 'DESLIGADO') + '</button>';
    h += '<div class="et-linha"><span>Potência</span><b>' + (a.potenciaW ? C.fmtNum(a.potenciaW) + ' W' : 'varia') + '</b></div>';
    if (a.uso) {
      var v = E.casa.uso[id];
      h += '<div class="et-linha"><span>Uso</span><div class="et-ctrl"><button data-a="menos" aria-label="Diminuir"' + (!lig || v <= a.uso.min ? ' disabled' : '') + '>−</button><b>' + textoUso(a, v) + '</b><button data-a="mais" aria-label="Aumentar"' + (!lig || v >= a.uso.max ? ' disabled' : '') + '>+</button></div></div>';
      if (a.uso.quantidadeTexto) h += '<span class="et-uso-sub">' + esc(a.uso.quantidadeTexto) + ' = ' + C.fmtNum(d.minutosDia) + ' min/dia</span>';
    } else {
      h += '<div class="et-linha"><span>Uso</span><b>o dia todo</b></div>';
    }
    var mud = E.mudancaDesdeInicio(id);
    h += '<div class="et-consumo"><span>Consumo</span><b>' + C.fmtKwh(d.decimos) + '<small>kWh/mês</small></b></div>';
    h += '<div class="et-mudou ' + (mud < 0 ? 'desce' : 'sobe') + '">' + (mud ? sinal(mud) + ' kWh/mês desde o início' : '') + '</div>';
    if (lig) h += '<div class="et-conta">' + esc(d.formula) + '</div>';
    var nota = '';
    if (!lig) nota = 'Desligado: não entra na conta.';
    else if (!a.uso) nota = 'O motor liga e desliga sozinho, então usamos um consumo mensal de referência (valor estimado; a fonte está na Central da Banca).';
    else {
      nota = 'Cada ' + textoPasso(a) + ' a menos = <b>' + C.fmtKwh(C.valorDoPasso(cat, E.casa, id)) + ' kWh/mês</b> a menos.';
      if (a.fator != null && a.fator !== 1) nota += ' O compressor liga e desliga: contamos ' + C.fmtNum(Math.round(a.fator * 100)) + '% do tempo.';
    }
    h += '<p class="et-nota">' + nota + '</p>';
    if (E.experimentou) h += '<button class="btn-principal et-ver-conta" data-a="conta">VER MINHA CONTA</button>'; // só aparece no celular (CSS)
    return h;
  }
  var etq = $('etiqueta');
  function abrirEtiqueta(id) {
    if (!id) { etq.classList.remove('on'); corpo.classList.remove('etiqueta-on'); return; }
    etq.innerHTML = htmlEtiqueta(id); etq.className = 'on' + (E.casa.ligado[id] ? '' : ' et-off'); corpo.classList.add('etiqueta-on');
    posicionarEtiqueta();
  }
  etq.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b || !E.selecionado) return;
    var id = E.selecionado, a = b.getAttribute('data-a');
    atividade();
    if (a === 'fechar') E.selecionar(null);
    else if (a === 'liga') E.alternar(id);
    else if (a === 'menos') E.passo(id, -1);
    else if (a === 'mais') E.passo(id, +1);
    else if (a === 'conta') E.verConta();
  });
  function posicionarEtiqueta() {
    if (!E.selecionado || retrato() || deitado()) return;
    var p = cena.posAparelho(E.selecionado), r = rem(), w = etq.offsetWidth, h = etq.offsetHeight;
    var conv = $('convite').getBoundingClientRect(), medr = $('medidor').getBoundingClientRect(), topo = $('topo').getBoundingClientRect();
    var baseMax = conv.top - r;
    function testar(x) { // devolve a posição e quanto ela invade o convite
      x = Math.max(r, Math.min(innerWidth - w - r, x));
      var topoMin = (x + w > medr.left - r) ? medr.bottom + 3.4 * r : topo.bottom + 0.8 * r;
      var y = Math.max(topoMin, Math.min(baseMax - h, p.y - h * 0.35));
      return { x: x, y: y, sobra: Math.max(0, y + h - baseMax) };
    }
    var dir = testar(p.x + 2.2 * r), esq = testar(p.x - 2.2 * r - w);
    var pref = p.x < innerWidth * 0.5 ? esq : dir, outra = pref === esq ? dir : esq;
    var o = pref.sobra <= outra.sobra ? pref : outra;
    etq.style.left = o.x + 'px'; etq.style.top = o.y + 'px';
  }

  // ---------- convite (uma chamada por vez) ----------
  var conviteAtual = '';
  function convite() {
    var f = E.fase, t = '', s = '', acao = '', dicas = [], marcas = [];
    if (f === 'palpite') {
      t = 'Qual aparelho você acha que mais pesa na conta?';
      s = 'Toque nele para dar o seu palpite.';
      acao = '<button class="cv-pular" data-a="pular">pular</button>';
      dicas = cena.ids; marcas = HEROIS;
    } else if (f === 'explorar' && !E.experimentou) {
      t = 'Agora toque num aparelho e mude o tempo de uso.';
      s = E.palpite ? 'Palpite guardado: <b>' + esc(porId[E.palpite].nome) + '</b>. A resposta aparece na conta.' : 'Veja o medidor reagir a cada mudança.';
      if (!E.selecionado) { dicas = HEROIS; marcas = HEROIS; }
    } else if (f === 'explorar') {
      t = 'Quer descobrir quanto essa casa gastaria?';
      s = 'Você ainda pode mexer antes de ver.';
      acao = '<button class="btn-principal" data-a="conta">VER MINHA CONTA</button>';
    }
    if (f !== 'intro') cena.dicas(dicas, marcas);
    cena.carta((f === 'explorar' && E.experimentou) || f === 'conta'); // bandeira da caixa de correio: a conta chegou
    var chave = t + '|' + s;
    if (chave === conviteAtual) return;
    conviteAtual = chave;
    $('cv-titulo').textContent = t; $('cv-sub').innerHTML = s; $('cv-acao').innerHTML = acao;
    var cv = $('convite'); cv.classList.remove('troca'); void cv.offsetWidth; cv.classList.add('troca');
    if ((retrato() || deitado()) && E.fase !== 'intro' && !cena.comZoom()) requestAnimationFrame(function () { cena.enquadrar(); });
  }
  $('convite').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return;
    atividade();
    if (b.getAttribute('data-a') === 'pular') E.pularPalpite();
    if (b.getAttribute('data-a') === 'conta') E.verConta();
  });

  // ---------- cena ↔ estado ----------
  cena.aoClicar(function (id) {
    atividade();
    if (E.fase === 'palpite') { if (id) { E.palpitar(id); cena.pulsar(id); som('palpite'); } return; }
    if (E.fase === 'explorar') E.selecionar(id === E.selecionado ? null : id);
  });
  var dica = $('dica-nome');
  cena.aoPassar(function (id, x, y) {
    var mostrar = id && (E.fase === 'palpite' || (E.fase === 'explorar' && id !== E.selecionado));
    dica.style.opacity = mostrar ? 1 : 0;
    if (mostrar) { dica.textContent = porId[id].nome; dica.style.left = x + 'px'; dica.style.top = y + 'px'; }
  });

  E.ouvir(function (ev) {
    if (ev.tipo === 'casa') {
      var li = function (r) { return r.itens.filter(function (d) { return d.id === ev.id; })[0].ligado; };
      som(li(ev.antes) !== li(ev.depois) ? (li(ev.depois) ? 'liga' : 'desliga') : 'passo');
      cena.definirEstado({ ligado: E.casa.ligado, totalKwh: E.resumo.totalExato });
      cena.pulsar(ev.id);
      medidor(E.resumo, true);
      mostrarDelta(ev.deltaTotal, ev.depois.custoCentavos - ev.antes.custoCentavos);
      flutuar(ev.id, ev.deltaTotal); // mesmo número do medidor
      if (E.selecionado) abrirEtiqueta(E.selecionado);
      convite();
    } else if (ev.tipo === 'selecao') {
      cena.selecionar(ev.id); abrirEtiqueta(ev.id); dica.style.opacity = 0; convite();
      if ((retrato() || deitado()) && !cena.comZoom()) cena.enquadrar();
    } else if (ev.tipo === 'reinicio') {
      visita = { contada: false, economia: 0, numero: 0 };
      cena.definirEstado({ ligado: E.casa.ligado, totalKwh: E.resumo.totalExato });
      cena.selecionar(null); abrirEtiqueta(null); medidor(E.resumo, false); $('med-delta').className = '';
      if (FEIRA) restaurarSons(); // o próximo visitante da feira encontra som e música ligados
    } else if (ev.tipo === 'fase') {
      corpo.classList.remove('f-intro', 'f-palpite', 'f-explorar', 'f-conta'); corpo.classList.add('f-' + E.fase);
      cena.modo(E.fase === 'intro' ? 'intro' : E.fase === 'conta' ? 'conta' : 'casa');
      if (E.fase === 'intro') { fatoI = 0; mostrarFato(); mostrarPlacar(); }
      cena.enquadrar();
      if (E.fase === 'conta') prepararConta(); else $('conta').classList.remove('aberta');
      if (E.fase === 'intro') $('entrar').focus();
      convite();
    }
    ajustarFoco();
  });

  // ---------- teclado: o que está escondido não recebe foco (atributo inert) ----------
  function inerte(el, sim) { if (!el) return; if (sim) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }
  function ajustarFoco() {
    var f = E.fase, aberta = $('conta').classList.contains('aberta'), etOn = etq.classList.contains('on');
    inerte($('intro'), f !== 'intro');
    inerte($('topo'), f === 'intro' || f === 'conta');
    inerte($('convite'), f === 'intro' || f === 'conta' || (etOn && (retrato() || deitado())));
    inerte($('ver-inteira'), f !== 'explorar' || !$('ver-inteira').classList.contains('on'));
    inerte(etq, !etOn);
    inerte($('envelope'), f !== 'conta' || aberta);
    inerte($('fatura'), f !== 'conta' || !aberta);
    inerte($('ocioso'), !corpo.classList.contains('ocioso'));
  }

  $('entrar').addEventListener('click', function () { atividade(); E.entrar(); if (W.musica) W.musica.iniciar(); });
  if (W.musica) {
    addEventListener('pointerdown', function () { W.musica.iniciar(); }, { once: true }); // o navegador só libera som após um toque
    $('musica').addEventListener('click', function () {
      var on = W.musica.alternar(); this.classList.toggle('off', !on); this.setAttribute('aria-label', on ? 'Música ligada' : 'Música desligada');
    });
  } else $('musica').hidden = true;
  $('recomecar').addEventListener('click', function () { E.recomecar(); });
  document.addEventListener('keydown', function (e) { atividade(); if (e.key === 'Escape' && E.selecionado) E.selecionar(null); });

  // ---------- inatividade (feira: o próximo visitante sempre encontra o começo) ----------
  var ultimaAtividade = Date.now();
  function atividade() { ultimaAtividade = Date.now(); if (corpo.classList.contains('ocioso')) { corpo.classList.remove('ocioso'); ajustarFoco(); } }
  ['pointerdown', 'wheel', 'touchstart', 'scroll'].forEach(function (t) { addEventListener(t, atividade, { passive: true, capture: true }); });
  var ultimoMove = 0;
  addEventListener('pointermove', function () { var n = Date.now(); if (n - ultimoMove > 500) { ultimoMove = n; atividade(); } }, { passive: true });
  $('continuar').addEventListener('click', atividade);
  setInterval(function () {
    if (E.fase === 'intro' || !FEIRA) { corpo.classList.remove('ocioso'); return; } // no celular do visitante não volta sozinho
    var s = (Date.now() - ultimaAtividade) / 1000, lim = E.fase === 'conta' ? OCIOSO_CONTA_S : OCIOSO_S;
    if (s > lim + AVISO_S) { corpo.classList.remove('ocioso'); E.recomecar(); }
    else if (s > lim) { if (!corpo.classList.contains('ocioso')) { corpo.classList.add('ocioso'); ajustarFoco(); } $('ocioso-seg').textContent = Math.ceil(lim + AVISO_S - s); }
  }, 250);

  // ---------- posições que acompanham a câmera ----------
  function retangulosHud() { // partes da interface visíveis na casa (o convite some no celular quando a etiqueta abre)
    var ids = ['topo', 'medidor'];
    if (!(etq.classList.contains('on') && (retrato() || deitado()))) ids.push('convite');
    return ids.map(function (id) { return $(id).getBoundingClientRect(); });
  }
  function quadro() {
    requestAnimationFrame(quadro);
    var hud = zoomAtivo ? retangulosHud() : null; // com zoom, rótulo que cairia sobre topo, medidor ou convite some
    rotulos.forEach(function (r) {
      var p = cena.posComodo(r[0]), meia = r[1].offsetWidth / 2 + 4, x = Math.max(meia, Math.min(innerWidth - meia, p.x)), mh = r[1].offsetHeight / 2;
      r[1].style.left = x + 'px'; r[1].style.top = p.y + 'px';
      var some = hud && hud.some(function (h) { return x + meia > h.left && x - meia < h.right && p.y + mh > h.top && p.y - mh < h.bottom; });
      r[1].style.opacity = some ? 0 : '';
    });
    var mp = $('marca-palpite');
    if (E.palpite && E.fase === 'explorar' && E.palpite !== E.selecionado) { var p = cena.posAparelho(E.palpite); mp.style.left = p.x + 'px'; mp.style.top = (p.y - 6) + 'px'; mp.style.opacity = 1; } else mp.style.opacity = 0;
    if (E.selecionado) posicionarEtiqueta();
    var lp = $('ligacao-p');
    if (!retrato()) {
      var a = cena.posPadrao(), m = $('medidor').getBoundingClientRect(), bx = m.left + 3 * rem(), by = m.bottom;
      lp.setAttribute('d', 'M' + a.x + ' ' + a.y + ' Q ' + (a.x + bx) / 2 + ' ' + Math.max(a.y, by) + ' ' + bx + ' ' + by);
    } else lp.setAttribute('d', '');
  }

  // ---------- sons (gerados pelo navegador, sem arquivos) ----------
  var somLigado = true, actx = null;
  var NOTAS = { liga: [[523, 0], [784, 0.07]], desliga: [[740, 0], [440, 0.07]], passo: [[880, 0]], palpite: [[587, 0], [880, 0.08]],
    abrir: [[392, 0], [523, 0.08], [659, 0.16]], bom: [[784, 0], [1047, 0.1], [1319, 0.2]] };
  function som(tipo) {
    if (!somLigado || !NOTAS[tipo]) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      NOTAS[tipo].forEach(function (n) {
        var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + n[1];
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.22);
      });
    } catch (err) { /* sem som: a experiência continua */ }
  }
  function restaurarSons() {
    if (!somLigado) { somLigado = true; $('som').textContent = '🔊'; $('som').setAttribute('aria-label', 'Sons ligados'); }
    if (W.musica && !W.musica.ligada()) { W.musica.alternar(); $('musica').classList.remove('off'); $('musica').setAttribute('aria-label', 'Música ligada'); }
  }
  $('som').addEventListener('click', function () {
    somLigado = !somLigado; this.textContent = somLigado ? '🔊' : '🔇';
    this.setAttribute('aria-label', somLigado ? 'Sons ligados' : 'Sons desligados'); if (somLigado) som('passo');
  });

  // ---------- conta de energia ----------
  var ICONE = { chu: '🚿', ac: '❄️', gel: '🧊', vent: '🌀', tv: '📺', mic: '🍿', nb: '💻', rot: '📶', sec: '💨', luz: '💡' };
  var MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  function reais(dec) { return C.fmtReais(C.custoCentavos(dec, TARIFA)); }
  function tempoDia(d) { return d.minutosDia % 60 === 0 ? C.fmtNum(d.minutosDia / 60) + ' h/dia' : C.fmtNum(d.minutosDia) + ' min/dia'; }
  function textoMudanca(m) {
    var a = porId[m.id];
    if (!m.depois.ligado) return 'você desligou'; // texto neutro: serve para "o" e "a" aparelho
    if (!m.antes.ligado) return 'você ligou';
    return textoUso(a, m.antes.valorUso) + ' → ' + textoUso(a, m.depois.valorUso);
  }
  function textoDica(sg) {
    var a = porId[sg.id], fim = ' = <b>' + C.fmtKwh(sg.decimos) + ' kWh</b> a menos por mês (' + reais(sg.decimos) + ').';
    if (a.uso.unidade === 'min por banho') return 'Banho de ' + C.fmtNum(sg.de) + ' para ' + C.fmtNum(sg.para) + ' minutos' + fim;
    if (a.uso.unidade === 'h por dia') return esc(a.nome) + ': ' + C.fmtNum(sg.de - sg.para) + ' h a menos por dia' + fim;
    return esc(a.nome) + ': ' + C.fmtNum(sg.de - sg.para) + ' min a menos por dia' + fim;
  }
  function rgba(hexCor, al) { var n = parseInt(hexCor.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')'; }
  var LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#FFB020"/><path d="M22 6 11 23h8l-2 11 12-18h-8z" fill="#0f2a3f"/></svg>';

  function montarFatura() {
    var R = E.resumo, REF = E.referencia, cmp = C.comparar(cat, REF, R), hoje = new Date(), h = '';
    // quem mais pesou = a primeira linha de "Para onde foi" (grupo); se o grupo tem um só aparelho ligado, mostra o aparelho
    var topo = R.linhas[0] || null;
    var topoIds = topo ? cat.aparelhos.filter(function (a) { return (a.grupo || a.id) === topo.grupo && E.casa.ligado[a.id]; }).map(function (a) { return a.id; }) : [];
    // topo e cabeçalho, como numa conta real
    h += '<header class="ft-topo"><div class="ft-marca">' + LOGO + '<div><b>WattCasa <span>Energia</span></b><small>Distribuidora fictícia · simulação educativa</small></div></div>' +
      '<div class="ft-tipo">CONTA DE ENERGIA ELÉTRICA<small>SIMULAÇÃO — NÃO É UMA CONTA REAL</small></div></header>';
    h += '<div class="ft-cab"><div class="ft-campo"><small>Cliente</small>Casa simulada no WattCasa<br><span style="color:#5a6577">' + esc(cat.casa.split('(')[0].trim().replace(/\.$/, '')) + '</span></div>' +
      '<div class="ft-campo"><small>Mês de referência</small>' + MESES[hoje.getMonth()] + '/' + hoje.getFullYear() + '<small style="margin-top:.5rem">Consumo do mês</small><b>' + C.fmtKwh(R.totalDecimos) + ' kWh</b></div>' +
      '<div class="ft-total"><small class="ft-rot">Total a pagar (simulado)</small><b>' + C.fmtReais(R.custoCentavos) + '</b><span>' + esc(cat.tarifa.nome) + ': ' + C.fmtReais(C.arredondar(TARIFA * 100)) + '/kWh</span></div></div>';
    // itens faturados
    var itens = '<section class="ft-sec"><h3>ITENS DA FATURA</h3><table class="ft-itens"><thead><tr><th>Descrição</th><th class="n">Quantidade</th><th class="n">Tarifa</th><th class="n">Valor</th></tr></thead><tbody>' +
      '<tr><td>Consumo de energia (estimado)</td><td class="n">' + C.fmtKwh(R.totalDecimos) + ' kWh</td><td class="n">' + C.fmtReais(C.arredondar(TARIFA * 100)) + '</td><td class="n">' + C.fmtReais(R.custoCentavos) + '</td></tr>' +
      '<tr><td>Bandeira tarifária, impostos e taxas</td><td class="n">—</td><td class="n">não simulados</td><td class="n">—</td></tr>' +
      '<tr class="t"><td>Total</td><td></td><td></td><td class="n">' + C.fmtReais(R.custoCentavos) + '</td></tr></tbody></table></section>';
    // palpite + quem mais pesou
    var pp = '';
    if (E.palpite) {
      var certo = E.palpite === REF.maiorAparelho;
      pp = '<div class="linha"><span>Você apostou em</span><b>' + esc(porId[E.palpite].nome) + '</b></div><div class="linha"><span>Na casa do início, quem mais pesava</span><b>' + esc(porId[REF.maiorAparelho].nome) + '</b></div>' +
        '<div class="veredito">' + (certo ? '✔ Você acertou!' : 'Quase!') + '</div>';
      if (!certo) {
        var a = porId[E.palpite], b = porId[REF.maiorAparelho], da = E.detalheReferencia(E.palpite), db = E.detalheReferencia(REF.maiorAparelho);
        if (a.potenciaW && b.potenciaW && a.potenciaW > b.potenciaW && db.minutosDia > da.minutosDia)
          pp += '<p>' + esc(a.nome) + ': ' + C.fmtNum(a.potenciaW) + ' W por ' + tempoDia(da) + '. ' + esc(b.nome) + ': ' + C.fmtNum(b.potenciaW) + ' W por ' + tempoDia(db) + '. <b>Mais potência nem sempre é mais consumo: o tempo de uso também pesa.</b></p>';
        else pp += '<p>O consumo é <b>potência × tempo de uso</b>. Um aparelho fraco ligado muito tempo pode pesar mais que um forte usado pouco.</p>';
      } else {
        var am = porId[REF.maiorAparelho], maisForte = am.potenciaW && cat.aparelhos.some(function (x) { return x.potenciaW > am.potenciaW; });
        pp += '<p>' + (maisForte ? 'Esse aparelho não é o mais potente da casa, mas fica muitas horas ligado por dia.' : 'Esse aparelho junta potência alta com muitas horas de uso por dia.') + '</p>';
      }
    } else pp = '<div class="veredito" style="font-size:1rem">Você pulou o palpite.</div><p>Na casa do início, quem mais pesava era <b>' + esc(porId[REF.maiorAparelho].nome) + '</b>.</p>';
    var vil = '<div class="nome">Nenhum aparelho ligado</div>';
    if (topo) {
      var umSo = topoIds.length === 1, ap = porId[topoIds[0]], dUm = umSo ? E.detalhe(ap.id) : null, alvo = umSo ? 'esse aparelho' : 'esses aparelhos', fatia = '';
      if (topo.pct >= 100) fatia = '<p><b>A conta inteira</b> vem ' + (umSo ? 'desse aparelho' : 'desses aparelhos') + '.</p>';
      else if (topo.pct > 50) fatia = '<p><b>Mais da metade</b> da conta vai para ' + alvo + '.</p>';
      else if (topo.pct >= 10) fatia = '<p><b>Cerca de 1 em cada ' + C.arredondar(100 / topo.pct) + ' reais</b> da conta vai para ' + alvo + '.</p>';
      vil = '<div class="nome">' + ICONE[topo.grupo] + ' ' + esc(umSo ? ap.nome : topo.nome) + '</div><div class="num"><b>' + C.fmtKwh(topo.decimos) + ' kWh</b> · ' + C.fmtPct(topo.pct) + ' da conta · ' + reais(topo.decimos) + '</div>' + fatia +
        '<p>' + (!umSo ? 'Soma de: ' + esc(topoIds.map(function (id) { return porId[id].nome; }).join(', ')) + '.' :
          ap.potenciaW ? C.fmtNum(ap.potenciaW) + ' W × ' + tempoDia(dUm) + ' durante ' + ap.dias + ' dias.' : 'Consumo mensal de referência.') + '</p>';
    }
    var duo = '<section class="ft-sec ft-duo"><div class="ft-cartao ft-palpite"><h3><i>🎯</i> SEU PALPITE</h3>' + pp + '</div><div class="ft-cartao ft-vilao"><h3><i>⚡</i> QUEM MAIS PESOU NA SUA CONTA</h3>' + vil + '</div></section>';
    // antes × depois (no lugar do "histórico de consumo" de uma conta real)
    var subiu = cmp.economiaDecimos < 0, maxD = Math.max(REF.totalDecimos, R.totalDecimos) || 1;
    h += '<section class="ft-sec"><h3><i>📊</i> COMPARE COM A CASA DO INÍCIO</h3><div class="ft-comp">' +
      '<div class="ft-coluna"><small>NO INÍCIO</small><div class="barra" data-w="' + (REF.totalDecimos / maxD * 100) + '%"></div><b>' + C.fmtReais(REF.custoCentavos) + '</b><span>' + C.fmtKwh(REF.totalDecimos) + ' kWh/mês</span></div>' +
      '<div class="ft-coluna agora' + (subiu ? ' subiu' : '') + '"><small>AGORA, COM AS SUAS ESCOLHAS</small><div class="barra" data-w="' + (R.totalDecimos / maxD * 100) + '%"></div><b>' + C.fmtReais(R.custoCentavos) + '</b><span>' + C.fmtKwh(R.totalDecimos) + ' kWh/mês</span></div></div>';
    if (cmp.economiaDecimos > 0) h += '<div class="ft-economia"><span class="rot">VOCÊ ECONOMIZOU</span><b>' + C.fmtKwh(cmp.economiaDecimos) + ' kWh/mês</b><b>' + C.fmtReais(cmp.economiaCentavos) + '/mês</b><span class="ano">' + C.fmtReais(cmp.economiaAnualCentavos) + ' por ano</span></div>';
    else if (subiu) h += '<div class="ft-economia subiu"><span class="rot">SUA CONTA SUBIU</span><b>' + C.fmtKwh(-cmp.economiaDecimos) + ' kWh/mês</b><b>' + C.fmtReais(-cmp.economiaCentavos) + '/mês</b></div>';
    if (cmp.mudancas.length) h += '<ul class="ft-mudou">' + cmp.mudancas.map(function (m) {
      return '<li><span>' + ICONE[porId[m.id].grupo] + ' ' + esc(m.nome) + ': ' + esc(textoMudanca(m)) + '</span><b class="' + (m.decimos > 0 ? 'd' : 's') + '">' + sinal(-m.decimos) + ' kWh</b></li>';
    }).join('') + '</ul>';
    h += '</section>';
    h += duo;
    // para onde foi
    var max = R.linhas.length ? R.linhas[0].kwhExato : 1;
    h += '<section class="ft-sec"><h3><i>🔌</i> PARA ONDE FOI SUA ENERGIA</h3>' + (R.linhas.map(function (l, i) {
      return '<div class="ft-linha' + (i ? '' : ' top') + '"><i>' + ICONE[l.grupo] + '</i><span>' + esc(l.nome) + '</span><span class="tr"><u data-w="' + (l.kwhExato / max * 100) + '%"></u></span><span class="n">' + C.fmtKwh(l.decimos) + '</span><span class="p">' + C.fmtPct(l.pct) + '</span></div>';
    }).join('') || '<p>Nenhum aparelho ligado.</p>') + '</section>';
    // cômodos + consumo que não para
    var com = {}; C.porComodo(cat, R).forEach(function (x) { com[x.comodo] = x; });
    var topC = Object.keys(com).sort(function (x, y) { return com[y].kwhExato - com[x].kwhExato; })[0], maxP = Math.max.apply(null, Object.keys(com).map(function (k) { return com[k].pct; })) || 1;
    var planta = ['Quarto', 'Banheiro', 'Sala', 'Cozinha'].map(function (k) {
      var c = com[k], cor = cena.comodos[k.toLowerCase()].cor;
      return '<div class="' + (k === topC && R.totalExato > 0 ? 'top' : '') + '" style="background:' + rgba(cor, 0.25 + 0.75 * c.pct / maxP) + '"><span>' + k + '</span><b>' + C.fmtPct(c.pct, c.kwhExato) + '</b><span>' + C.fmtKwh(c.decimos) + ' kWh</span></div>';
    }).join('');
    var base = C.continuos(cat, R), nomesBase = base.ids.map(function (id, i) { var n = porId[id].nome.split(' ')[0]; return i ? n.toLowerCase() : n; });
    var varios = base.ids.length > 1, txtBase = !base.ids.length ? 'Nenhum aparelho está ligado o dia todo agora.' :
      '<b>' + nomesBase.join(' e ') + '</b> ' + (varios ? 'funcionam' : 'funciona') + ' o dia todo: ' + C.fmtKwh(base.decimos) + ' kWh por mês. <b>Não é desperdício</b> — ' +
      (varios ? 'eles precisam ficar ligados' : 'esse aparelho precisa ficar ligado') + '. Por isso, na hora de comprar, vale escolher modelos que gastam menos.';
    h += '<section class="ft-sec ft-duo"><div><h3><i>🏠</i> ONDE SUA CASA GASTOU</h3><div class="ft-casa">' + planta + '</div>' +
      (R.totalExato > 0 ? '<p class="ft-casa-txt"><b>' + topC + '</b> foi o cômodo que mais gastou: ' + C.fmtPct(com[topC].pct) + ' da conta.</p>' : '') + '</div>' +
      '<div><h3><i>🔁</i> CONSUMO QUE NÃO PARA</h3><div class="ft-base"><div class="num" style="--p:' + base.pct + '%"><span>' + C.fmtPct(base.pct, base.kwhExato) + '<small>da conta</small></span></div>' +
      '<p>' + txtBase + '</p></div></div></section>';
    // dicas calculadas
    var sg = C.sugestoes(cat, E.casa).slice(0, 3), red = REF.totalDecimos ? C.arredondar((REF.totalDecimos - R.totalDecimos) / REF.totalDecimos * 100) : 0, dicas = '';
    if (red > 0) dicas += '<li class="boa"><i>✅</i><span><b>Boa!</b> Você já reduziu ' + red + '% do consumo da casa.</span></li>';
    dicas += sg.map(function (x) { return '<li><i>' + ICONE[porId[x.id].grupo] + '</i><span>' + textoDica(x) + '</span></li>'; }).join('');
    h += '<section class="ft-sec"><h3><i>💡</i> ONDE AINDA DÁ PARA ECONOMIZAR</h3><ul class="ft-dicas">' + (dicas || '<li><i>✅</i><span>Os aparelhos ajustáveis já estão no mínimo.</span></li>') + '</ul></section>';
    // frase final
    var desligou = cmp.mudancas.some(function (m) { return m.antes.ligado && !m.depois.ligado; });
    var f1 = 'Potência × tempo de uso', f2 = 'é isso que decide a conta.';
    if (cmp.economiaDecimos > 0 && !desligou) { f1 = 'Você não precisou parar de usar energia.'; f2 = 'Você mudou a forma como usa.'; }
    else if (cmp.economiaDecimos > 0) { f1 = 'Pequenas escolhas no dia a dia'; f2 = 'viram economia de verdade.'; }
    h += itens;
    h += '<div class="ft-frase"><b>' + f1 + '</b><span>' + f2 + '</span></div>'; // "Você é a Nª pessoa" entra ao abrir o envelope (abrirConta)
    h += '<footer class="ft-rodape"><span>Simulação educativa com valores estimados (fontes e cálculos na Central da Banca). Não representa a sua casa nem uma conta real.</span><span class="ft-barras" aria-hidden="true"></span></footer>';
    h += '<div class="ft-mais" aria-hidden="true">role para ver mais ↓</div>';
    h += '<div class="ft-acoes"><button class="btn-principal" data-a="voltar">VOLTAR PARA A CASA</button><button class="btn-sec" data-a="recomecar">Recomeçar</button></div>';
    return { html: h, economia: cmp.economiaDecimos };
  }
  var faturaInfo = null;
  var visita = { contada: false, economia: 0, numero: 0 };
  function prepararConta() {
    faturaInfo = montarFatura();
    $('fatura').innerHTML = faturaInfo.html; $('fatura').scrollTop = 0; $('fatura').classList.remove('rolou');
    $('conta').classList.remove('aberta');
    setTimeout(function () { $('envelope').focus(); }, 300);
  }
  function abrirConta() {
    if (E.fase !== 'conta' || $('conta').classList.contains('aberta')) return;
    atividade(); som('abrir'); $('conta').classList.add('aberta');
    ajustarFoco(); $('fatura').focus({ preventScroll: true }); // foco na fatura: as setas rolam a conta
    // placar: a visita conta quando a pessoa ABRE a conta (como diz a Central da Banca)
    if (W.placar && FEIRA) {
      W.placar.registrar(visita, C.comparar(cat, E.referencia, E.resumo).economiaAnualCentavos);
      var fr = document.querySelector('#fatura .ft-frase');
      if (fr && visita.numero && !fr.querySelector('small')) fr.insertAdjacentHTML('beforeend', '<small>Você é a ' + visita.numero + 'ª pessoa a testar a WattCasa hoje.</small>');
    }
    setTimeout(function () { document.querySelectorAll('#fatura [data-w]').forEach(function (u) { u.style.width = u.getAttribute('data-w'); }); }, 350);
    if (faturaInfo && faturaInfo.economia > 0) setTimeout(function () { som('bom'); }, 900);
  }
  $('envelope').addEventListener('click', abrirConta);
  $('envelope').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirConta(); } });
  $('fatura').addEventListener('scroll', function () { var f = this; f.classList.toggle('rolou', f.scrollTop > 80); });
  $('fatura').addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]'); if (!b) return; atividade();
    if (b.getAttribute('data-a') === 'voltar') E.voltarCasa();
    if (b.getAttribute('data-a') === 'recomecar') E.recomecar();
  });

  // ---------- zoom: botão "ver casa inteira" e retorno automático ----------
  var zoomAtivo = false, ultimoZoom = 0;
  cena.aoZoom(function (on) { zoomAtivo = on; ultimoZoom = Date.now(); $('ver-inteira').classList.toggle('on', on); ajustarFoco(); });
  $('ver-inteira').addEventListener('click', function () { atividade(); cena.zoomZerar(); });
  setInterval(function () { if (zoomAtivo && Date.now() - ultimaAtividade > 20000) cena.zoomZerar(); }, 1000);

  // ---------- modo atração: "Você sabia?" calculado a partir do catálogo ----------
  function fatos() {
    var R = E.referencia, lista = [], d = {};
    cat.aparelhos.forEach(function (a) { d[a.id] = E.detalheReferencia(a.id); });
    var porPot = cat.aparelhos.filter(function (a) { return a.potenciaW; }).sort(function (x, y) { return y.potenciaW - x.potenciaW; });
    var forte = porPot[0], maior = porId[R.maiorAparelho];
    function curto(a) { return a.nome.split(' ')[0]; }
    if (forte.id !== maior.id && maior.potenciaW) {
      lista.push({ id: maior.id, txt: 'O <b>' + esc(curto(forte).toLowerCase()) + '</b> tem ' + C.fmtDecimal(forte.potenciaW / maior.potenciaW, 1) + ' vezes a potência do <b>' + esc(curto(maior).toLowerCase()) + '</b>. Mesmo assim, nesta casa o ' + esc(curto(maior).toLowerCase()) + ' gasta mais: ' + C.fmtKwh(d[maior.id].decimos) + ' contra ' + C.fmtKwh(d[forte.id].decimos) + ' kWh/mês.' });
    }
    if (forte.uso) {
      var dec = C.valorDoPasso(cat, E.estadoReferencia, forte.id);
      lista.push({ id: forte.id, txt: 'Cada <b>' + (forte.uso.unidade === 'min por banho' ? 'minuto a menos no banho' : textoPasso(forte) + ' a menos') + '</b> economiza ' + C.fmtKwh(dec) + ' kWh por mês nesta casa.' });
    }
    var cont = cat.aparelhos.filter(function (a) { return C.ehContinuo(a) && a.potenciaW; }).sort(function (x, y) { return x.potenciaW - y.potenciaW; })[0];
    if (cont) lista.push({ id: cont.id, txt: 'O <b>' + esc(curto(cont).toLowerCase()) + '</b> tem só ' + C.fmtNum(cont.potenciaW) + ' W, mas fica ligado 24 horas: ' + C.fmtKwh(d[cont.id].decimos) + ' kWh por mês.' });
    var gel = cat.aparelhos.filter(function (a) { return a.modelo === 'consumoMensal'; })[0];
    if (gel) { var lg = R.linhas.filter(function (l) { return l.grupo === gel.grupo; })[0]; lista.push({ id: gel.id, txt: 'A <b>' + esc(gel.nome.split(' ')[0].toLowerCase()) + '</b> nunca desliga: ' + C.fmtKwh(d[gel.id].decimos) + ' kWh por mês, ' + C.fmtPct(lg.pct) + ' da conta desta casa.' }); }
    lista.push({ id: null, txt: 'Esta casa gasta <b>' + C.fmtKwh(R.totalDecimos) + ' kWh</b> por mês. Você consegue descobrir onde?' });
    return lista;
  }
  var FATOS = fatos(), fatoI = 0;
  function mostrarFato() {
    if (E.fase !== 'intro') return;
    var f = FATOS[fatoI % FATOS.length], el = $('sabia');
    el.classList.remove('on');
    setTimeout(function () { $('sabia-txt').innerHTML = f.txt; el.classList.add('on'); cena.dicas([], f.id ? [f.id] : []); if (f.id) cena.pulsar(f.id); }, 350);
    fatoI++;
  }
  setInterval(mostrarFato, 6500);

  // ---------- placar da feira na tela inicial ----------
  function mostrarPlacar() {
    var el = $('placar-feira'); if (!W.placar || !el || !FEIRA) return;
    var p = W.placar.ler();
    el.hidden = !p.visitantes;
    if (p.visitantes) el.innerHTML = 'Hoje, <b>' + p.visitantes + (p.visitantes === 1 ? ' pessoa já testou' : ' pessoas já testaram') + '</b> a WattCasa' +
      (p.economiaAnualCentavos > 0 ? ' e ' + (p.visitantes === 1 ? 'simulou' : 'simularam') + ' <b>' + C.fmtReais(p.economiaAnualCentavos) + '</b> de economia por ano.' : '.');
  }

  // ---------- diagnóstico para o teste no computador da feira (abrir com ?debug) ----------
  if (/debug/.test(location.search)) {
    var dbg = document.createElement('div'); dbg.id = 'debug'; document.body.appendChild(dbg);
    setInterval(function () { var d = cena.desempenho(); dbg.textContent = d.fps + ' FPS · resolução ' + d.resolucao + 'x · ' + d.chamadas + ' chamadas · ' + d.triangulos + ' triângulos · ' + innerWidth + '×' + innerHeight; }, 500);
  }

  // ---------- início ----------
  medidor(E.resumo, false);
  cena.definirEstado({ ligado: E.casa.ligado, totalKwh: E.resumo.totalExato });
  corpo.className = 'f-intro'; cena.modo('intro'); cena.enquadrar(true);
  convite(); quadro(); mostrarFato(); mostrarPlacar(); ajustarFoco();
  addEventListener('resize', function () { cena.enquadrar(true); ajustarFoco(); });
  window.WattCasaApp = { estado: E, cena: cena }; // para testes e depuração
})();
