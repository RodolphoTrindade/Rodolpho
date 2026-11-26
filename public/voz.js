// Central Família — deixa a leitura em voz alta e os sons confiáveis em qualquer aparelho.
// Corrige: fala que some ao cancelar e falar em seguida (Chrome/Android), aparelho sem voz escolhida,
// textos longos cortados no meio (Chrome), áudio travado em "pausa" e iPhone/iPad que só liberam som após um toque.
(function () {
  'use strict';
  // ---------- efeitos sonoros (Web Audio): destrava no primeiro toque
  var AC = window.AudioContext || window.webkitAudioContext;
  window.__audioCtx = null;
  window.pegarAudio = function () {
    try {
      if (!AC) return null;
      if (!window.__audioCtx) window.__audioCtx = new AC();
      if (window.__audioCtx.state === 'suspended') window.__audioCtx.resume();
      return window.__audioCtx;
    } catch (e) { return null; }
  };

  var ss = window.speechSynthesis;
  var temSintese = !!ss && typeof window.SpeechSynthesisUtterance !== 'undefined';
  var nativeSpeak = temSintese ? ss.speak.bind(ss) : null;
  var nativeCancel = temSintese ? ss.cancel.bind(ss) : null;
  var voices = [];
  var ultimoCancel = 0;
  window.__falando = [];

  function carregar() { try { voices = ss.getVoices() || []; } catch (e) {} }
  if (temSintese) {
    carregar();
    try { ss.addEventListener('voiceschanged', carregar); } catch (e) { ss.onvoiceschanged = carregar; }
  }

  function escolherVoz(lang) {
    carregar();
    var L = String(lang || 'pt-BR').toLowerCase().replace('_', '-');
    var base = L.split('-')[0];
    var exatas = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().replace('_', '-') === L; });
    var mesmas = voices.filter(function (v) { return v.lang && v.lang.toLowerCase().replace('_', '-').indexOf(base) === 0; });
    var lista = exatas.length ? exatas : mesmas;
    if (!lista.length) return null;
    return lista.find(function (v) { return /google|natural|online|neural|premium|enhanced|luciana|francisca|maria|thalita/i.test(v.name); })
      || lista.find(function (v) { return v.localService; }) || lista[0];
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
    ss.cancel = function () { ultimoCancel = Date.now(); window.__falando = []; try { nativeCancel(); } catch (e) {} };
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
        window.__falando = window.__falando.concat(lista); // mantém referência (Chrome para a fala se o objeto sumir)
        var falar = function () { try { ss.resume(); } catch (e) {} lista.forEach(function (x) { nativeSpeak(x); }); };
        var espera = Date.now() - ultimoCancel < 160 ? 160 : 0;
        if (espera) setTimeout(falar, espera); else falar();
      } catch (e) { try { nativeSpeak(u); } catch (_) {} }
    };
  }

  // Leitura simples para a central; devolve false se o aparelho não consegue falar.
  window.falarTexto = function (texto, lang) {
    if (!temSintese) return false;
    try {
      ss.cancel();
      var u = new SpeechSynthesisUtterance(String(texto));
      u.lang = lang || 'pt-BR'; u.rate = 0.9;
      ss.speak(u);
      return true;
    } catch (e) { return false; }
  };
  window.temVoz = function (lang) { return temSintese && (!!escolherVoz(lang) || voices.length === 0); };
  window.podeFalar = temSintese;

  // Primeiro toque: libera som e voz (exigência do iPhone/iPad)
  var liberado = false;
  function liberar() {
    if (liberado) return; liberado = true;
    window.pegarAudio();
    try { if (temSintese) { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; nativeSpeak(u); } } catch (e) {}
    ['touchend', 'click', 'keydown'].forEach(function (ev) { document.removeEventListener(ev, liberar, true); });
  }
  ['touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, liberar, true); });

})();
