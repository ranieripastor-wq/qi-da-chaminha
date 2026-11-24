// Arena: quiz por assunto (sozinho) e duelo ao vivo de 2 a 20 pessoas, Time Chaminha × Time Gelinho.
// Conexão direta entre os celulares (PeerJS): o anfitrião recebe todos e comanda o ritmo.
const POR_DUELO = 10, TEMPO_Q = 12, MAX_JOG = 20;
const misturar = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const TIMES = [['🔥', 'Time Chaminha'], ['❄️', 'Time Gelinho']];

function gelinho(t = 90, feliz = true) {
  return `<svg width="${t}" height="${t * 1.1}" viewBox="0 0 100 110">
    <path d="M50 2 l5 10 l-5 4 l-5 -4z" fill="#BDEBFF" stroke="#123A5A" stroke-width="3" stroke-linejoin="round"/>
    <rect x="10" y="18" width="80" height="84" rx="22" fill="#7FD1F5" stroke="#123A5A" stroke-width="4"/>
    <rect x="18" y="26" width="64" height="66" rx="16" fill="#BDEBFF"/>
    <path d="M24 34 q4 -6 14 -6" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="58" r="5" fill="#123A5A"/><circle cx="62" cy="58" r="5" fill="#123A5A"/>
    <circle cx="40" cy="56" r="1.6" fill="#fff"/><circle cx="64" cy="56" r="1.6" fill="#fff"/>
    <ellipse cx="28" cy="70" rx="5" ry="3" fill="#4AA8E0" opacity=".45"/><ellipse cx="72" cy="70" rx="5" ry="3" fill="#4AA8E0" opacity=".45"/>
    <path d="${feliz ? 'M40 70 Q50 80 60 70' : 'M42 76 Q50 70 58 76'}" stroke="#123A5A" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}
const mascoteTime = (t, tam) => t ? gelinho(tam) : chaminha(tam);

// ---------- perguntas ----------
function sortearPerguntas(cat, n) {
  const cats = cat === 'mix' ? Object.keys(TEMAS) : [cat];
  const todas = cats.flatMap(c => TEMAS[c][2].map((q, i) => ({ c, i, q })));
  // evita repetir as perguntas vistas há pouco neste aparelho
  const vistasQ = ler('vistasQuiz', []), novas = todas.filter(x => !vistasQ.includes(x.c + x.i));
  const escolhidas = misturar(novas.length >= n ? novas : todas).slice(0, n);
  guardar('vistasQuiz', [...vistasQ, ...escolhidas.map(x => x.c + x.i)].slice(-Math.floor(todas.length * .7)));
  return escolhidas.map(({ c, q: [p, certa, erradas, exp] }) => ({ c, p, certa, exp, ops: misturar([certa, ...erradas]) }));
}

// ---------- estado ----------
// arena = { modo:'solo'|'duelo', host, eu:pid, jog:{pid:{nome,time,pts,acertos,resp,fora}}, perguntas, i, conns:{pid:conn}, conn, peer }
let arena = null;
const jogando = a => Object.entries(a.jog).filter(([, j]) => !j.fora);
const somaTime = (a, t) => jogando(a).filter(([, j]) => j.time === t).reduce((s, [, j]) => s + j.pts, 0);
const ordenados = a => jogando(a).sort((x, y) => y[1].pts - x[1].pts);
const meuLugar = a => ordenados(a).findIndex(([p]) => p === a.eu) + 1;

function abrirDuelo() {
  pararArena();
  const lista = $('catLista'); lista.innerHTML = '';
  [['mix', '🎲', 'Misturado'], ...Object.entries(TEMAS).map(([k, [ic, nome]]) => [k, ic, nome])].forEach(([k, ic, nome], n) => {
    const b = document.createElement('button'); b.className = 'btn chip'; b.dataset.cat = k;
    b.setAttribute('aria-pressed', n === 0); b.innerHTML = `${ic} ${nome}`;
    b.onclick = () => { clique(); lista.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b)); };
    lista.appendChild(b);
  });
  $('dueloEspera').style.display = 'none'; $('dueloMenu').style.display = 'flex';
  $('dueloRecorde').textContent = `🏆 Vitórias em duelos: ${ler('vitorias', 0)}`;
  mostrar('duelo');
}
const catEscolhida = () => document.querySelector('#catLista .chip[aria-pressed="true"]')?.dataset.cat || 'mix';
const nomeCat = c => c === 'mix' || !TEMAS[c] ? '🎲 Misturado' : `${TEMAS[c][0]} ${TEMAS[c][1]}`;

function pararArena() {
  if (!arena) return;
  clearInterval(arena.relogio); clearInterval(arena.adRel); clearInterval(arena.adRoleta); clearTimeout(arena.espera);
  try { arena.conn?.close(); } catch {} Object.values(arena.conns || {}).forEach(c => { try { c.close(); } catch {} });
  try { arena.peer?.destroy(); } catch {}
  arena = null;
}

// ---------- placar ----------
function desenhaPlacar() {
  const a = arena; if (!a) return;
  const js = jogando(a);
  let html;
  if (a.modo === 'solo') html = `<div class="lado fogo">${chaminha(54)}<span>${esc(ler('apelido', '') || 'Você')}</span><b>${a.jog[a.eu].pts}</b></div>`;
  else if (js.length <= 2) {
    const lados = [0, 1].map(t => js.find(([, j]) => j.time === t));
    html = lados.map((l, t) => `<div class="lado ${t ? 'gelo' : 'fogo'}">${mascoteTime(t, 54)}<span>${l ? esc(l[1].nome) + (l[0] === a.eu ? ' (você)' : '') : '...'}</span><b>${l ? l[1].pts : 0}</b></div>`).join('<div class="vs">VS</div>');
  } else {
    html = [0, 1].map(t => `<div class="lado ${t ? 'gelo' : 'fogo'}">${mascoteTime(t, 44)}<span>${TIMES[t][1]} (${js.filter(([, j]) => j.time === t).length})</span><b>${somaTime(a, t)}</b></div>`).join('<div class="vs">VS</div>');
  }
  $('arenaPlacar').innerHTML = html;
  $('arenaPos').textContent = a.modo === 'duelo' && js.length > 2 ? `Você: ${TIMES[a.jog[a.eu].time][0]} ${meuLugar(a)}º de ${js.length} · ${a.jog[a.eu].pts} pontos` : '';
}

// ---------- pergunta ----------
function mostrarPergunta(i) {
  const a = arena, q = a.perguntas[i];
  clearTimeout(a.espera); a.i = i; a.respondeu = false; a.inicio = performance.now();
  if (a.diario) marcarDiario(a, false); // viu a pergunta e saiu: conta como erro
  $('arenaNum').textContent = `${TEMAS[q.c][0]} ${TEMAS[q.c][1]} · ${i + 1}/${a.perguntas.length}`;
  $('arenaPergunta').textContent = q.p;
  $('arenaExp').textContent = a.modo === 'duelo' ? 'Rápido! Quem responde primeiro ganha mais pontos.' : 'Responda antes do tempo acabar!';
  $('arenaExp').className = 'exp';
  const g = $('arenaOps'); g.innerHTML = '';
  q.ops.forEach(o => {
    const b = document.createElement('button'); b.className = 'opc'; b.textContent = o;
    b.onclick = () => responderArena(o, b); g.appendChild(b);
  });
  const barra = $('arenaBarra'); clearInterval(a.relogio);
  a.relogio = setInterval(() => {
    const resta = 1 - (performance.now() - a.inicio) / (TEMPO_Q * 1000);
    barra.style.width = Math.max(0, resta * 100) + '%'; barra.style.background = resta < .3 ? 'var(--vermelho)' : '';
    if (resta <= 0) { clearInterval(a.relogio); if (!a.respondeu) responderArena(null, null); }
  }, 100);
  desenhaPlacar();
}

function responderArena(escolha, el) {
  const a = arena; if (!a || a.respondeu || a.jog[a.eu]?.fora) return;
  a.respondeu = true;
  const q = a.perguntas[a.i], certo = escolha === q.certa;
  const resta = Math.max(0, 1 - (performance.now() - a.inicio) / (TEMPO_Q * 1000));
  const pts = certo ? 100 + Math.round(50 * resta) : 0;
  document.querySelectorAll('#arenaOps .opc').forEach(b => { b.disabled = true; if (b === el) b.classList.add(certo ? 'certo' : 'errado'); });
  if (certo) { som([[660, 0, .1], [880, .08, .18]]); vibrar(30); } else { somErro(); vibrar(120); }
  if (a.modo === 'solo') { pontuar(a.eu, a.i, pts); if (a.diario) marcarDiario(a, certo); revelar(); return; }
  $('arenaExp').textContent = (certo ? `✅ +${pts}!` : '❌ Errou...') + ' Esperando os outros...';
  if (a.host) { pontuar(a.eu, a.i, pts); avisarTodos({ t: 'placar', jog: a.jog }); checarFimQuestao(); }
  else a.conn.send({ t: 'r', i: a.i, pts });
}
function pontuar(pid, i, pts) {
  const j = arena.jog[pid]; if (!j || j.resp === i) return;
  j.resp = i; j.pts += pts; if (pts) j.acertos++;
  desenhaPlacar();
}

// mostra a certa e a explicação; no solo também avança
function revelar() {
  const a = arena, q = a.perguntas[a.i];
  clearInterval(a.relogio); a.respondeu = true;
  document.querySelectorAll('#arenaOps .opc').forEach(b => { b.disabled = true; if (b.textContent === q.certa) b.classList.add('certo'); });
  $('arenaExp').innerHTML = `<b>Você sabia?</b> ${esc(q.exp)}`; $('arenaExp').className = 'exp aprende';
  desenhaPlacar();
  if (a.modo === 'solo') a.espera = setTimeout(() => a.i + 1 < a.perguntas.length ? mostrarPergunta(a.i + 1) : fimArena(), 3200);
}

function fimArena() {
  const a = arena; if (!a) return;
  if (a.diario) return fimDiario();
  clearInterval(a.relogio); clearTimeout(a.espera);
  const eu = a.jog[a.eu], duelo = a.modo === 'duelo', js = ordenados(a);
  const ganho = eu.acertos * 10; guardar('xp', ler('xp', 0) + ganho); marcarDia();
  let titulo, svg, placar;
  if (!duelo) { titulo = `${eu.acertos} de ${a.perguntas.length} certas!`; svg = chaminha(90); placar = `${eu.pts} pontos`; }
  else {
    const t0 = somaTime(a, 0), t1 = somaTime(a, 1), venceu = t0 === t1 ? -1 : t0 > t1 ? 0 : 1, dois = js.length <= 2;
    if (venceu < 0) { titulo = 'Empate! 🤝'; svg = chaminha(70) + gelinho(70); }
    else {
      const meuTime = venceu === eu.time;
      const nomeVenc = dois ? (js.find(([, j]) => j.time === venceu)?.[1].nome || TIMES[venceu][1]) : TIMES[venceu][1];
      titulo = meuTime ? (dois ? 'VOCÊ VENCEU! 🏆' : `${TIMES[venceu][1]} VENCEU! 🏆`) : `${esc(nomeVenc)} venceu!`;
      svg = mascoteTime(venceu, 100);
      if (meuTime) { guardar('vitorias', ler('vitorias', 0) + 1); faiscas(innerWidth / 2, innerHeight / 3); somAcerto(); }
    }
    placar = (dois ? '' : `🔥 <b>${t0}</b> × <b>${t1}</b> ❄️<br>`) + js.slice(0, 5).map(([p, j], k) =>
      `<div class="linhaRank${p === a.eu ? ' voce' : ''}" style="margin-top:4px"><b>${k + 1}º</b><span>${TIMES[j.time][0]} ${esc(j.nome)}</span>${j.pts}</div>`).join('')
      + (meuLugar(a) > 5 ? `<div style="margin-top:4px">Você ficou em ${meuLugar(a)}º com ${eu.pts}</div>` : '');
  }
  $('fimArenaMascote').innerHTML = svg; $('fimArenaTitulo').innerHTML = titulo; $('fimArenaPlacar').innerHTML = placar;
  $('fimArenaXP').textContent = `+${ganho} XP · ${eu.acertos} acertos`;
  $('fimRevanche').style.display = '';
  $('fimRevanche').textContent = !duelo ? '🔁 Jogar de novo' : a.host ? '⚔️ Revanche' : '⚔️ Pedir revanche';
  $('fimArenaZap').onclick = () => compartilhar(duelo
    ? `⚔️ Fiquei em ${meuLugar(a)}º de ${js.length} no duelo ao vivo do QI da Chaminha (${eu.pts} pontos)! Quem encara a próxima?`
    : `🧠 Fiz ${eu.pts} pontos no quiz do QI da Chaminha (${eu.acertos}/${a.perguntas.length}). Duvido você:`);
  $('fimArena').style.display = 'flex';
}

// ---------- solo ----------
function iniciarSolo() {
  pararArena(); clique();
  arena = { modo: 'solo', eu: 'eu', jog: { eu: { nome: 'Você', time: 0, pts: 0, acertos: 0, resp: -1 } }, perguntas: sortearPerguntas(catEscolhida(), POR_DUELO), cat: catEscolhida() };
  $('fimArena').style.display = 'none'; mostrar('arena'); mostrarPergunta(0);
}

// ---------- conexão ----------
function carregarPeer() {
  if (window.Peer) return Promise.resolve();
  return new Promise((ok, erro) => {
    const s = document.createElement('script'); s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = ok; s.onerror = erro; document.head.appendChild(s);
  });
}
const codigoSala = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
const idSala = c => 'qichaminha-v1-' + c;
function statusDuelo(txt) { $('dueloStatus').textContent = txt; }
async function garantirApelido() { return ler('apelido', '') || await pedirApelido('Como os outros vão te ver no duelo?'); }
function avisarTodos(m) { Object.values(arena?.conns || {}).forEach(c => { try { c.open && c.send(m); } catch {} }); }

function telaEspera() {
  $('dueloMenu').style.display = 'none'; $('dueloEspera').style.display = ''; $('dueloConvite').style.display = 'none';
  $('comecarDuelo').style.display = 'none'; $('dueloJogadores').innerHTML = '';
}
function desenhaSala() {
  const a = arena; if (!a) return;
  const js = Object.entries(a.jog);
  $('dueloJogadores').innerHTML = `<div style="font-weight:800">${a.jogo === 'adedonha' ? '🔤 Adedonha' : nomeCat(a.cat)} · ${js.length} de ${MAX_JOG} jogadores</div>`
    + [0, 1].map(t => `<div class="timeSala ${t ? 'gelo' : 'fogo'}">${mascoteTime(t, 30)}<b>${TIMES[t][1]}</b>${js.filter(([, j]) => j.time === t).map(([p, j]) => `<span>${esc(j.nome)}${p === a.eu ? ' (você)' : ''}</span>`).join('') || '<span>ninguém ainda</span>'}</div>`).join('');
  if (a.host) {
    $('comecarDuelo').style.display = js.length >= 2 ? '' : 'none';
    $('comecarDuelo').textContent = `▶ Começar com ${js.length} jogadores`;
    statusDuelo(js.length >= 2 ? 'Quando todos entrarem, toque em Começar.' : 'Esperando os amigos entrarem... ⏳');
  } else statusDuelo('Você entrou! Esperando o anfitrião começar... ⏳');
}
function novoJogador(nome, time) { nome = String(nome || 'Amigo').replace(/[<>]/g, '').slice(0, 16); return { nome: feio(nome) ? 'Amigo' : nome, time, pts: 0, acertos: 0, resp: -1, fora: false }; }

// ---------- anfitrião ----------
async function criarDuelo(jogo = 'quiz') {
  clique(); const nome = await garantirApelido(); if (!nome) return;
  const cat = catEscolhida();
  pararArena(); telaEspera(); statusDuelo('Abrindo a sala...');
  try { await carregarPeer(); } catch { statusDuelo('Sem internet para o duelo agora. Tente de novo.'); return; }
  const codigo = codigoSala();
  arena = { modo: 'duelo', host: true, eu: 'h', codigo, cat, jogo, jog: { h: novoJogador(nome, 0) }, conns: {}, rodando: false };
  const peer = arena.peer = new Peer(idSala(codigo));
  peer.on('open', () => { $('dueloCodigo').textContent = codigo; $('dueloConvite').style.display = 'flex'; desenhaSala(); enviarConvite(); });
  peer.on('error', e => statusDuelo(e.type === 'unavailable-id' ? 'Código ocupado, crie outro.' : 'Não deu para abrir a sala. Confira a internet.'));
  peer.on('connection', conn => {
    conn.on('open', () => {
      const a = arena; if (!a) return conn.close();
      if (Object.keys(a.jog).length >= MAX_JOG) { conn.send({ t: 'cheia' }); return setTimeout(() => conn.close(), 500); }
      a.conns[conn.peer] = conn;
    });
    conn.on('data', m => doConvidado(conn.peer, m));
    conn.on('close', () => {
      const a = arena; if (!a?.jog[conn.peer]) return;
      delete a.jog[conn.peer]; delete a.conns[conn.peer];
      avisarTodos({ t: 'sala', jog: a.jog, cat: a.cat, jogo: a.jogo }); desenhaSala(); desenhaPlacar();
      if (a.rodando && a.jogo === 'quiz') checarFimQuestao();
    });
  });
}
function enviarConvite() {
  const a = arena; if (!a) return;
  compartilhar(a.jogo === 'adedonha' ? `🔤 ${a.jog[a.eu].nome} abriu uma ADEDONHA AO VIVO no QI da Chaminha!\nLetra sorteada, todo mundo escreve e quem terminar grita STOP. Até ${MAX_JOG} pessoas. Entra agora:` : `⚔️ ${a.jog[a.eu].nome} abriu um DUELO AO VIVO no QI da Chaminha! Tema: ${nomeCat(a.cat)}\n🔥 Time Chaminha × Time Gelinho ❄️ · até ${MAX_JOG} pessoas. Entra agora:`,
    SITE + '?duelo=' + a.codigo);
}
function doConvidado(pid, m) {
  const a = arena; if (!a || !m) return;
  if (m.t === 'oi' && !a.jog[pid] && Object.keys(a.jog).length < MAX_JOG) {
    const n0 = Object.values(a.jog).filter(j => j.time === 0).length, n1 = Object.values(a.jog).length - n0;
    a.jog[pid] = novoJogador(m.nome, n0 <= n1 ? 0 : 1);
    a.jog[pid].fora = a.rodando; // quem chega no meio entra na próxima rodada
    a.conns[pid]?.send({ t: 'bemvindo', eu: pid, rodando: a.rodando });
    avisarTodos({ t: 'sala', jog: a.jog, cat: a.cat, jogo: a.jogo }); desenhaSala(); desenhaPlacar();
  }
  if (m.t?.startsWith('ad_')) adHost(pid, m);
  if (m.t === 'r' && a.rodando && m.i === a.i && !a.jog[pid]?.fora) {
    pontuar(pid, m.i, Math.max(0, Math.min(150, m.pts | 0))); // limite: ninguém manda mais do que o máximo possível
    avisarTodos({ t: 'placar', jog: a.jog }); checarFimQuestao();
  }
  if (m.t === 'revanche' && !a.rodando) $('fimArenaXP').textContent = `${a.jog[pid]?.nome || 'Alguém'} quer revanche!`;
}
function comecarRodada() {
  const a = arena; if (!a || Object.keys(a.jog).length < 2) return;
  a.perguntas = sortearPerguntas(a.cat, POR_DUELO); a.rodando = true; a.fechada = -1;
  Object.values(a.jog).forEach(j => Object.assign(j, { pts: 0, acertos: 0, resp: -1, fora: false }));
  avisarTodos({ t: 'inicio', perguntas: a.perguntas, jog: a.jog });
  $('fimArena').style.display = 'none'; mostrar('arena');
  contagem(() => proximaQuestao(0));
}
function proximaQuestao(i) {
  const a = arena; if (!a) return;
  if (i >= a.perguntas.length) { a.rodando = false; avisarTodos({ t: 'fim', jog: a.jog }); fimArena(); return; }
  avisarTodos({ t: 'q', i }); mostrarPergunta(i);
  a.espera = setTimeout(() => fecharQuestao(i), (TEMPO_Q + 1.5) * 1000); // folga para as respostas chegarem
}
function checarFimQuestao() {
  const a = arena; if (!a?.rodando) return;
  if (jogando(a).every(([, j]) => j.resp === a.i)) { clearTimeout(a.espera); a.espera = setTimeout(() => fecharQuestao(a.i), 400); }
}
function fecharQuestao(i) {
  const a = arena; if (!a || a.i !== i || a.fechada === i) return;
  a.fechada = i; avisarTodos({ t: 'revela', i, jog: a.jog }); revelar();
  a.espera = setTimeout(() => proximaQuestao(i + 1), 3400);
}

// ---------- convidado ----------
async function entrarDuelo(codigo) {
  const nome = await garantirApelido(); if (!nome) { mostrar('inicio'); return; }
  pararArena(); abrirDuelo(); telaEspera(); statusDuelo('Entrando no duelo...');
  try { await carregarPeer(); } catch { statusDuelo('Sem internet para o duelo agora.'); return; }
  arena = { modo: 'duelo', host: false, eu: null, codigo, jog: {} };
  const peer = arena.peer = new Peer();
  peer.on('open', () => {
    const conn = arena.conn = peer.connect(idSala(codigo), { reliable: true });
    conn.on('open', () => conn.send({ t: 'oi', nome }));
    conn.on('data', m => doAnfitriao(m));
    conn.on('close', () => {
      if (!arena) return; clearInterval(arena.relogio); clearTimeout(arena.espera);
      statusDuelo('O anfitrião fechou o duelo.');
      if (document.querySelector('#arena.ativa') && !arena.acabou) { $('arenaExp').textContent = 'O anfitrião saiu do duelo.'; fimArena(); }
    });
    setTimeout(() => { if (arena && !arena.eu) statusDuelo('Não achei a sala. O duelo pode ter acabado: peça um link novo.'); }, 10000);
  });
  peer.on('error', e => statusDuelo(e.type === 'peer-unavailable' ? 'Essa sala não existe mais. Peça um link novo.' : 'Não deu para conectar. Confira a internet.'));
}
// o anfitrião é outro celular: tudo o que ele manda é conferido antes de ir para a tela
const idOk = k => /^[\w-]{1,64}$/.test(k);
const num = (v, max = 1e6) => Math.max(0, Math.min(max, Number(v) || 0));
function limpaMsg(m) {
  if (m.jog) m.jog = Object.fromEntries(Object.entries(m.jog || {}).filter(([k]) => idOk(k)).slice(0, MAX_JOG + 2).map(([k, j]) =>
    [k, { ...novoJogador(j?.nome, j?.time === 1 ? 1 : 0), pts: num(j?.pts), acertos: num(j?.acertos, 999), resp: Number.isInteger(j?.resp) ? j.resp : -1, fora: !!j?.fora }]));
  if (m.cat !== undefined && m.cat !== 'mix' && !TEMAS[m.cat]) m.cat = 'mix';
  if (m.jogo !== undefined && m.jogo !== 'adedonha') m.jogo = 'duelo';
  if (m.eu !== undefined) m.eu = idOk(String(m.eu)) ? String(m.eu) : '';
  if (m.i !== undefined) m.i = Number.isInteger(m.i) ? m.i : -1;
  if (m.perguntas) m.perguntas = (Array.isArray(m.perguntas) ? m.perguntas : []).filter(q => q && TEMAS[q.c] && Array.isArray(q.ops)).slice(0, 50);
  if (m.letra !== undefined) m.letra = String(m.letra).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'A';
  if (m.rodada !== undefined) m.rodada = typeof m.rodada === 'object' && m.rodada ? Object.fromEntries(Object.entries(m.rodada).filter(([k]) => idOk(k))
    .map(([k, r]) => [k, { pts: num(r?.pts, 999), det: (Array.isArray(r?.det) ? r.det : []).slice(0, 10).map(v => num(v, 99)) }])) : num(m.rodada, 99);
  if (m.tabela) m.tabela = Object.fromEntries(Object.entries(m.tabela || {}).filter(([k]) => idOk(k))
    .map(([k, l]) => [k, (Array.isArray(l) ? l : []).slice(0, 10).map(r => String(r ?? '').slice(0, 24))]));
  if (m.quem !== undefined) m.quem = idOk(String(m.quem)) ? String(m.quem) : null;
  return m;
}
function doAnfitriao(m) {
  const a = arena; if (!a || !m || typeof m !== 'object') return;
  limpaMsg(m);
  if (m.t === 'cheia') return statusDuelo(`Esse duelo já tem ${MAX_JOG} jogadores.`);
  if (m.t === 'bemvindo') { a.eu = m.eu; if (m.rodando) statusDuelo('O duelo já começou. Você entra na próxima rodada! ⏳'); }
  if (m.jog) { a.jog = m.jog; }
  if (m.cat) a.cat = m.cat;
  if (m.jogo) a.jogo = m.jogo;
  if (m.t?.startsWith('ad_')) return adGuest(m);
  if (m.t === 'sala') { if (!document.querySelector('#arena.ativa')) desenhaSala(); desenhaPlacar(); }
  if (m.t === 'inicio') { a.perguntas = m.perguntas; a.acabou = false; $('fimArena').style.display = 'none'; mostrar('arena'); contagem(() => {}); }
  if (m.t === 'q' && a.perguntas && m.i >= 0 && m.i < a.perguntas.length && !a.jog[a.eu]?.fora) mostrarPergunta(m.i);
  if (m.t === 'placar') desenhaPlacar();
  if (m.t === 'revela' && a.perguntas && !a.jog[a.eu]?.fora) revelar();
  if (m.t === 'fim' && a.perguntas && !a.jog[a.eu]?.fora) { a.acabou = true; fimArena(); }
}

function contagem(depois) {
  const a = arena; let n = 3;
  $('arenaOps').innerHTML = ''; $('arenaPergunta').textContent = '';
  const t = a.jog[a.eu]?.time || 0;
  $('arenaNum').textContent = `Você é do ${TIMES[t][0]} ${TIMES[t][1]}`;
  $('arenaExp').textContent = `${jogando(a).length} jogadores · ${nomeCat(a.cat || 'mix')}`; $('arenaExp').className = 'exp';
  desenhaPlacar();
  const passo = () => { $('arenaPergunta').innerHTML = `<span class="conta">${n || 'JÁ!'}</span>`; clique(); if (n-- > 0) a.espera = setTimeout(passo, 800); else a.espera = setTimeout(depois, 600); };
  passo();
}

// ---------- botões ----------
$('abrirDuelo').onclick = () => { clique(); abrirDuelo(); };
$('voltarDuelo').onclick = () => { clique(); pararArena(); mostrar('inicio'); };
$('soloBtn').onclick = iniciarSolo;
$('criarDueloBtn').onclick = () => criarDuelo('quiz');
$('comecarDuelo').onclick = () => { clique(); arena?.jogo === 'adedonha' ? adComecar() : comecarRodada(); };
$('criarAdedonhaBtn').onclick = () => criarDuelo('adedonha');
$('reenviarConvite').onclick = () => { clique(); enviarConvite(); };
$('cancelarDuelo').onclick = () => { clique(); abrirDuelo(); };
$('sairArena').onclick = () => { clique(); $('fimArena').style.display = 'none'; pararArena(); abrirDuelo(); };
$('fimRevanche').onclick = () => {
  clique(); const a = arena; if (!a) return abrirDuelo();
  if (a.modo === 'solo') return iniciarSolo();
  if (a.host) { if (Object.keys(a.jog).length < 2) { $('fimArenaXP').textContent = 'Todo mundo saiu. Mande o convite de novo.'; return; } return a.jogo === 'adedonha' ? adComecar() : comecarRodada(); }
  if (!a.conn?.open) { $('fimArenaXP').textContent = 'O anfitrião saiu. Crie um duelo novo.'; return; }
  a.conn.send({ t: 'revanche' }); $('fimArenaXP').textContent = 'Pedido enviado! Esperando o anfitrião...';
};
$('fimSair').onclick = () => { clique(); $('fimArena').style.display = 'none'; pararArena(); abrirDuelo(); };

// link de convite: ?duelo=CODIGO
{ const c = new URLSearchParams(location.search).get('duelo'); if (c && /^[A-Z0-9]{5}$/.test(c)) { history.replaceState(null, '', location.pathname); entrarDuelo(c); } }
