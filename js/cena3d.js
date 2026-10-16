/* WattCasa — cena 3D (só visual)
 *
 * Casa térrea em corte, vista de cima por uma câmera isométrica (ortográfica).
 * Este arquivo NÃO calcula consumo: recebe o estado (ligado / uso) e mostra.
 * Luzes reais na cena: 1 hemisférica + 1 lua + 1 por cômodo (lâmpadas e chuveiro). O resto é brilho falso (sprites), que é leve.
 */
(function (raiz) {
  'use strict';
  var T = raiz.THREE;

  // ---------- texturas desenhadas em código (nada de arquivo externo) ----------
  function canvasTex(w, h, desenhar, rep) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    desenhar(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    t.anisotropy = 2;
    return t;
  }
  function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }
  function texMadeira(base) {
    return canvasTex(256, 256, function (g, w, h) {
      var cor = new T.Color(base);
      for (var i = 0; i < 8; i++) {
        var k = 0.86 + ((i * 37) % 7) / 30;
        g.fillStyle = hex(cor.clone().multiplyScalar(k).getHex()); g.fillRect(0, i * 32, w, 32);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, i * 32 + 30, w, 2);
        g.fillRect(((i * 97) % 200) + 20, i * 32, 2, 30);
      }
    }, [2, 2]);
  }
  function texAzulejo(base, linha, n) {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
      g.strokeStyle = hex(linha); g.lineWidth = 4;
      for (var i = 0; i <= n; i++) { var p = i * w / n; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
    }, [2, 2]);
  }
  function texXadrez(c1, c2, n) {
    return canvasTex(256, 256, function (g, w, h) {
      var s = w / n;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { g.fillStyle = hex((i + j) % 2 ? c1 : c2); g.fillRect(i * s, j * s, s, s); }
    }, [2, 2]);
  }
  var TEX_BRILHO = null;
  function texBrilho() {
    if (TEX_BRILHO) return TEX_BRILHO;
    TEX_BRILHO = canvasTex(128, 128, function (g, w, h) {
      var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
    return TEX_BRILHO;
  }
  function texTV() {
    return canvasTex(256, 144, function (g, w, h) {
      var ce = g.createLinearGradient(0, 0, 0, h); ce.addColorStop(0, '#5b3fd1'); ce.addColorStop(0.6, '#ff7a59'); ce.addColorStop(1, '#ffb15c');
      g.fillStyle = ce; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe28a'; g.beginPath(); g.arc(180, 70, 26, 0, 7); g.fill();
      g.fillStyle = '#2f8f5b'; g.beginPath(); g.moveTo(0, 120); g.quadraticCurveTo(70, 70, 140, 115); g.quadraticCurveTo(200, 80, 256, 110); g.lineTo(256, 144); g.lineTo(0, 144); g.fill();
      g.fillStyle = '#1f6b44'; g.beginPath(); g.moveTo(0, 135); g.quadraticCurveTo(120, 100, 256, 138); g.lineTo(256, 144); g.lineTo(0, 144); g.fill();
      g.fillStyle = '#fff'; g.fillRect(70, 96, 12, 18); g.beginPath(); g.arc(76, 92, 7, 0, 7); g.fill();
    });
  }
  var TEX_MARCA = null;
  function texMarca() { // círculo âmbar com seta para baixo: "toque aqui"
    if (TEX_MARCA) return TEX_MARCA;
    TEX_MARCA = canvasTex(128, 160, function (g) {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(64, 62, 50, 0, 7); g.fill();
      g.fillStyle = '#FFB020'; g.beginPath(); g.arc(64, 58, 48, 0, 7); g.fill();
      g.lineWidth = 6; g.strokeStyle = '#fff3d1'; g.stroke();
      g.fillStyle = '#1a1200'; g.beginPath(); g.moveTo(40, 44); g.lineTo(88, 44); g.lineTo(64, 78); g.closePath(); g.fill();
      g.fillStyle = '#FFB020'; g.beginPath(); g.moveTo(50, 104); g.lineTo(78, 104); g.lineTo(64, 128); g.closePath(); g.fill();
    });
    return TEX_MARCA;
  }
  function texRaio() { // placa de "perigo, eletricidade" do padrão
    return canvasTex(128, 128, function (g) {
      g.fillStyle = '#FFB020'; g.beginPath(); g.moveTo(64, 6); g.lineTo(124, 118); g.lineTo(4, 118); g.closePath(); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#1a1200'; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = '#1a1200'; g.beginPath(); g.moveTo(70, 34); g.lineTo(44, 80); g.lineTo(62, 80); g.lineTo(54, 108); g.lineTo(84, 62); g.lineTo(66, 62); g.lineTo(76, 34); g.closePath(); g.fill();
    });
  }
  function texNotebook() {
    return canvasTex(160, 100, function (g, w, h) {
      g.fillStyle = '#10213f'; g.fillRect(0, 0, w, h);
      var cores = ['#4cc9f0', '#ffb020', '#3ddc97', '#ff7ab6', '#9fb0cc'];
      for (var i = 0; i < 8; i++) { g.fillStyle = cores[i % 5]; g.fillRect(10 + (i % 3) * 12, 10 + i * 10, 40 + ((i * 29) % 70), 5); }
    });
  }

  // ---------- criação da cena ----------
  function criar(canvas, cat) {
    var R = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    R.setPixelRatio(Math.min(raiz.devicePixelRatio || 1, 1.5));
    R.setClearColor(0x000000, 0);
    var cena = new T.Scene();
    var cam = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    var ALVO = new T.Vector3(0.6, 0.6, 0.4);
    var YAW = 40 * Math.PI / 180, PITCH = 36 * Math.PI / 180, DIST = 60;

    cena.add(new T.HemisphereLight(0x7d93d6, 0x2a2140, 0.62));
    var lua = new T.DirectionalLight(0xa9bcff, 0.42); lua.position.set(-10, 20, 6); cena.add(lua);

    var cache = {};
    function M(c, o) { // material compartilhado (cenário)
      var k = c + JSON.stringify(o || {});
      return cache[k] || (cache[k] = new T.MeshPhongMaterial(Object.assign({ color: c, shininess: 8, flatShading: true }, o || {})));
    }
    function MP(c, o) { return new T.MeshPhongMaterial(Object.assign({ color: c, shininess: 20, flatShading: true }, o || {})); } // material próprio (aparelho)
    function box(p, w, h, d, m, x, y, z, ry) { var o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (ry) o.rotation.y = ry; p.add(o); return o; }
    function cyl(p, rt, rb, h, m, x, y, z, seg) { var o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), m); o.position.set(x, y, z); p.add(o); return o; }
    function sph(p, r, m, x, y, z) { var o = new T.Mesh(new T.SphereGeometry(r, 14, 10), m); o.position.set(x, y, z); p.add(o); return o; }
    function brilho(p, cor, tam, x, y, z, op) {
      var s = new T.Sprite(new T.SpriteMaterial({ map: texBrilho(), color: cor, transparent: true, opacity: op == null ? 0.8 : op, blending: T.AdditiveBlending, depthWrite: false }));
      s.scale.set(tam, tam, 1); s.position.set(x, y, z); p.add(s); return s;
    }
    function poca(p, cor, w, d, x, z, op) { // luz no chão (falsa)
      var o = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: texBrilho(), color: cor, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
      o.rotation.x = -Math.PI / 2; o.position.set(x, 0.03, z); p.add(o); return o;
    }

    // ---------- terreno ----------
    var W2 = 6.2, D2 = 5.2, HW = 3.2, LW = 0.9, TW = 0.2;
    var chao = new T.Mesh(new T.CircleGeometry(90, 48), M(0x24452f)); chao.rotation.x = -Math.PI / 2; chao.position.y = -0.32; cena.add(chao);
    box(cena, 13.8, 0.3, 11.8, M(0x8d8a99), 0, -0.2, 0);
    for (var i = 0; i < 3; i++) box(cena, 0.9, 0.06, 0.6, M(0xb9b2a3), -1.6 + (i % 2) * 0.2, -0.27, 6.0 + i * 0.95); // caminho até a calçada
    function arbusto(x, z, s) { var g = new T.Group(); g.position.set(x, -0.3, z); cena.add(g); sph(g, 0.7 * s, M(0x3f7d4a), 0, 0.5 * s, 0); sph(g, 0.5 * s, M(0x4c9a59), 0.5 * s, 0.4 * s, 0.3 * s); }
    arbusto(-7.4, 5.8, 1); arbusto(-5.6, 6.6, 0.8); arbusto(4.6, 6.6, 0.9); arbusto(-7.6, -1, 1.1);
    var arv = new T.Group(); arv.position.set(-9.6, -0.3, -1.5); cena.add(arv);
    cyl(arv, 0.22, 0.3, 2.2, M(0x6b4a33), 0, 1.1, 0); sph(arv, 1.5, M(0x2f6b3c), 0, 3, 0); sph(arv, 1.1, M(0x3d8550), 0.8, 2.6, 0.6);

    // ---------- entorno: jardim, rua e um pouco de vida (só decoração, não entra na conta) ----------
    var vivos = []; // objetos animados do entorno
    box(cena, 22, 0.02, 19, M(0x2b5637), -0.6, -0.31, 0.6);                       // gramado
    box(cena, 30, 0.06, 2.6, M(0x2a2f3d), 0, -0.3, 10.6);                           // rua
    for (var fx = -13; fx < 14; fx += 2.2) box(cena, 1.1, 0.07, 0.12, M(0xd8cf9a), fx, -0.29, 10.6);
    box(cena, 30, 0.12, 1.1, M(0x9a958a), 0, -0.26, 8.75);                          // calçada
    var arv2 = new T.Group(); arv2.position.set(8.6, -0.3, -6.6); cena.add(arv2);
    cyl(arv2, 0.2, 0.28, 2.0, M(0x6b4a33), 0, 1.0, 0); sph(arv2, 1.3, M(0x356f43), 0, 2.7, 0); sph(arv2, 0.9, M(0x4c9a59), -0.6, 2.3, 0.5);
    arbusto(-8.8, 3.6, 0.9); arbusto(7.4, 6.2, 0.8); arbusto(-3.6, -6.6, 0.9); arbusto(3.8, -6.8, 1.0);
    // canteiros de flores na frente da casa
    function canteiro(x0, x1, z) {
      box(cena, x1 - x0, 0.14, 0.62, M(0x5a3d2b), (x0 + x1) / 2, -0.22, z);
      var cores = [0xff5a8a, 0xffd23f, 0xffffff, 0xb48cff, 0xff9f43];
      for (var fx2 = x0 + 0.2, i2 = 0; fx2 < x1 - 0.1; fx2 += 0.32, i2++) {
        var zz = z + ((i2 % 2) ? 0.14 : -0.14);
        box(cena, 0.03, 0.26, 0.03, M(0x3f8f52), fx2, -0.05, zz); sph(cena, 0.09, M(cores[i2 % cores.length]), fx2, 0.1, zz);
      }
    }
    canteiro(-6.1, -2.7, D2 + 0.95); canteiro(-0.7, 4.4, D2 + 0.95);
    // cerca baixa de madeira na frente, com abertura no caminho
    function cerca(x0, x1, z) {
      for (var fx3 = x0; fx3 <= x1 + 0.01; fx3 += 1.0) box(cena, 0.12, 0.8, 0.12, M(0xe2d3b4), fx3, 0.1, z);
      box(cena, x1 - x0, 0.08, 0.06, M(0xd6c39d), (x0 + x1) / 2, 0.3, z); box(cena, x1 - x0, 0.08, 0.06, M(0xd6c39d), (x0 + x1) / 2, 0.0, z);
    }
    cerca(-9.6, -2.4, 7.7); cerca(-0.8, 6.2, 7.7);
    // caixa de correio: a bandeirinha sobe quando "a conta chega"
    var correio = new T.Group(); correio.position.set(-0.35, 0, 7.15); cena.add(correio);
    box(correio, 0.1, 1.0, 0.1, M(0x6b4a33), 0, 0.2, 0); box(correio, 0.42, 0.34, 0.62, M(0x2f6fb5), 0, 0.84, 0);
    cyl(correio, 0.21, 0.21, 0.62, M(0x2f6fb5), 0, 1.0, 0).rotation.x = Math.PI / 2;
    var bandeira = new T.Group(); bandeira.position.set(0.23, 0.85, 0.15); bandeira.userData.din = true; correio.add(bandeira);
    box(bandeira, 0.03, 0.4, 0.04, M(0xd9d4c8), 0, 0.2, 0); box(bandeira, 0.03, 0.14, 0.22, new T.MeshPhongMaterial({ color: 0xff5a5f, flatShading: true }), 0, 0.33, -0.12);
    bandeira.rotation.x = -Math.PI / 2; var bandeiraAlvo = -Math.PI / 2;
    vivos.push(function (t, dt) { bandeira.rotation.x += (bandeiraAlvo - bandeira.rotation.x) * Math.min(1, dt * 5); });
    // poste de luz da rua (brilho falso, sem luz extra)
    var poste2 = new T.Group(); poste2.position.set(-9.4, 0, 8.4); cena.add(poste2);
    cyl(poste2, 0.07, 0.1, 3.6, M(0x3a3f52), 0, 1.5, 0); box(poste2, 0.9, 0.08, 0.08, M(0x3a3f52), 0.42, 3.25, 0);
    box(poste2, 0.34, 0.14, 0.34, M(0x2a2f3d), 0.82, 3.15, 0); box(poste2, 0.26, 0.04, 0.26, new T.MeshBasicMaterial({ color: 0xffe2a0 }), 0.82, 3.07, 0);
    brilho(poste2, 0xffcf7a, 1.9, 0.82, 3.0, 0, 0.7); poca(poste2, 0xffc46b, 4.2, 4.2, 0.82, 0, 0.3).position.y = 0.02;
    // banco embaixo da árvore
    var banco = new T.Group(); banco.position.set(-8.3, 0, 1.0); banco.rotation.y = Math.PI / 2; cena.add(banco);
    box(banco, 1.6, 0.08, 0.5, M(0xb07a4c), 0, 0.42, 0); box(banco, 1.6, 0.4, 0.06, M(0xb07a4c), 0, 0.68, -0.24);
    [-0.7, 0.7].forEach(function (bx2) { box(banco, 0.08, 0.42, 0.45, M(0x3a3f52), bx2, 0.2, 0); });
    // gato dormindo no degrau da porta (respira e mexe o rabo)
    var gato = new T.Group(); gato.position.set(-1.75, 0.02, D2 + 0.55); gato.rotation.y = 0.6; gato.userData.din = true; cena.add(gato);
    var pelo = new T.MeshPhongMaterial({ color: 0xf0a04b, flatShading: true }), corpoGato = new T.Group(); gato.add(corpoGato);
    var tronco = sph(corpoGato, 0.3, pelo, 0, 0.17, 0); tronco.scale.set(1.15, 0.6, 0.85);
    sph(corpoGato, 0.15, pelo, 0.3, 0.2, 0.12);
    [[0.27, 0.06], [0.33, 0.2]].forEach(function (e) { var orelha = new T.Mesh(new T.ConeGeometry(0.05, 0.1, 4), pelo); orelha.position.set(e[0], 0.34, e[1]); corpoGato.add(orelha); });
    var rabo = new T.Mesh(new T.TorusGeometry(0.26, 0.045, 6, 16, Math.PI * 0.9), pelo); rabo.rotation.x = Math.PI / 2; rabo.position.set(-0.05, 0.07, 0.05); gato.add(rabo);
    vivos.push(function (t) { corpoGato.scale.y = 1 + 0.05 * Math.sin(t * 1.6); rabo.rotation.z = 0.15 * Math.sin(t * 0.9); });
    // vaga-lumes no jardim
    var vagas = [];
    for (var v = 0; v < 14; v++) {
      var vg = new T.Sprite(new T.SpriteMaterial({ map: texBrilho(), color: 0xdfff7a, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
      vg.scale.set(0.32, 0.32, 1); vg.userData = { din: true, x: v < 8 ? -10 + (v * 1.37) % 4 : 6.8 + (v * 1.13) % 3.5, z: v < 8 ? -3 + (v * 2.3) % 10 : -4 + (v * 1.9) % 9, f: v * 0.71 };
      cena.add(vg); vagas.push(vg);
    }
    vivos.push(function (t) {
      vagas.forEach(function (vg) {
        var u = vg.userData;
        vg.position.set(u.x + 0.5 * Math.sin(t * 0.3 + u.f), 0.6 + 0.35 * Math.sin(t * 0.5 + u.f * 2), u.z + 0.5 * Math.cos(t * 0.25 + u.f));
        vg.material.opacity = Math.max(0, Math.sin(t * 1.3 + u.f * 3)) * 0.9;
      });
    });

    // ---------- casa ----------
    var COMODOS = {
      quarto: { nome: 'Quarto', x0: -W2, x1: 0, z0: -D2, z1: 0, parede: 0x8f7fe0, piso: texMadeira(0xc99a69), cor: '#a99bff' },
      banheiro: { nome: 'Banheiro', x0: 0, x1: W2, z0: -D2, z1: 0, parede: 0x62b4e0, piso: texAzulejo(0xd3e2ee, 0x8fb5cf, 8), cor: '#7fd0ff' },
      sala: { nome: 'Sala', x0: -W2, x1: 0, z0: 0, z1: D2, parede: 0xe08262, piso: texMadeira(0xb98256), cor: '#ff9d7a' },
      cozinha: { nome: 'Cozinha', x0: 0, x1: W2, z0: 0, z1: D2, parede: 0x5fc7a3, piso: texXadrez(0xf3efe6, 0x4fae8f, 8), cor: '#6fe0b8' }
    };
    var CREME = 0xe9dcc0, CORTE = 0x2b3049;
    var ROTULOS = { quarto: new T.Vector3(-1.4, HW + 0.45, -D2), banheiro: new T.Vector3(3.1, HW + 0.45, -D2), sala: new T.Vector3(-W2, HW + 0.45, 4.3), cozinha: new T.Vector3(W2 + 0.3, 0.7, 2.6) };
    Object.keys(COMODOS).forEach(function (k) {
      var c = COMODOS[k], w = c.x1 - c.x0, d = c.z1 - c.z0;
      var piso = new T.Mesh(new T.BoxGeometry(w, 0.12, d), new T.MeshPhongMaterial({ map: c.piso, shininess: 15 }));
      piso.position.set((c.x0 + c.x1) / 2, -0.06, (c.z0 + c.z1) / 2); cena.add(piso);
    });
    function parede(w, h, d, x, z, faceInterna, corInterna, baixa) {
      var mats = [M(CREME), M(CREME), M(CORTE), M(CREME), M(CREME), M(CREME)];
      if (faceInterna != null) mats[faceInterna] = M(corInterna);
      if (baixa) mats = [M(0xd8ccb3), M(0xd8ccb3), M(CORTE), M(0xd8ccb3), M(0xd8ccb3), M(0xd8ccb3)];
      var o = new T.Mesh(new T.BoxGeometry(w, h, d), mats); o.position.set(x, h / 2, z); cena.add(o); return o;
    }
    // paredes altas (fundo e esquerda), com faixa mais escura embaixo e rodapé
    function faixa(c, w, d, x, z) { box(cena, w, 1.0, d, M(new T.Color(c).multiplyScalar(0.78).getHex()), x, 0.5, z); box(cena, w + 0.01, 0.12, d + 0.01, M(0xf2ead8), x, 0.06, z); }
    parede(W2, HW, TW, -W2 / 2, -D2 - TW / 2, 4, COMODOS.quarto.parede); faixa(COMODOS.quarto.parede, W2, 0.04, -W2 / 2, -D2 + 0.02);
    parede(W2, HW, TW, W2 / 2, -D2 - TW / 2, 4, COMODOS.banheiro.parede);
    box(cena, W2, 1.6, 0.04, new T.MeshPhongMaterial({ map: texAzulejo(0x8fd0ef, 0x5d9fc6, 6) }), W2 / 2, 0.8, -D2 + 0.02);
    parede(TW, HW, D2, -W2 - TW / 2, -D2 / 2, 0, COMODOS.quarto.parede); faixa(COMODOS.quarto.parede, 0.04, D2, -W2 + 0.02, -D2 / 2);
    parede(TW, HW, D2, -W2 - TW / 2, D2 / 2, 0, COMODOS.sala.parede); faixa(COMODOS.sala.parede, 0.04, D2, -W2 + 0.02, D2 / 2);
    box(cena, TW, HW + 0.12, TW, M(CREME), -W2 - TW / 2, (HW + 0.12) / 2, -D2 - TW / 2);
    // paredes baixas (cortadas, para ver dentro)
    function baixaX(x0, x1, z, h) { parede(x1 - x0, h, TW, (x0 + x1) / 2, z, null, null, true); }
    function baixaZ(z0, z1, x, h) { parede(TW, h, z1 - z0, x, (z0 + z1) / 2, null, null, true); }
    baixaZ(-D2, -2.3, 0, LW); baixaZ(-1.2, 1.4, 0, LW); baixaZ(2.5, D2, 0, LW);           // divisória esquerda/direita
    baixaX(-W2, -2.6, 0, LW); baixaX(-1.4, 0.9, 0, LW); baixaX(2.1, W2, 0, LW);           // divisória fundo/frente
    baixaX(-W2 - TW, -2.4, D2 + TW / 2, 0.45); baixaX(-1.0, W2 + TW, D2 + TW / 2, 0.45);  // frente (com porta)
    baixaZ(-D2 - TW, D2 + TW, W2 + TW / 2, 0.45);                                        // lado direito
    // janelas nas paredes altas
    function janela(p, x, y, z, w, h, eixoX) {
      var g = new T.Group(); g.position.set(x, y, z); p.add(g);
      var vid = new T.MeshBasicMaterial({ color: 0x223a7a });
      if (eixoX) { box(g, 0.06, h, w, vid, 0, 0, 0); box(g, 0.1, h + 0.16, 0.08, M(0xf4efe4), 0.02, 0, w / 2); box(g, 0.1, h + 0.16, 0.08, M(0xf4efe4), 0.02, 0, -w / 2); box(g, 0.1, 0.08, w, M(0xf4efe4), 0.02, h / 2, 0); box(g, 0.1, 0.08, w, M(0xf4efe4), 0.02, -h / 2, 0); box(g, 0.1, 0.05, w, M(0xf4efe4), 0.02, 0, 0); brilho(g, 0x6f8dff, 1.2, 0.05, 0.4, w * 0.2, 0.35); }
      else { box(g, w, h, 0.06, vid, 0, 0, 0); box(g, 0.08, h + 0.16, 0.1, M(0xf4efe4), w / 2, 0, 0.02); box(g, 0.08, h + 0.16, 0.1, M(0xf4efe4), -w / 2, 0, 0.02); box(g, w, 0.08, 0.1, M(0xf4efe4), 0, h / 2, 0.02); box(g, w, 0.08, 0.1, M(0xf4efe4), 0, -h / 2, 0.02); box(g, 0.05, h, 0.1, M(0xf4efe4), 0, 0, 0.02); brilho(g, 0x6f8dff, 1.2, w * 0.2, 0.4, 0.05, 0.35); }
      sph(g, 0.09, new T.MeshBasicMaterial({ color: 0xf2f4ff }), eixoX ? 0.04 : w * 0.28, h * 0.28, eixoX ? -w * 0.28 : 0.04);
      return g;
    }
    janela(cena, -W2 + 0.03, 1.9, -1.2, 1.5, 1.2, true);
    janela(cena, -W2 + 0.03, 1.9, 0.95, 1.2, 1.1, true);
    janela(cena, 0.85, 2.45, -D2 + 0.05, 0.9, 0.7, false);

    // ---------- móveis (cenário) ----------
    // quarto
    box(cena, 2.5, 0.42, 2.1, M(0x6b4f3a), -4.85, 0.21, -2.9); box(cena, 2.4, 0.22, 2.0, M(0xf3efe7), -4.85, 0.52, -2.9);
    box(cena, 1.7, 0.16, 2.04, M(0xffc24d), -4.4, 0.66, -2.9); box(cena, 0.16, 1.1, 2.1, M(0x6b4f3a), -6.0, 0.55, -2.9);
    box(cena, 0.45, 0.16, 0.7, M(0xffffff), -5.55, 0.68, -3.4); box(cena, 0.45, 0.16, 0.7, M(0xffffff), -5.55, 0.68, -2.4);
    box(cena, 0.6, 0.55, 0.6, M(0x7a5a42), -5.8, 0.28, -4.6); box(cena, 1.7, 0.03, 1.4, M(0x5a4fb5), -3.2, 0.02, -2.4);
    box(cena, 1.9, 0.08, 0.8, M(0x8a6447), -1.5, 0.78, -4.65); box(cena, 0.08, 0.76, 0.7, M(0x8a6447), -2.38, 0.38, -4.65); box(cena, 0.08, 0.76, 0.7, M(0x8a6447), -0.62, 0.38, -4.65);
    box(cena, 0.55, 0.08, 0.55, M(0x3a3f58), -1.5, 0.48, -3.95); box(cena, 0.55, 0.6, 0.08, M(0x3a3f58), -1.5, 0.8, -3.7);
    cyl(cena, 0.25, 0.2, 0.45, M(0xd27c4f), -0.5, 0.22, -0.6); sph(cena, 0.38, M(0x3f8f52), -0.5, 0.7, -0.6);
    // banheiro
    box(cena, 1.7, 0.85, 0.7, M(0xf0ece4), 2.1, 0.42, -4.8); box(cena, 1.8, 0.08, 0.76, M(0xd9d2c4), 2.1, 0.88, -4.8);
    cyl(cena, 0.3, 0.24, 0.12, M(0xffffff), 1.75, 0.95, -4.8); box(cena, 0.05, 0.25, 0.05, M(0xb8c4d6), 1.75, 1.06, -5.05);
    box(cena, 1.3, 1.0, 0.05, new T.MeshPhongMaterial({ color: 0xbfe6ff, emissive: 0x2c5876, shininess: 80 }), 2.1, 1.85, -D2 + 0.05);
    box(cena, 0.5, 0.42, 0.62, M(0xffffff), 0.65, 0.21, -4.55); box(cena, 0.5, 0.55, 0.18, M(0xffffff), 0.65, 0.55, -4.92); box(cena, 0.46, 0.05, 0.56, M(0xe6eef6), 0.65, 0.44, -4.5);
    box(cena, 1.0, 0.03, 0.7, M(0x3c7fb0), 4.1, 0.02, -2.4); box(cena, 0.3, 0.05, 0.75, M(0xff9f6b), 0, LW + 0.025, -3.4); box(cena, 0.04, 0.5, 0.75, M(0xff9f6b), 0.12, LW - 0.22, -3.4); box(cena, 0.04, 0.5, 0.75, M(0xff9f6b), -0.12, LW - 0.22, -3.4);
    box(cena, 0.31, 0.03, 0.1, M(0xffd2b0), 0, LW + 0.03, -3.1);
    // sala
    box(cena, 0.7, 0.6, 2.6, M(0x5a3f2e), -5.75, 0.3, 2.6); box(cena, 3.1, 0.03, 2.6, M(0x2e7d8c), -3.3, 0.02, 2.6);
    box(cena, 1.0, 0.45, 2.7, M(0x3c66c9), -1.9, 0.23, 2.6); box(cena, 0.34, 0.95, 2.7, M(0x3459ae), -1.42, 0.48, 2.6);
    box(cena, 1.0, 0.65, 0.3, M(0x3459ae), -1.9, 0.33, 1.25); box(cena, 1.0, 0.65, 0.3, M(0x3459ae), -1.9, 0.33, 3.95);
    box(cena, 0.5, 0.42, 0.5, M(0xffc24d), -1.75, 0.66, 2.0); box(cena, 0.5, 0.42, 0.5, M(0xff7a59), -1.75, 0.66, 3.2);
    box(cena, 0.9, 0.06, 1.4, M(0x8a6447), -3.5, 0.45, 2.6); box(cena, 0.7, 0.42, 1.2, M(0x6b4f3a), -3.5, 0.21, 2.6);
    cyl(cena, 0.3, 0.24, 0.55, M(0xd27c4f), -0.7, 0.27, 4.6); sph(cena, 0.5, M(0x3f8f52), -0.7, 0.95, 4.6); sph(cena, 0.35, M(0x4fa860), -0.45, 1.2, 4.45);
    // cozinha
    box(cena, 3.6, 0.88, 0.8, M(0xe6ddcc), 2.3, 0.44, 0.52); box(cena, 3.7, 0.08, 0.86, M(0x6b4f3a), 2.3, 0.92, 0.52);
    for (var p = 0; p < 4; p++) box(cena, 0.82, 0.7, 0.02, M(0xd6cab4), 0.95 + p * 0.9, 0.44, 0.93);
    box(cena, 0.7, 0.04, 0.5, M(0x8796ad), 3.3, 0.95, 0.52); box(cena, 0.05, 0.35, 0.05, M(0xb8c4d6), 3.3, 1.12, 0.3);
    cyl(cena, 0.95, 0.95, 0.08, M(0xffffff), 3.1, 0.82, 3.3, 24); cyl(cena, 0.08, 0.12, 0.8, M(0x6b4f3a), 3.1, 0.4, 3.3);
    [[3.1, 2.1], [3.1, 4.5], [1.9, 3.3]].forEach(function (c) { box(cena, 0.55, 0.06, 0.55, M(0xff9f43), c[0], 0.5, c[1]); box(cena, 0.06, 0.5, 0.06, M(0x6b4f3a), c[0], 0.25, c[1]); });
    cyl(cena, 0.3, 0.2, 0.14, M(0xf3efe6), 3.1, 0.93, 3.3); sph(cena, 0.1, M(0xff5a5f), 3.0, 1.02, 3.25); sph(cena, 0.1, M(0xffd23f), 3.18, 1.02, 3.36); sph(cena, 0.1, M(0x7ad04a), 3.1, 1.05, 3.2);
    cyl(cena, 0.22, 0.18, 0.35, M(0xd27c4f), 5.7, 0.17, 4.7); sph(cena, 0.36, M(0x3f8f52), 5.7, 0.6, 4.7);

    // ---------- aparelhos ----------
    var ap = {}, hits = [];
    var CINZA = new T.Color(0x56607a);
    function aparelho(id, x, y, z, hit, anel) {
      var g = new T.Group(); g.position.set(x, y, z); cena.add(g);
      var o = { id: id, g: g, corpo: [], efeitos: [], emis: [], luzes: [], anim: null, ligado: true, pulso: 0 };
      var hb = new T.Mesh(new T.BoxGeometry(hit[0], hit[1], hit[2]), new T.MeshBasicMaterial({ visible: false }));
      hb.position.set(hit[3] || 0, hit[4] || 0, hit[5] || 0); hb.userData.id = id; g.add(hb); hits.push(hb);
      var bb = new T.Box3().setFromObject(hb); o.topo = new T.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2);
      o.centro = new T.Vector3(); bb.getCenter(o.centro);
      var ring = new T.Mesh(new T.RingGeometry(anel[2] * 0.82, anel[2], 40), new T.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(anel[0], 0.05, anel[1]); ring.userData.din = true; cena.add(ring); o.anel = ring;
      var mk = new T.Sprite(new T.SpriteMaterial({ map: texMarca(), transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
      mk.scale.set(0.75, 0.94, 1); mk.renderOrder = 10; mk.userData.din = true; cena.add(mk); o.marca = mk;
      ap[id] = o; return o;
    }
    function corpo(o, m) { m.userData.c0 = m.color.clone(); m.userData.cOff = m.color.clone().multiplyScalar(0.5).lerp(CINZA, 0.35); o.corpo.push(m); return m; }
    function efeito(o, obj) { o.efeitos.push(obj); return obj; }
    function emis(o, m, i) { o.emis.push([m, i]); return m; }

    // Ar-condicionado (parede do fundo do quarto)
    (function () {
      var o = aparelho('ac', -4.3, 2.55, -4.95, [2.0, 1.4, 1.0, 0, -0.25, 0.25], [-4.3, -4.0, 1.25]);
      var mb = corpo(o, MP(0xf4f6fb));
      box(o.g, 1.9, 0.6, 0.42, mb, 0, 0, 0.1); box(o.g, 1.86, 0.12, 0.38, corpo(o, MP(0xdfe5ef)), 0, -0.28, 0.12);
      var aleta = box(o.g, 1.6, 0.06, 0.18, corpo(o, MP(0xb9c3d6)), 0, -0.34, 0.3); o.aleta = aleta;
      var led = emis(o, new T.MeshBasicMaterial({ color: 0x3ddc97 }), 1); box(o.g, 0.22, 0.07, 0.02, emis(o, new T.MeshPhongMaterial({ color: 0x0a2233, emissive: 0x4cc9f0 }), 1), 0.6, 0.08, 0.32); sph(o.g, 0.035, led, 0.82, 0.08, 0.32);
      o.led = led;
      var nevoa = [];
      for (var k = 0; k < 7; k++) { var s = efeito(o, brilho(o.g, 0x8fe3ff, 0.55, -0.7 + k * 0.23, -0.6, 0.5, 0.5)); s.userData.k = k; nevoa.push(s); }
      efeito(o, brilho(o.g, 0x4cc9f0, 2.6, 0, -0.9, 0.7, 0.35));
      o.anim = function (t) {
        nevoa.forEach(function (s) { var f = (t * 0.45 + s.userData.k / 7) % 1; s.position.set(-0.7 + s.userData.k * 0.23, -0.45 - f * 1.5, 0.45 + f * 0.9); s.material.opacity = 0.55 * (1 - f); s.scale.setScalar(0.4 + f * 0.6); });
      };
    })();

    // Notebook (mesa do quarto)
    (function () {
      var o = aparelho('nb', -1.5, 0.82, -4.65, [1.1, 0.9, 0.9, 0, 0.35, 0.05], [-1.5, -4.3, 0.75]);
      box(o.g, 0.9, 0.05, 0.6, corpo(o, MP(0x9aa4b8)), 0, 0.03, 0.05); box(o.g, 0.8, 0.01, 0.35, corpo(o, MP(0x3a4256)), 0, 0.06, 0.02);
      var tampa = new T.Group(); tampa.position.set(0, 0.05, -0.25); tampa.rotation.x = -0.25; o.g.add(tampa);
      box(tampa, 0.9, 0.6, 0.04, corpo(o, MP(0x9aa4b8)), 0, 0.3, 0);
      var tela = new T.MeshBasicMaterial({ map: texNotebook() }); o.telaLigada = tela; o.telaDesl = new T.MeshBasicMaterial({ color: 0x0c1220 });
      o.tela = box(tampa, 0.8, 0.5, 0.01, tela, 0, 0.31, 0.025);
      efeito(o, brilho(o.g, 0x4cc9f0, 1.1, 0, 0.4, 0.1, 0.35));
    })();

    // Chuveiro (box no canto do banheiro)
    (function () {
      var o = aparelho('chu', 4.95, 0, -4.05, [2.3, 3.1, 2.3, 0, 1.55, 0], [4.95, -4.05, 1.35]);
      box(o.g, 2.2, 0.1, 2.2, corpo(o, MP(0xf3f6f9)), 0, 0.05, 0);
      var vidro = new T.MeshPhongMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.18, shininess: 90, depthWrite: false });
      box(o.g, 2.2, 2.6, 0.03, vidro, 0, 1.4, 1.1); box(o.g, 0.03, 2.6, 2.2, vidro, -1.1, 1.4, 0);
      var perfil = corpo(o, MP(0xc2ccdb)); box(o.g, 2.2, 0.06, 0.06, perfil, 0, 2.7, 1.1); box(o.g, 0.06, 0.06, 2.2, perfil, -1.1, 2.7, 0); box(o.g, 0.06, 2.6, 0.06, perfil, -1.1, 1.4, 1.1);
      cyl(o.g, 0.04, 0.04, 2.0, corpo(o, MP(0xc2ccdb)), 0.3, 1.6, -1.04); box(o.g, 0.06, 0.06, 0.5, corpo(o, MP(0xc2ccdb)), 0.3, 2.6, -0.8);
      var ducha = cyl(o.g, 0.32, 0.22, 0.12, corpo(o, MP(0xe8edf5)), 0.3, 2.52, -0.55, 18);
      var aq = emis(o, new T.MeshPhongMaterial({ color: 0x552200, emissive: 0xff8a3d }), 0.9); cyl(o.g, 0.26, 0.26, 0.02, aq, 0.3, 2.45, -0.55, 18);
      box(o.g, 0.22, 0.32, 0.12, corpo(o, MP(0xffffff)), 0.75, 1.3, -1.02);
      var gotas = [];
      var agua = new T.MeshBasicMaterial({ color: 0xa8e4ff, transparent: true, opacity: 0.8, depthWrite: false });
      for (var k = 0; k < 18; k++) { var gm = efeito(o, cyl(o.g, 0.015, 0.015, 0.35, agua, 0, 0, 0, 4)); gm.userData = { x: 0.3 + Math.cos(k * 2.4) * 0.18 * (k % 3 + 1) / 2, z: -0.55 + Math.sin(k * 2.4) * 0.18 * (k % 3 + 1) / 2, k: k }; gotas.push(gm); }
      var vapor = [];
      for (k = 0; k < 4; k++) { var v = efeito(o, brilho(o.g, 0xe9f2ff, 1.3, 0, 1, 0, 0.3)); v.blending = T.NormalBlending; v.material.blending = T.NormalBlending; v.userData.k = k; vapor.push(v); }
      efeito(o, brilho(o.g, 0xff9a4a, 2.6, 0.2, 1.4, -0.3, 0.3));
      var luz = new T.PointLight(0xffa860, 1.0, 7, 1.4); luz.position.set(0, 2.1, 0.2); o.g.add(luz); o.luzes.push([luz, 1.0]);
      o.anim = function (t) {
        gotas.forEach(function (gm) { var f = (t * 1.7 + gm.userData.k * 0.137) % 1; gm.position.set(gm.userData.x, 2.4 - f * 2.25, gm.userData.z); });
        vapor.forEach(function (v) { var f = (t * 0.22 + v.userData.k / 4) % 1; v.position.set(-0.4 + v.userData.k * 0.3, 0.6 + f * 2.4, 0.2); v.scale.setScalar(0.9 + f * 1.2); v.material.opacity = 0.32 * Math.sin(f * Math.PI); });
      };
    })();

    // Secador (bancada do banheiro)
    (function () {
      // deitado de lado na bancada, com o bocal virado para a pia
      var o = aparelho('sec', 2.55, 0.92, -4.55, [1.0, 0.6, 0.9, 0, 0.22, 0], [2.55, -4.35, 0.62]);
      var g2 = new T.Group(); g2.rotation.order = 'YXZ'; g2.rotation.y = 2.5; g2.rotation.x = -Math.PI / 2; g2.scale.setScalar(1.45);
      g2.position.set(0.278, 0.235, -0.372); o.g.add(g2);
      var c1 = cyl(g2, 0.16, 0.16, 0.5, corpo(o, MP(0xff6fa8)), 0, 0.32, 0, 16); c1.rotation.z = Math.PI / 2;
      var c2 = cyl(g2, 0.1, 0.13, 0.2, corpo(o, MP(0x40465c)), 0.33, 0.32, 0, 14); c2.rotation.z = Math.PI / 2;
      var cabo = box(g2, 0.12, 0.38, 0.12, corpo(o, MP(0xff6fa8)), -0.08, 0.1, 0); cabo.rotation.z = 0.25;
      var bocal = emis(o, new T.MeshPhongMaterial({ color: 0x401a00, emissive: 0xff7a1a }), 1.0); var b = cyl(g2, 0.085, 0.085, 0.02, bocal, 0.44, 0.32, 0, 14); b.rotation.z = Math.PI / 2;
      var aneis = [];
      for (var k = 0; k < 3; k++) { var r = efeito(o, new T.Mesh(new T.TorusGeometry(0.1, 0.012, 6, 18), new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false }))); r.rotation.y = Math.PI / 2; g2.add(r); r.userData.k = k; aneis.push(r); }
      o.anim = function (t) { aneis.forEach(function (r) { var f = (t * 1.1 + r.userData.k / 3) % 1; r.position.set(0.5 + f * 0.7, 0.32, 0); r.scale.setScalar(1 + f * 1.4); r.material.opacity = 0.85 * (1 - f); }); };
    })();

    // TV (parede esquerda da sala, virada para dentro)
    (function () {
      var o = aparelho('tv', -6.0, 1.6, 2.6, [0.6, 1.5, 2.3, 0.2, 0, 0], [-5.4, 2.6, 1.3]);
      box(o.g, 0.1, 1.2, 2.1, corpo(o, MP(0x1b1f2b)), 0, 0, 0);
      o.telaLigada = new T.MeshBasicMaterial({ map: texTV() }); o.telaDesl = new T.MeshPhongMaterial({ color: 0x0b0e16, shininess: 90, specular: 0x334466 });
      var tela = new T.Mesh(new T.PlaneGeometry(1.98, 1.08), o.telaLigada); tela.rotation.y = Math.PI / 2; tela.position.set(0.06, 0, 0); o.g.add(tela); o.tela = tela;
      box(o.g, 0.3, 0.08, 0.6, corpo(o, MP(0x2a2f3d)), 0.12, -0.66, 0);
      var led = emis(o, new T.MeshBasicMaterial({ color: 0xff5a5f }), 1); sph(o.g, 0.025, led, 0.07, -0.55, 0.9);
      efeito(o, brilho(o.g, 0x7c6bff, 3.2, 0.5, 0, 0, 0.45));
      efeito(o, poca(o.g, 0x6f7dff, 3.0, 2.6, 1.4, 0, 0.35)).position.y = -1.57;
    })();

    // Roteador (no rack da TV)
    (function () {
      var o = aparelho('rot', -5.7, 0.6, 3.75, [0.9, 1.1, 0.9, 0, 0.35, 0], [-5.7, 3.75, 0.62]); o.g.scale.setScalar(1.35); o.base = 1.35;
      var m = corpo(o, MP(0x22283a)); box(o.g, 0.62, 0.14, 0.42, m, 0, 0.07, 0);
      [-0.22, 0, 0.22].forEach(function (x, i) { var a = box(o.g, 0.04, 0.48, 0.04, corpo(o, MP(0x2f3650)), x, 0.38, -0.15); a.rotation.z = (i - 1) * 0.25; });
      var leds = [];
      for (var k = 0; k < 4; k++) { var lm = emis(o, new T.MeshBasicMaterial({ color: k % 2 ? 0x3ddc97 : 0x4cc9f0 }), 1); sph(o.g, 0.03, lm, -0.2 + k * 0.13, 0.1, 0.215); leds.push(lm); }
      var arcos = [];
      for (k = 0; k < 3; k++) { var a = efeito(o, new T.Mesh(new T.TorusGeometry(0.25 + k * 0.18, 0.02, 6, 24, Math.PI / 2), new T.MeshBasicMaterial({ color: 0x4cc9f0, transparent: true, depthWrite: false }))); a.position.set(0, 0.62, 0); a.rotation.z = Math.PI / 4; a.rotation.y = 0.7; o.g.add(a); a.userData.k = k; arcos.push(a); }
      o.anim = function (t) {
        arcos.forEach(function (a) { a.material.opacity = 0.15 + 0.75 * Math.max(0, Math.sin(t * 3 - a.userData.k * 0.9)); });
        leds.forEach(function (lm, k) { lm.color.setHex(Math.sin(t * 6 + k * 1.7) > 0.2 ? (k % 2 ? 0x3ddc97 : 0x4cc9f0) : 0x10301f); });
      };
      o.leds = leds;
    })();

    // Ventilador (sala, virado para a câmera)
    (function () {
      var o = aparelho('vent', -3.6, 0, 4.55, [1.2, 2.0, 1.2, 0, 1.0, 0], [-3.6, 4.55, 0.8]);
      var g2 = new T.Group(); g2.rotation.y = 0.75; o.g.add(g2);
      cyl(g2, 0.42, 0.48, 0.1, corpo(o, MP(0xe9eef7)), 0, 0.05, 0, 18); cyl(g2, 0.05, 0.05, 1.2, corpo(o, MP(0xc6cfdf)), 0, 0.7, 0);
      var mot = cyl(g2, 0.18, 0.2, 0.32, corpo(o, MP(0xe9eef7)), 0, 1.4, -0.1, 14); mot.rotation.x = Math.PI / 2;
      var grade = corpo(o, MP(0xc6cfdf));
      var gr = new T.Mesh(new T.TorusGeometry(0.62, 0.025, 6, 32), grade); gr.position.set(0, 1.4, 0.12); g2.add(gr);
      var gr2 = new T.Mesh(new T.TorusGeometry(0.62, 0.025, 6, 32), grade); gr2.position.set(0, 1.4, -0.12); g2.add(gr2);
      var pas = new T.Group(); pas.position.set(0, 1.4, 0.04); g2.add(pas);
      var mp = corpo(o, MP(0x4cc9f0));
      for (var k = 0; k < 3; k++) { var q = new T.Group(); q.rotation.z = k * 2.094; var pa = box(q, 0.26, 0.5, 0.03, mp, 0, 0.3, 0); pa.rotation.y = 0.3; pas.add(q); }
      sph(pas, 0.09, corpo(o, MP(0xffb020)), 0, 0, 0.04);
      o.anim = function (t, dt) { pas.rotation.z -= dt * 14; };
    })();

    // Geladeira (cozinha)
    (function () {
      var o = aparelho('gel', 5.35, 0, 0.75, [1.3, 2.5, 1.2, 0, 1.25, 0.05], [5.35, 1.1, 0.95]);
      var m = corpo(o, MP(0xf2f5fa, { shininess: 50 }));
      box(o.g, 1.1, 2.3, 0.9, m, 0, 1.15, 0); box(o.g, 1.08, 0.03, 0.02, corpo(o, MP(0x9aa6b8)), 0, 1.55, 0.46);
      box(o.g, 0.06, 0.45, 0.06, corpo(o, MP(0x9aa6b8)), 0.42, 1.9, 0.49); box(o.g, 0.06, 0.7, 0.06, corpo(o, MP(0x9aa6b8)), 0.42, 1.0, 0.49);
      box(o.g, 0.16, 0.16, 0.02, corpo(o, MP(0xff5a5f)), -0.3, 1.2, 0.46); box(o.g, 0.14, 0.18, 0.02, corpo(o, MP(0xffd23f)), -0.1, 0.95, 0.46); box(o.g, 0.18, 0.12, 0.02, corpo(o, MP(0x3ddc97)), -0.32, 0.8, 0.46);
      var visor = emis(o, new T.MeshPhongMaterial({ color: 0x0a2233, emissive: 0x4cc9f0 }), 1.1); box(o.g, 0.34, 0.16, 0.02, visor, -0.15, 1.95, 0.46);
      var led = emis(o, new T.MeshBasicMaterial({ color: 0x3ddc97 }), 1); sph(o.g, 0.035, led, 0.15, 1.95, 0.47); o.led = led;
      var frio = efeito(o, brilho(o.g, 0x9fe8ff, 1.4, -0.15, 1.95, 0.6, 0.4));
      o.anim = function (t) { frio.material.opacity = 0.25 + 0.2 * Math.sin(t * 1.6); };
    })();

    // Micro-ondas (bancada da cozinha)
    (function () {
      var o = aparelho('mic', 1.35, 0.96, 0.55, [1.2, 0.8, 0.9, 0, 0.32, 0], [1.35, 1.0, 0.8]);
      box(o.g, 1.0, 0.6, 0.65, corpo(o, MP(0x2b3142)), 0, 0.3, 0);
      var jan = emis(o, new T.MeshPhongMaterial({ color: 0x3a2200, emissive: 0xffb020 }), 0.9); box(o.g, 0.62, 0.42, 0.02, jan, -0.12, 0.3, 0.33);
      var prato = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.02, 16), new T.MeshBasicMaterial({ color: 0xfff1c4 })); prato.position.set(-0.12, 0.14, 0.2); o.g.add(prato); efeito(o, prato);
      box(o.g, 0.22, 0.48, 0.02, corpo(o, MP(0x3d4560)), 0.36, 0.3, 0.33);
      var visor = emis(o, new T.MeshBasicMaterial({ color: 0x3ddc97 }), 1); box(o.g, 0.14, 0.06, 0.01, visor, 0.36, 0.48, 0.345);
      efeito(o, brilho(o.g, 0xffb020, 1.5, -0.1, 0.35, 0.5, 0.45));
      o.anim = function (t, dt) { prato.rotation.y += dt * 2; };
    })();

    // Lâmpadas (pendentes)
    function lampada(id, x, z, cor, forca) {
      forca = forca || 1;
      var o = aparelho(id, x, 2.95, z, [0.9, 1.0, 0.9, 0, -0.1, 0], [x, z, 0.7]);
      box(o.g, 0.02, 0.9, 0.02, corpo(o, MP(0x222838)), 0, 0.45, 0);
      var cup = new T.Mesh(new T.ConeGeometry(0.34, 0.32, 18, 1, true), corpo(o, MP(cor, { side: T.DoubleSide }))); cup.position.y = -0.05; o.g.add(cup);
      var lamp = emis(o, new T.MeshPhongMaterial({ color: 0x6b5a33, emissive: 0xffe2a0 }), 1.4); sph(o.g, 0.13, lamp, 0, -0.2, 0);
      var cone = new T.Mesh(new T.ConeGeometry(1.1, 2.7, 24, 1, true), new T.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      cone.position.y = -1.55; o.g.add(cone); efeito(o, cone);
      efeito(o, brilho(o.g, 0xffd27a, 1.2, 0, -0.22, 0, 0.8));
      efeito(o, poca(o.g, 0xffc46b, 3.4, 3.4, 0, 0, 0.25 * forca)).position.y = -2.92;
      var luz = new T.PointLight(0xffc77a, 1.25 * forca, 10, 1.3); luz.position.set(0, -0.5, 0); o.g.add(luz); o.luzes.push([luz, 1.25 * forca]);
      return o;
    }
    lampada('lq', -3.3, -2.3, 0xa99bff);
    lampada('ls', -3.4, 2.6, 0xff9d7a);
    lampada('lc', 3.1, 3.3, 0x6fe0b8);
    lampada('lb', 2.2, -2.6, 0x7fd0ff, 0.35); // banheiro já recebe a luz do chuveiro: lâmpada mais fraca para o piso não estourar

    // ---------- padrão de energia (medidor na rua) e fio ----------
    var PADRAO = new T.Vector3(8.4, 0, -2.6);
    var poste = new T.Group(); poste.position.copy(PADRAO); cena.add(poste);
    box(poste, 0.28, 3.8, 0.28, M(0xa8a39a), 0, 1.6, 0); box(poste, 0.8, 1.0, 0.4, M(0xd9d4c8), 0, 1.6, 0.22);
    box(poste, 0.7, 0.08, 0.5, M(0x8a857c), 0, 2.15, 0.24);
    var visorPadrao = new T.MeshBasicMaterial({ color: 0xffb020 }); box(poste, 0.4, 0.3, 0.02, visorPadrao, 0, 1.7, 0.43);
    var brilhoPadrao = brilho(poste, 0xffb020, 1.6, 0, 1.7, 0.6, 0.55);
    var placa = new T.Mesh(new T.PlaneGeometry(0.62, 0.62), new T.MeshBasicMaterial({ map: texRaio(), transparent: true }));
    placa.position.set(0, 2.9, 0.15); placa.rotation.y = YAW; poste.add(placa);
    box(cena, 0.1, 2.3, 0.1, M(0x8a8f9e), W2 + 0.25, 1.0, -1.2);
    var A = new T.Vector3(PADRAO.x, 3.45, PADRAO.z), B = new T.Vector3(W2 + 0.25, 2.15, -1.2);
    var curvaEntrada = new T.QuadraticBezierCurve3(A, new T.Vector3((A.x + B.x) / 2, 2.4, (A.z + B.z) / 2), B);
    cena.add(new T.Mesh(new T.TubeGeometry(curvaEntrada, 20, 0.025, 6), M(0x1a1d28)));
    var pulsosEntrada = [0, 1, 2, 3].map(function () { var s = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), new T.MeshBasicMaterial({ color: 0xffe29a })); s.userData.din = true; cena.add(s); return s; });

    // fio até o aparelho selecionado
    var fio = null;
    function limparFio() { if (fio) { cena.remove(fio.g); fio.g.traverse(function (x) { if (x.geometry) x.geometry.dispose(); }); fio = null; } }
    function criarFio(id) {
      limparFio();
      var o = ap[id], a = cat.aparelhos.filter(function (x) { return x.id === id; })[0];
      var alvo = o.g.localToWorld(o.topo.clone());
      var meio = new T.Vector3((B.x + alvo.x) / 2, Math.max(B.y, alvo.y) + 2.6, (B.z + alvo.z) / 2);
      var curva = new T.QuadraticBezierCurve3(B.clone(), meio, alvo);
      var raio = a.potenciaW ? 0.03 + 0.07 * Math.sqrt(a.potenciaW / 5500) : 0.05;
      var g = new T.Group();
      g.add(new T.Mesh(new T.TubeGeometry(curva, 48, raio, 8), new T.MeshBasicMaterial({ color: o.ligado ? 0xffb020 : 0x5c6f8f, transparent: true, opacity: o.ligado ? 0.55 : 0.3, depthWrite: false })));
      var pts = [0, 1, 2, 3, 4].map(function () { var s = new T.Mesh(new T.SphereGeometry(raio * 1.8 + 0.04, 8, 6), new T.MeshBasicMaterial({ color: 0xfff0c0 })); s.visible = o.ligado; g.add(s); return s; });
      cena.add(g); fio = { g: g, curva: curva, pts: pts, id: id };
    }

    // ---------- juntar geometria fixa: menos chamadas de desenho, mesmo visual ----------
    (function juntarEstaticos() {
      cena.updateMatrixWorld(true);
      var dinamicos = new Set(); Object.keys(ap).forEach(function (k) { dinamicos.add(ap[k].g); });
      function ehDinamico(o) { for (var p = o; p && p !== cena; p = p.parent) if (dinamicos.has(p) || p.userData.din) return true; return false; }
      var grupos = {}, remover = [];
      cena.traverse(function (o) {
        if (!o.isMesh || Array.isArray(o.material) || ehDinamico(o) || o.material === visorPadrao) return;
        var k = o.material.uuid; (grupos[k] = grupos[k] || { m: o.material, gs: [] }).gs.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
        remover.push(o);
      });
      remover.forEach(function (o) { o.parent.remove(o); });
      Object.keys(grupos).forEach(function (k) {
        var gs = grupos[k].gs.map(function (g) { return g.index ? g.toNonIndexed() : g; }), n = 0;
        gs.forEach(function (g) { n += g.attributes.position.count; });
        var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), i = 0;
        gs.forEach(function (g) {
          pos.set(g.attributes.position.array, i * 3); nor.set(g.attributes.normal.array, i * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, i * 2);
          i += g.attributes.position.count; g.dispose();
        });
        var bg = new T.BufferGeometry();
        bg.setAttribute('position', new T.BufferAttribute(pos, 3)); bg.setAttribute('normal', new T.BufferAttribute(nor, 3)); bg.setAttribute('uv', new T.BufferAttribute(uv, 2));
        cena.add(new T.Mesh(bg, grupos[k].m));
      });
    })();

    // ---------- estado visual ----------
    var sel = null, hov = null, dicas = [], marcas = [], modo = 'intro', totalKwh = 0, mx = 0, my = 0;
    var zoom = { k: 1, f: null }, cbZoom = function () {};
    var qualidade = { ratio: Math.min(raiz.devicePixelRatio || 1, 1.5), auto: !/qualidade=alta/.test(raiz.location.search), tempos: [], fps: 0 };
    function aplicarLigado(o, v) {
      o.ligado = v;
      o.corpo.forEach(function (m) { m.color.copy(v ? m.userData.c0 : m.userData.cOff); });
      o.efeitos.forEach(function (e) { e.visible = v; });
      o.emis.forEach(function (p) { var m = p[0]; if (m.emissive) m.emissiveIntensity = v ? p[1] : 0; else m.visible = v; });
      o.luzes.forEach(function (p) { p[0].intensity = v ? p[1] : 0; });
      if (o.tela) o.tela.material = v ? o.telaLigada : o.telaDesl;
      if (o.aleta) o.aleta.rotation.x = v ? 0.6 : 0;
    }

    // ---------- câmera e enquadramento ----------
    var margens = function () { return { topo: 0, dir: 0, base: 0, esq: 0 }; };
    var CANTOS = [];
    [-W2 - 0.4, W2 + 0.4, PADRAO.x + 0.6].forEach(function (x) { [-D2 - 0.3, D2 + 0.6].forEach(function (z) { [0, HW + 0.2].forEach(function (y) { CANTOS.push(new T.Vector3(x, y, z)); }); }); });
    var CANTOS_CASA = []; // só a casa: usado em telas estreitas (celular em pé), onde cada pixel conta
    [-W2 - 0.3, W2 + 0.3].forEach(function (x) { [-D2 - 0.3, D2 + 0.3].forEach(function (z) { [0, HW + 0.1].forEach(function (y) { CANTOS_CASA.push(new T.Vector3(x, y, z)); }); }); });
    var enq = { s: 0.02, cx: 0, cy: 0, ax: 0, ay: 0, W: 1, H: 1 };
    function posicionarCamera(dy) {
      var y = YAW + (dy || 0);
      cam.position.set(ALVO.x + DIST * Math.cos(PITCH) * Math.sin(y), ALVO.y + DIST * Math.sin(PITCH), ALVO.z + DIST * Math.cos(PITCH) * Math.cos(y));
      cam.up.set(0, 1, 0); cam.lookAt(ALVO); cam.updateMatrixWorld();
    }
    var fr = null, frIniciado = false;
    function enquadrar(imediato) {
      var W = canvas.clientWidth || raiz.innerWidth, H = canvas.clientHeight || raiz.innerHeight;
      R.setSize(W, H, false);
      posicionarCamera(0);
      var inv = cam.matrixWorldInverse, minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
      var m = margens();
      (m.justo ? CANTOS_CASA : CANTOS).forEach(function (c) { var v = c.clone().applyMatrix4(inv); minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y); });
      var aw = Math.max(50, W - m.esq - m.dir), ah = Math.max(50, H - m.topo - m.base);
      var s = Math.max((maxx - minx) / aw, (maxy - miny) / ah);
      var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2, ax = m.esq + aw / 2, ay = m.topo + ah / 2;
      fr = { l: cx - ax * s, t: cy + ay * s }; fr.r = fr.l + W * s; fr.b = fr.t - H * s;
      if (zoom.k !== 1) { zoom.k = 1; zoom.f = null; cbZoom(false); }
      if (!frIniciado || imediato) { cam.left = fr.l; cam.right = fr.r; cam.top = fr.t; cam.bottom = fr.b; frIniciado = true; }
      cam.updateProjectionMatrix();
      enq = { s: s, W: W, H: H };
    }

    // ---------- interação ----------
    var rc = new T.Raycaster(), mv = new T.Vector2();
    function vol(m) { var p = m.geometry.parameters, k = m.parent.scale.x; return p.width * p.height * p.depth * k * k * k; }
    function escolher(x, y) {
      var r = canvas.getBoundingClientRect();
      mv.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
      rc.setFromCamera(mv, cam);
      var hs = rc.intersectObjects(hits, false);
      if (!hs.length) return null;
      hs.sort(function (p, q) { return vol(p.object) - vol(q.object); });
      return hs[0].object.userData.id;
    }
    var cbClique = function () {}, cbPassar = function () {};
    canvas.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * 2 - 1; my = (e.clientY - r.top) / r.height * 2 - 1;
      if (modo !== 'casa') return;
      var id = e.pointerType === 'mouse' ? escolher(e.clientX, e.clientY) : null;
      if (id !== hov) { hov = id; canvas.style.cursor = id ? 'pointer' : 'default'; }
      cbPassar(id, e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerleave', function () { hov = null; cbPassar(null); });
    canvas.addEventListener('click', function (e) { if (modo === 'casa' && !pinca.houve) cbClique(escolher(e.clientX, e.clientY)); pinca.houve = false; });

    // ---------- zoom limitado (roda do mouse / pinca), sempre dentro do enquadramento da casa ----------
    var ZMAX = 2.2;
    function zoomEm(fator, x, y) {
      if (modo !== 'casa' || !fr) return;
      var r = canvas.getBoundingClientRect(), u = (x - r.left) / r.width, v = (y - r.top) / r.height;
      var k = Math.max(1, Math.min(ZMAX, zoom.k * fator));
      if (k === zoom.k) return;
      var atual = zoom.f || fr, W = fr.r - fr.l, H = fr.t - fr.b;
      var px = atual.l + u * (atual.r - atual.l), py = atual.t - v * (atual.t - atual.b);
      var w = W / k, h = H / k, l = px - u * w, t = py + v * h;
      l = Math.max(fr.l, Math.min(fr.r - w, l)); t = Math.min(fr.t, Math.max(fr.b + h, t));
      zoom.k = k; zoom.f = k > 1.001 ? { l: l, r: l + w, t: t, b: t - h } : null;
      cbZoom(zoom.k > 1.001);
    }
    function zoomZerar() { if (zoom.k !== 1) { zoom.k = 1; zoom.f = null; cbZoom(false); } }
    canvas.addEventListener('wheel', function (e) { if (modo !== 'casa') return; e.preventDefault(); zoomEm(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });
    var toques = {}, pinca = { d: 0, houve: false };
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      if (!Object.keys(toques).length) pinca.houve = false; // gesto novo: um toque depois da pinça volta a valer
      toques[e.pointerId] = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!toques[e.pointerId]) return;
      toques[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(toques); if (ids.length !== 2) { pinca.d = 0; return; }
      var a = toques[ids[0]], b = toques[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinca.d) { zoomEm(d / pinca.d, (a.x + b.x) / 2, (a.y + b.y) / 2); pinca.houve = true; }
      pinca.d = d;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { canvas.addEventListener(t, function (e) { delete toques[e.pointerId]; pinca.d = 0; }); });

    function telaDe(v3) { var v = v3.clone().project(cam); return { x: (v.x * 0.5 + 0.5) * enq.W, y: (-v.y * 0.5 + 0.5) * enq.H }; }

    // ---------- laço ----------
    var relogio = new T.Clock(), ultimo = 0;
    function laco() {
      raiz.requestAnimationFrame(laco);
      if (document.hidden) return;
      var dt = Math.min(relogio.getDelta(), 0.1), t = relogio.elapsedTime;
      var balanco = modo === 'intro' ? Math.sin(t * 0.25) * 0.09 : mx * 0.035;
      posicionarCamera(balanco);
      var alvoF = zoom.f || fr;
      if (alvoF) { var kf = Math.min(1, dt * 6); cam.left += (alvoF.l - cam.left) * kf; cam.right += (alvoF.r - cam.right) * kf; cam.top += (alvoF.t - cam.top) * kf; cam.bottom += (alvoF.b - cam.bottom) * kf; cam.updateProjectionMatrix(); }
      var escala = fr ? (cam.right - cam.left) / (fr.r - fr.l) : 1; // marcadores encolhem junto com o zoom
      vivos.forEach(function (f) { f(t, dt); });
      for (var id in ap) {
        var o = ap[id];
        if (o.ligado && o.anim) o.anim(t, dt);
        if (o.pulso > 0) { o.pulso = Math.max(0, o.pulso - dt * 2.5); var k = (o.base || 1) * (1 + 0.12 * Math.sin(o.pulso * Math.PI)); o.g.scale.set(k, k, k); }
        var alvoOp = 0, pulsa = false;
        var mostraMarca = (modo === 'casa' || modo === 'intro') && marcas.indexOf(id) >= 0 && id !== sel;
        o.marca.material.opacity += ((mostraMarca ? 1 : 0) - o.marca.material.opacity) * Math.min(1, dt * 8);
        o.marca.visible = o.marca.material.opacity > 0.01;
        if (o.marca.visible) { var tp = o.g.localToWorld(o.topo.clone()); o.marca.position.set(tp.x, tp.y + 0.75 * escala + 0.18 * Math.abs(Math.sin(t * 3 + marcas.indexOf(id))), tp.z); o.marca.scale.set(0.75 * escala, 0.94 * escala, 1); }
        if (modo === 'intro' && marcas.indexOf(id) >= 0) { alvoOp = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 3.2)); pulsa = true; }
        if (modo === 'casa') {
          if (id === sel) alvoOp = 0.95;
          else if (id === hov) alvoOp = 0.7;
          else if (dicas.indexOf(id) >= 0) { pulsa = true; alvoOp = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.2 - dicas.indexOf(id) * 0.6)); }
        }
        o.anel.material.opacity += (alvoOp - o.anel.material.opacity) * Math.min(1, dt * 10);
        var esc = id === sel ? 1 + 0.04 * Math.sin(t * 4) : (pulsa ? 1 + 0.08 * Math.sin(t * 3.2) : 1);
        o.anel.scale.set(esc, esc, esc);
      }
      var vel = 0.08 + Math.min(0.5, totalKwh / 900);
      pulsosEntrada.forEach(function (s, k) { s.visible = totalKwh > 0; s.position.copy(curvaEntrada.getPointAt((t * vel + k / 4) % 1)); });
      brilhoPadrao.material.opacity = totalKwh > 0 ? 0.4 + 0.2 * Math.sin(t * 4) : 0.1;
      visorPadrao.color.setHex(totalKwh > 0 ? 0xffb020 : 0x4a3a10);
      if (fio && ap[fio.id].ligado) fio.pts.forEach(function (s, k) { s.position.copy(fio.curva.getPointAt((t * 0.45 + k / 5) % 1)); });
      R.render(cena, cam);
      // qualidade automática: se o computador não aguenta, desenha com menos pixels (a cena continua igual)
      qualidade.tempos.push(dt); if (qualidade.tempos.length > 90) qualidade.tempos.shift();
      if (qualidade.tempos.length === 90) {
        var media = qualidade.tempos.reduce(function (a, b) { return a + b; }, 0) / 90; qualidade.fps = 1 / media;
        if (qualidade.auto && qualidade.fps < 28 && qualidade.ratio > 0.75) {
          qualidade.ratio = qualidade.ratio > 1 ? 1 : 0.75; R.setPixelRatio(qualidade.ratio); R.setSize(enq.W, enq.H, false); qualidade.tempos = [];
        }
      }
    }

    // ---------- API ----------
    var api = {
      ids: Object.keys(ap),
      comodos: COMODOS,
      definirEstado: function (estado) {
        totalKwh = estado.totalKwh || 0;
        for (var id in ap) if (ap[id].ligado !== !!estado.ligado[id]) { aplicarLigado(ap[id], !!estado.ligado[id]); if (fio && fio.id === id) criarFio(id); }
      },
      selecionar: function (id) { sel = id; if (id) criarFio(id); else limparFio(); },
      dicas: function (lista, comMarcas) { dicas = lista || []; marcas = comMarcas || []; },
      zoomZerar: zoomZerar,
      carta: function (on) { bandeiraAlvo = on ? 0 : -Math.PI / 2; },
      aoZoom: function (fn) { cbZoom = fn; },
      desempenho: function () { return { fps: Math.round(qualidade.fps), resolucao: qualidade.ratio, chamadas: R.info.render.calls, triangulos: R.info.render.triangles }; },
      pulsar: function (id) { if (ap[id]) ap[id].pulso = 1; },
      modo: function (m) { modo = m; if (m !== 'casa') { hov = null; canvas.style.cursor = 'default'; zoomZerar(); } },
      posAparelho: function (id) { var o = ap[id]; return telaDe(o.g.localToWorld(o.topo.clone())); },
      posCentro: function (id) { var o = ap[id]; return telaDe(o.g.localToWorld(o.centro.clone())); },
      posComodo: function (k) { return telaDe(ROTULOS[k]); },
      posPadrao: function () { return telaDe(new T.Vector3(PADRAO.x, 2.2, PADRAO.z)); },
      aoClicar: function (fn) { cbClique = fn; },
      aoPassar: function (fn) { cbPassar = fn; },
      margens: function (fn, imediato) { margens = fn; enquadrar(imediato); },
      enquadrar: enquadrar,
      comZoom: function () { return zoom.k > 1.001; },
      _cena: function () { return cena; },
      info: function () { var n = 0; cena.traverse(function (o) { if (o.isLight) n++; }); return { luzes: n, triangulos: R.info.render.triangles, chamadas: R.info.render.calls }; }
    };
    enquadrar();
    raiz.addEventListener('resize', function () { enquadrar(true); });
    laco();
    return api;
  }

  raiz.WattCasa = raiz.WattCasa || {};
  raiz.WattCasa.cena = { criar: criar };
})(window);
