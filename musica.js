// Fundo musical gerado na hora (Web Audio): sem arquivo, sem direito autoral de terceiros. Botão 🎵 próprio, separado dos efeitos.
// Melodia calma em Dó maior, 84 batidas por minuto: acordes macios + arpejo leve, em ciclo de 8 compassos.
const Musica = (() => {
  const BPM = 84, B = 60 / BPM, VOL = 0.05;
  const hz = n => 440 * 2 ** ((n - 69) / 12); // nota MIDI -> Hz
  // acordes (MIDI) de cada compasso: C, Am, F, G, C, Em, F, G
  const ACORDES = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [52, 55, 59], [53, 57, 60], [55, 59, 62]];
  // melodia: [compasso, tempo dentro do compasso, nota, duração em tempos]
  const MELODIA = [[0, 0, 76, 1], [0, 1.5, 79, .5], [0, 2, 77, 1], [0, 3, 76, 1], [1, 0, 72, 2], [1, 2.5, 74, 1.5],
    [2, 0, 72, 1], [2, 1, 69, 1], [2, 2, 72, 2], [3, 0, 74, 3], [4, 0, 76, 1], [4, 1, 79, 1], [4, 2, 84, 2],
    [5, 0, 83, 1], [5, 1, 79, 2], [6, 0, 81, 1], [6, 1, 77, 1], [6, 2, 76, 1], [6, 3, 74, 1], [7, 0, 72, 2], [7, 2, 71, 2]];
  let ctx, mestre, timer, proximo = 0, compasso = 0, ligada = ler('musica', true), tocando = false;

  function nota(f, t, dur, tipo, vol, ataque = .02) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = f; o.connect(g); g.connect(mestre);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    o.start(t); o.stop(t + dur + .05);
  }
  function agenda() {
    // agenda os compassos que começam nos próximos 1,5 s
    while (proximo < ctx.currentTime + 1.5) {
      const c = compasso % 8, t0 = proximo;
      ACORDES[c].forEach(n => nota(hz(n), t0, B * 4, 'sine', .22, .4)); // acorde macio, o compasso inteiro
      nota(hz(ACORDES[c][0] - 12), t0, B * 2, 'sine', .3, .05); nota(hz(ACORDES[c][0] - 12), t0 + B * 2, B * 2, 'sine', .25, .05); // baixo
      [0, 1, 2, 1].forEach((k, i) => nota(hz(ACORDES[c][k] + 12), t0 + i * B + B / 2, B * .9, 'triangle', .07)); // arpejo leve
      MELODIA.filter(m => m[0] === c).forEach(([, b, n, d]) => nota(hz(n), t0 + b * B, d * B, 'triangle', .16));
      proximo += B * 4; compasso++;
    }
  }
  function tocar() {
    if (!ligada || tocando || document.hidden) return;
    try {
      ctx = ctx || new AudioContext();
      if (!mestre) { mestre = ctx.createGain(); mestre.connect(ctx.destination); }
      ctx.resume();
      mestre.gain.cancelScheduledValues(ctx.currentTime); mestre.gain.setValueAtTime(0, ctx.currentTime); mestre.gain.linearRampToValueAtTime(VOL, ctx.currentTime + 2);
      proximo = ctx.currentTime + .1; tocando = true; agenda(); timer = setInterval(agenda, 400);
    } catch {}
  }
  function parar() {
    if (!tocando) return; tocando = false; clearInterval(timer);
    try { mestre.gain.cancelScheduledValues(ctx.currentTime); mestre.gain.setValueAtTime(mestre.gain.value, ctx.currentTime); mestre.gain.linearRampToValueAtTime(0, ctx.currentTime + .3);
      setTimeout(() => { if (!tocando) ctx.suspend(); }, 400); } catch {}
  }
  function botao() { const b = $('musicaInicio'); if (!b) return; b.style.opacity = ligada ? 1 : .45; b.setAttribute('aria-pressed', ligada); }
  function alternar() { ligada = !ligada; guardar('musica', ligada); botao(); ligada ? tocar() : parar(); }
  // o navegador só deixa tocar som depois de um toque na tela
  addEventListener('pointerdown', () => tocar(), { once: true });
  // app em segundo plano ou tela apagada: silêncio
  document.addEventListener('visibilitychange', () => document.hidden ? parar() : tocar());
  addEventListener('DOMContentLoaded', botao); botao();
  // a Chaminha falando: música bem baixinho
  function abaixar(sim) { if (!tocando) return; try { mestre.gain.cancelScheduledValues(ctx.currentTime); mestre.gain.setValueAtTime(mestre.gain.value, ctx.currentTime); mestre.gain.linearRampToValueAtTime(sim ? VOL * .3 : VOL, ctx.currentTime + .25); } catch {} }
  return { abaixar, alternar, tocar, parar, estado: () => (tocando ? 'tocando ' : 'parada ') + (ctx ? ctx.state : 'sem audio') };
})();
