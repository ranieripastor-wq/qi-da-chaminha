// Adedonha da Chaminha (Stop): letra sorteada, todos escrevem, alguém grita STOP, a turma vota e conta os pontos.
// Usa a mesma sala do duelo (arena.js); o anfitrião comanda e confere tudo.
const AD_CATS = ['Nome', 'Animal', 'Fruta ou comida', 'Cor', 'Cidade ou país', 'Objeto'];
const AD_LETRAS = 'ABCDEFGILMNOPRSTV'; // sem letras quase impossíveis (K, W, X, Y, Z, Q, H, J, U)
const AD_TEMPO = 90, AD_VOTO = 30;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---------- pontuação (pura, testável) ----------
// tabela: {pid: [resp por categoria]}; votos: {pid: ['alvo|cat', ...]} → {pid: {pts, det:[pontos por categoria]}}
function adPontuar(tabela, letra, votos) {
  const pids = Object.keys(tabela), L = norm(letra), res = {};
  const contra = {};
  Object.entries(votos).forEach(([quem, lista]) => (lista || []).forEach(k => { if (!k.startsWith(quem + '|')) contra[k] = (contra[k] || 0) + 1; }));
  const valida = (pid, c) => { const r = norm(tabela[pid][c]); return r.length >= 2 && r[0] === L && (contra[pid + '|' + c] || 0) * 2 < pids.length - 1 || false; };
  pids.forEach(p => { res[p] = { pts: 0, det: [] }; });
  AD_CATS.forEach((_, c) => {
    const validas = pids.filter(p => valida(p, c));
    pids.forEach(p => {
      let v = 0;
      if (validas.includes(p)) { const iguais = validas.filter(q => norm(tabela[q][c]) === norm(tabela[p][c])).length; v = iguais > 1 ? 5 : validas.length === 1 ? 20 : 10; }
      res[p].det[c] = v; res[p].pts += v;
    });
  });
  return res;
}

// ---------- telas ----------
function adFase(f) { ['adEscrever', 'adVotar', 'adResultado'].forEach(id => { $(id).style.display = id === f ? '' : 'none'; }); }
function adRelogio(seg, aoAcabar) {
  const a = arena; clearInterval(a.adRel);
  const ini = performance.now();
  a.adRel = setInterval(() => {
    const resta = 1 - (performance.now() - ini) / (seg * 1000);
    $('adBarra').style.width = Math.max(0, resta * 100) + '%'; $('adBarra').style.background = resta < .2 ? 'var(--vermelho)' : '';
    $('adTempo').textContent = Math.max(0, Math.ceil(resta * seg)) + 's';
    if (resta <= 0) { clearInterval(a.adRel); aoAcabar(); }
  }, 200);
}

function adMostrarRodada(letra, rodada) {
  const a = arena; a.adLetra = letra; a.adRodada = rodada; a.adParou = false;
  mostrar('adedonha'); adFase('adEscrever');
  $('adTitulo').textContent = `🔤 Adedonha · rodada ${rodada}`;
  $('adStatus').textContent = 'Escreva uma palavra para cada item. Quem terminar aperta STOP!';
  const f = $('adCampos'); f.innerHTML = '';
  AD_CATS.forEach((c, i) => {
    const l = document.createElement('label'); l.className = 'adCampo';
    l.innerHTML = `<span>${c}</span><input data-c="${i}" maxlength="24" autocomplete="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="next">`;
    f.appendChild(l);
  });
  f.querySelectorAll('input').forEach((inp, i, todos) => {
    inp.oninput = () => { const ok = [...todos].every(x => norm(x.value)[0] === norm(letra)); $('adStop').disabled = !ok; inp.classList.toggle('ruim', !!inp.value && norm(inp.value)[0] !== norm(letra)); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); (todos[i + 1] || $('adStop')).focus(); } };
  });
  $('adStop').disabled = true;
  // sorteio da letra girando
  let giros = 0; const roleta = setInterval(() => {
    $('adLetra').textContent = giros++ < 12 ? AD_LETRAS[Math.floor(Math.random() * AD_LETRAS.length)] : letra;
    clique();
    if (giros > 12) { clearInterval(roleta); vibrar(60); adRelogio(AD_TEMPO, () => { if (a.host) adParar(null); }); }
  }, 80);
}
const adMinhas = () => [...document.querySelectorAll('#adCampos input')].map(x => x.value.trim().slice(0, 24));

function adTravar(quem) {
  const a = arena; if (a.adParou) return; a.adParou = true;
  clearInterval(a.adRel);
  document.querySelectorAll('#adCampos input').forEach(x => { x.disabled = true; });
  $('adStop').disabled = true;
  $('adStatus').textContent = quem ? `✋ ${quem} gritou STOP!` : '⏰ Acabou o tempo!';
  somErro(); vibrar([80, 60, 80]);
  if (a.host) adReceberResp(a.eu, adMinhas()); else a.conn.send({ t: 'ad_resp', resps: adMinhas() });
}

function adMostrarVotacao(tabela) {
  const a = arena; a.adVotos = new Set(); adFase('adVotar');
  const pids = Object.keys(tabela);
  $('adVotos').innerHTML = AD_CATS.map((c, i) => `<div class="adCat"><b>${c} com ${a.adLetra}</b>${pids.map(p => {
    const r = tabela[p][i], vazio = !r || norm(r)[0] !== norm(a.adLetra);
    return `<button class="adResp${vazio ? ' vazio' : ''}${p === a.eu ? ' minha' : ''}" data-k="${p}|${i}" ${vazio || p === a.eu ? 'disabled' : ''}>${TIMES[a.jog[p]?.time || 0][0]} ${esc(a.jog[p]?.nome || '?')}: <i>${esc(r || '—')}</i></button>`;
  }).join('')}</div>`).join('');
  $('adVotos').querySelectorAll('.adResp:not([disabled])').forEach(b => b.onclick = () => {
    clique(); const k = b.dataset.k; a.adVotos.has(k) ? a.adVotos.delete(k) : a.adVotos.add(k); b.classList.toggle('negada', a.adVotos.has(k));
    const lista = [...a.adVotos]; if (a.host) a.adVotosTodos[a.eu] = lista; else a.conn.send({ t: 'ad_voto', votos: lista });
  });
  $('adFimVoto').style.display = a.host ? '' : 'none';
  adRelogio(AD_VOTO, () => { if (a.host) adFecharVotacao(); });
}

function adMostrarResultado(m) {
  const a = arena; a.jog = m.jog; adFase('adResultado'); clearInterval(a.adRel);
  const linhas = Object.entries(m.rodada).sort((x, y) => y[1].pts - x[1].pts);
  const t0 = Object.values(a.jog).filter(j => j.time === 0).reduce((s, j) => s + j.pts, 0), t1 = Object.values(a.jog).filter(j => j.time === 1).reduce((s, j) => s + j.pts, 0);
  $('adPlacar').innerHTML = `<div class="adTimes"><span>🔥 Time Chaminha <b>${t0}</b></span><span>❄️ Time Gelinho <b>${t1}</b></span></div>`
    + linhas.map(([p, r], k) => `<div class="linhaRank${p === a.eu ? ' voce' : ''}"><b>${k + 1}º</b><span>${TIMES[a.jog[p]?.time || 0][0]} ${esc(a.jog[p]?.nome || '?')} <small>(${r.det.map(v => v || '·').join(' ')})</small></span>+${r.pts}</div>`).join('')
    + '<small style="color:#B89878;display:block;margin-top:6px">20 = só você acertou · 10 = resposta diferente · 5 = repetida · 0 = vazia, letra errada ou a turma não aceitou</small>';
  const meu = m.rodada[a.eu]?.pts || 0;
  if (meu) { somAcerto(); faiscas(innerWidth / 2, innerHeight / 3); }
  guardar('xp', ler('xp', 0) + meu); marcarDia();
  $('adProxima').style.display = a.host ? '' : 'none'; $('adEncerrar').style.display = a.host ? '' : 'none';
  $('adStatus2').textContent = a.host ? '' : 'Esperando o anfitrião sortear a próxima letra...';
}

// ---------- anfitrião ----------
function adComecar() {
  const a = arena; if (!a || Object.keys(a.jog).length < 2) return;
  if (!a.adRodando) { Object.values(a.jog).forEach(j => Object.assign(j, { pts: 0, fora: false })); a.adNum = 0; a.adUsadas = []; }
  a.adRodando = true; a.rodando = true; a.adNum++;
  Object.values(a.jog).forEach(j => { j.fora = false; });
  const livres = [...AD_LETRAS].filter(l => !a.adUsadas.includes(l));
  const letra = (livres.length ? livres : [...AD_LETRAS])[Math.floor(Math.random() * (livres.length || AD_LETRAS.length))];
  a.adUsadas.push(letra); a.adTabela = {}; a.adVotosTodos = {}; a.adFase = 'escrever';
  avisarTodos({ t: 'ad_inicio', letra, rodada: a.adNum, jog: a.jog });
  adMostrarRodada(letra, a.adNum);
}
function adParar(quemPid) {
  const a = arena; if (a.adFase !== 'escrever') return;
  a.adFase = 'recolher';
  const quem = quemPid ? a.jog[quemPid]?.nome : null;
  avisarTodos({ t: 'ad_parar', quem }); adTravar(quem);
  a.espera = setTimeout(adAbrirVotacao, 2500); // tempo para as respostas chegarem
}
function adReceberResp(pid, resps) {
  const a = arena; if (!a.jog[pid] || a.adFase === 'votar' || a.adFase === 'fim') return;
  a.adTabela[pid] = AD_CATS.map((_, i) => String(resps?.[i] || '').replace(/[<>]/g, '').slice(0, 24));
  if (Object.keys(a.jog).filter(p => !a.jog[p].fora).every(p => a.adTabela[p])) { clearTimeout(a.espera); adAbrirVotacao(); }
}
function adAbrirVotacao() {
  const a = arena; if (a.adFase === 'votar') return;
  a.adFase = 'votar';
  Object.keys(a.jog).filter(p => !a.jog[p].fora).forEach(p => { a.adTabela[p] ||= AD_CATS.map(() => ''); });
  avisarTodos({ t: 'ad_votacao', tabela: a.adTabela }); adMostrarVotacao(a.adTabela);
}
function adFecharVotacao() {
  const a = arena; if (a.adFase !== 'votar') return;
  a.adFase = 'fim'; clearInterval(a.adRel);
  const rodada = adPontuar(a.adTabela, a.adLetra, a.adVotosTodos);
  Object.entries(rodada).forEach(([p, r]) => { if (a.jog[p]) a.jog[p].pts += r.pts; });
  const m = { t: 'ad_resultado', rodada, jog: a.jog };
  avisarTodos(m); adMostrarResultado(m);
}
function adHost(pid, m) {
  const a = arena;
  if (m.t === 'ad_stop' && a.adFase === 'escrever') adParar(pid);
  if (m.t === 'ad_resp') adReceberResp(pid, m.resps);
  if (m.t === 'ad_voto' && a.adFase === 'votar') a.adVotosTodos[pid] = (m.votos || []).slice(0, 200);
}
function adEncerrar() {
  const a = arena; a.adRodando = false; a.rodando = false;
  avisarTodos({ t: 'ad_fim', jog: a.jog }); adFinal();
}

// ---------- convidado ----------
function adGuest(m) {
  const a = arena;
  if (m.jog) a.jog = m.jog;
  if (m.t === 'ad_inicio') { $('fimArena').style.display = 'none'; adMostrarRodada(m.letra, m.rodada); }
  if (m.t === 'ad_parar') adTravar(m.quem);
  if (m.t === 'ad_votacao') adMostrarVotacao(m.tabela);
  if (m.t === 'ad_resultado') adMostrarResultado(m);
  if (m.t === 'ad_fim') adFinal();
}

// fim do jogo: reaproveita a caixa de fim do duelo
function adFinal() {
  const a = arena; clearInterval(a.adRel);
  a.perguntas = a.perguntas || []; a.modo = 'duelo';
  Object.values(a.jog).forEach(j => { j.acertos = 0; });
  fimArena();
  $('fimArenaXP').textContent = 'Adedonha encerrada! Os pontos já foram somados ao seu XP.';
  $('fimRevanche').style.display = a.host ? '' : 'none'; $('fimRevanche').textContent = '🔤 Jogar de novo';
}

// ---------- botões ----------
$('adStop').onclick = () => { const a = arena; if (!a || a.adParou) return; if (a.host) adParar(a.eu); else a.conn.send({ t: 'ad_stop' }); };
$('adFimVoto').onclick = () => { clique(); adFecharVotacao(); };
$('adProxima').onclick = () => { clique(); adComecar(); };
$('adEncerrar').onclick = () => { clique(); adEncerrar(); };
$('adSair').onclick = () => { clique(); pararArena(); abrirDuelo(); };

// autoteste da pontuação (roda uma vez, só avisa no console se algo quebrar)
{
  const t = adPontuar({ a: ['Ana', 'Abelha', 'Abacaxi', 'Azul', 'Acre', 'Agulha'], b: ['Ana', 'Anta', 'Banana', 'Amarelo', '', 'Anel'], c: ['Alice', 'Abelha', 'Amora', 'Azul', 'Argentina', 'Agulha'] }, 'A', { b: ['c|5'], a: ['c|5'] });
  console.assert(t.a.det[0] === 5 && t.c.det[0] === 10 && t.b.det[2] === 0 && t.b.det[4] === 0 && t.c.det[4] === 10 && t.c.det[5] === 0 && t.a.det[5] === 10 && t.a.pts === 45, 'adPontuar', t);
}
