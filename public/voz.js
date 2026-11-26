// Central Família — leitura em voz alta e sons confiáveis em computador, Android e iPhone.
// - Fala SEMPRE dentro do toque (exigência do iPhone/iPad); só tenta de novo se o navegador engolir a fala.
// - Escolhe uma voz do idioma certo, preferindo vozes instaladas no aparelho (funcionam sem internet).
// - Divide textos longos (o Chrome corta falas compridas).
// - Libera os efeitos sonoros no primeiro toque e faz o iPhone tocar som mesmo com a chave de silencioso.
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  window.__audioCtx = null;
  window.pegarAudio = function () {
    try {
      if (!AC) return null;
      if (!window.__audioCtx) window.__audioCtx = new AC();
      if (window.__audioCtx.state !== 'running') window.__audioCtx.resume();
      return window.__audioCtx;
    } catch (e) { return null; }
  };

  var ss = window.speechSynthesis;
  var temSintese = !!ss && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var nativeSpeak = temSintese ? ss.speak.bind(ss) : null;
  var nativeCancel = temSintese ? ss.cancel.bind(ss) : null;
  var voices = [];
  var cancelouFalando = 0;
  window.__falando = [];

  function carregar() { try { voices = ss.getVoices() || []; } catch (e) {} }
  if (temSintese) {
    carregar();
    try { ss.addEventListener('voiceschanged', carregar); } catch (e) { ss.onvoiceschanged = carregar; }
  }
  var normLang = function (l) { return String(l || '').toLowerCase().replace('_', '-'); };

  function escolherVoz(lang) {
    carregar();
    var L = normLang(lang || 'pt-BR'), base = L.split('-')[0];
    var exatas = voices.filter(function (v) { return normLang(v.lang) === L; });
    var mesmas = voices.filter(function (v) { return normLang(v.lang).indexOf(base) === 0; });
    var lista = exatas.length ? exatas : mesmas;
    if (!lista.length) return null;
    // vozes do próprio aparelho primeiro (as "online" falham sem internet em alguns celulares)
    var locais = lista.filter(function (v) { return v.localService; });
    var pool = locais.length ? locais : lista;
    return pool.find(function (v) { return v['default']; }) || pool[0];
  }

  function pedacos(t) {
    var partes = String(t).match(/[^.!?;:\n]+[.!?;:\n]*/g) || [String(t)];
    var out = [], cur = '';
    partes.forEach(function (p) {
      if ((cur + p).length > 180 && cur) { out.push(cur); cur = ''; }
      while (p.length > 180) { out.push(p.slice(0, 180)); p = p.slice(180); }
      cur += p;
    });
    if (cur.trim()) out.push(cur);
    return out;
  }

  if (temSintese) {
    ss.cancel = function () {
      try { if (ss.speaking || ss.pending) { cancelouFalando = Date.now(); nativeCancel(); } } catch (e) {}
      window.__falando = [];
    };
    ss.speak = function (u) {
      try {
        if (!u.voice) { var v = escolherVoz(u.lang); if (v) { u.voice = v; u.lang = v.lang; } }
        var texto = u.text || '';
        var lista = [u];
        if (texto.length > 180) {
          lista = pedacos(texto).map(function (p) {
            var x = new SpeechSynthesisUtterance(p);
            x.lang = u.lang; if (u.voice) x.voice = u.voice; x.rate = u.rate; x.pitch = u.pitch; x.volume = u.volume;
            return x;
          });
          lista[0].onstart = u.onstart; lista[lista.length - 1].onend = u.onend; lista[lista.length - 1].onerror = u.onerror;
        }
        var comecou = false;
        try { lista[0].addEventListener('start', function () { comecou = true; }); } catch (e) {}
        window.__falando = window.__falando.concat(lista); // mantém referência (o Chrome para a fala se o objeto sumir)
        try { ss.resume(); } catch (e) {}
        lista.forEach(function (x) { nativeSpeak(x); }); // na hora, dentro do toque
        // Chrome/Android às vezes engolem a fala logo depois de um cancelamento: tenta mais uma vez
        if (Date.now() - cancelouFalando < 300) {
          setTimeout(function () {
            if (!comecou && !ss.speaking && window.__falando[0] === lista[0]) {
              try { ss.resume(); } catch (e) {}
              lista.forEach(function (x) { nativeSpeak(x); });
            }
          }, 350);
        }
      } catch (e) { try { nativeSpeak(u); } catch (_) {} }
    };
  }

  window.falarTexto = function (texto, lang, cb) {
    if (!temSintese) return false;
    try {
      ss.cancel();
      // iPhone: com os efeitos sonoros ligados a voz fica muda. Pausa os efeitos enquanto fala.
      try { if (window.__audioCtx && window.__audioCtx.state === 'running') window.__audioCtx.suspend(); } catch (e) {}
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      var u = new SpeechSynthesisUtterance(String(texto));
      u.lang = lang || 'pt-BR'; u.rate = 0.9; u.volume = 1;
      var st = window.__ultimaFala = { comecou: false, terminou: false, erro: '' };
      u.onstart = function () { st.comecou = true; };
      u.onend = function () { st.terminou = true; if (cb) cb(); };
      u.onerror = function (e) { st.erro = (e && e.error) || 'erro'; if (cb) cb(); };
      ss.speak(u);
      return true;
    } catch (e) { return false; }
  };
  window.temVoz = function (lang) { carregar(); return temSintese && (voices.length === 0 || !!escolherVoz(lang)); };
  window.podeFalar = temSintese;
  window.infoVoz = function () {
    carregar();
    return { podeFalar: temSintese, total: voices.length,
      pt: voices.filter(function (v) { return /^pt/i.test(v.lang); }).length,
      en: voices.filter(function (v) { return /^en/i.test(v.lang); }).length,
      audio: !!AC, estadoAudio: window.__audioCtx ? window.__audioCtx.state : 'ainda não iniciado' };
  };

  // Primeiro toque: libera os efeitos sonoros. No iPhone (Safari 17+), toca mesmo com a chave de silencioso.
  var liberado = false;
  function liberar() {
    if (liberado) return; liberado = true;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    var ctx = window.pegarAudio();
    try { // um "clique" mudo destrava o áudio no iOS
      if (ctx) { var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); }
    } catch (e) {}
    ['touchend', 'pointerup', 'click', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, liberar, true); });
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, liberar, true); });
})();
