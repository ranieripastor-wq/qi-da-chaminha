// Arena: quiz por categoria (sozinho) e duelo ao vivo Chaminha × Gelinho (dois celulares, conexão direta via PeerJS).
const POR_DUELO = 10, TEMPO_Q = 12;
const misturar = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

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

// ---------- perguntas ----------
function sortearPerguntas(cat, n) {
  const cats = cat === 'mix' ? Object.keys(TEMAS) : [cat];
  const todas = cats.flatMap(c => TEMAS[c][2].map((q, i) => ({ c, i, q })));
  // evita repetir as últimas perguntas vistas neste aparelho
  const vistasQ = ler('vistasQuiz', []), novas = todas.filter(x => !vistasQ.includes(x.c + x.i));
  const escolhidas = misturar(novas.length >= n ? novas : todas).slice(0, n);
  guardar('vistasQuiz', [...vistasQ, ...escolhidas.map(x => x.c + x.i)].slice(-Math.floor(todas.length * .7)));
  return escolhidas.map(({ c, q: [p, certa, erradas, exp] }) => ({ c, p, certa, exp, ops: misturar([certa, ...erradas]) }));
}

// ---------- estado ----------
let arena = null; // { modo:'solo'|'duelo', host, perguntas, i, pts:[eu,rival], resp:{}, nomes:[eu,rival], conn, peer }

function abrirDuelo() {
  pararArena();
  const lista = $('catLista'); lista.innerHTML = '';
  [['mix', '🎲', 'Misturado'], ...Object.entries(TEMAS).map(([k, [ic, nome]]) => [k, ic, nome])].forEach(([k, ic, nome], n) => {
    const b = document.createElement('button'); b.className = 'btn chip'; b.dataset.cat = k;
    b.setAttribute('aria-pressed', n === 0); b.innerHTML = `${ic} ${nome}`;
    b.onclick = () => { clique(); lista.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b)); };
    lista.appendChild(b);
  });
  $('dueloEspera').style.display = 'none'; $('dueloMenu').style.display = '';
  $('dueloRecorde').textContent = `🏆 Vitórias em duelos: ${ler('vitorias', 0)}`;
  mostrar('duelo');
}
const catEscolhida = () => document.querySelector('#catLista .chip[aria-pressed="true"]')?.dataset.cat || 'mix';

function pararArena() {
  if (!arena) return;
  clearInterval(arena.relogio); clearTimeout(arena.espera);
  try { arena.conn?.close(); } catch {} try { arena.peer?.destroy(); } catch {}
  arena = null;
}

// ---------- tela da arena ----------
function desenhaPlacar() {
  const a = arena, duelo = a.modo === 'duelo';
  const lados = duelo ? [[chaminha(54), a.host ? a.nomes[0] : a.nomes[1], a.host ? a.pts[0] : a.pts[1]], [gelinho(54), a.host ? a.nomes[1] : a.nomes[0], a.host ? a.pts[1] : a.pts[0]]]
    : [[chaminha(54), ler('apelido', '') || 'Você', a.pts[0]]];
  $('arenaPlacar').innerHTML = lados.map(([svg, nome, pts], k) => `<div class="lado ${k ? 'gelo' : 'fogo'}">${svg}<span>${esc(nome)}</span><b>${pts}</b></div>`).join(duelo ? '<div class="vs">VS</div>' : '');
}

function mostrarPergunta(i) {
  const a = arena, q = a.perguntas[i];
  clearTimeout(a.espera); a.i = i; a.respondeu = false; a.inicio = performance.now();
  $('arenaNum').textContent = `${TEMAS[q.c][0]} ${TEMAS[q.c][1]} · ${i + 1}/${a.perguntas.length}`;
  $('arenaPergunta').textContent = q.p;
  $('arenaExp').textContent = a.modo === 'duelo' ? `${a.nomes[1]} está pensando...` : 'Responda antes do tempo acabar!';
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
  const a = arena; if (!a || a.respondeu) return;
  a.respondeu = true;
  const q = a.perguntas[a.i], certo = escolha === q.certa;
  const resta = Math.max(0, 1 - (performance.now() - a.inicio) / (TEMPO_Q * 1000));
  const pts = certo ? 100 + Math.round(50 * resta) : 0;
  a.pts[0] += pts; a.acertos = (a.acertos || 0) + (certo ? 1 : 0);
  document.querySelectorAll('#arenaOps .opc').forEach(b => { b.disabled = true; if (b === el) b.classList.add(certo ? 'certo' : 'errado'); });
  if (certo) { som([[660, 0, .1], [880, .08, .18]]); vibrar(30); } else { somErro(); vibrar(120); }
  if (a.modo === 'duelo') {
    a.conn.send({ t: 'r', i: a.i, pts });
    $('arenaExp').textContent = certo ? `✅ +${pts}! Esperando ${a.nomes[1]}...` : `❌ Esperando ${a.nomes[1]}...`;
    if (a.host) { a.resp[a.i] = { ...(a.resp[a.i] || {}), eu: true }; checarFimQuestao(); }
  } else revelar();
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
  const a = arena; clearInterval(a.relogio);
  const [eu, rival] = a.pts, duelo = a.modo === 'duelo';
  const ganho = (a.acertos || 0) * 10; guardar('xp', ler('xp', 0) + ganho); marcarDia();
  let titulo, svg;
  if (!duelo) { titulo = `${a.acertos} de ${a.perguntas.length} certas!`; svg = chaminha(90); }
  else if (eu === rival) { titulo = 'Empate! 🤝'; svg = chaminha(70) + gelinho(70); }
  else {
    const venci = eu > rival, fogoVenceu = venci === a.host;
    titulo = venci ? 'VOCÊ VENCEU! 🏆' : `${esc(a.nomes[1])} venceu!`;
    svg = fogoVenceu ? chaminha(100) : gelinho(100);
    if (venci) { guardar('vitorias', ler('vitorias', 0) + 1); faiscas(innerWidth / 2, innerHeight / 3); somAcerto(); }
  }
  $('fimArenaMascote').innerHTML = svg; $('fimArenaTitulo').innerHTML = titulo;
  $('fimArenaPlacar').innerHTML = duelo ? `${esc(a.nomes[0])} <b>${eu}</b> × <b>${rival}</b> ${esc(a.nomes[1])}` : `${eu} pontos`;
  $('fimArenaXP').textContent = `+${ganho} XP · ${a.acertos} acertos`;
  $('fimRevanche').textContent = duelo ? '⚔️ Revanche' : '🔁 Jogar de novo';
  $('fimArenaZap').onclick = () => compartilhar(duelo
    ? (eu > rival ? `🔥 Ganhei de ${a.nomes[1]} por ${eu} a ${rival} no duelo do QI da Chaminha! Quem me enfrenta?` : `❄️ Perdi de ${a.nomes[1]} no duelo do QI da Chaminha. Quem me ajuda a vingar?`)
    : `🧠 Fiz ${eu} pontos no quiz do QI da Chaminha (${a.acertos}/${a.perguntas.length}). Duvido você:`);
  $('fimArena').style.display = 'flex';
}

// ---------- solo ----------
function iniciarSolo() {
  pararArena(); clique();
  arena = { modo: 'solo', perguntas: sortearPerguntas(catEscolhida(), POR_DUELO), pts: [0, 0], cat: catEscolhida() };
  $('fimArena').style.display = 'none'; mostrar('arena'); mostrarPergunta(0);
}

// ---------- duelo ao vivo ----------
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

async function garantirApelido() { return ler('apelido', '') || await pedirApelido('Como seu amigo vai te ver no duelo?'); }

async function criarDuelo() {
  clique(); const nome = await garantirApelido(); if (!nome) return;
  pararArena();
  $('dueloMenu').style.display = 'none'; $('dueloEspera').style.display = ''; $('dueloConvite').style.display = 'none';
  statusDuelo('Abrindo a sala...');
  try { await carregarPeer(); } catch { statusDuelo('Sem internet para o duelo agora. Tente de novo.'); return; }
  const codigo = codigoSala(), cat = catEscolhida();
  arena = { modo: 'duelo', host: true, codigo, cat, pts: [0, 0], resp: {}, nomes: [nome, 'Amigo'] };
  const peer = arena.peer = new Peer(idSala(codigo));
  peer.on('open', () => {
    $('dueloCodigo').textContent = codigo; $('dueloConvite').style.display = '';
    statusDuelo('Esperando seu amigo entrar... ⏳');
    enviarConvite();
  });
  peer.on('error', e => statusDuelo(e.type === 'unavailable-id' ? 'Código ocupado, crie outro.' : 'Não deu para abrir a sala. Confira a internet.'));
  peer.on('connection', conn => {
    if (arena?.conn) { conn.on('open', () => { conn.send({ t: 'cheia' }); setTimeout(() => conn.close(), 500); }); return; }
    arena.conn = conn; ligarConexao(conn);
  });
}
function enviarConvite() {
  const a = arena; if (!a) return;
  compartilhar(`⚔️ ${a.nomes[0]} te desafiou para um DUELO AO VIVO no QI da Chaminha! 🔥 contra ❄️\nEntra agora, estou esperando:`,
    location.origin + location.pathname + '?duelo=' + a.codigo);
}

async function entrarDuelo(codigo) {
  const nome = await garantirApelido(); if (!nome) { mostrar('inicio'); return; }
  pararArena(); abrirDuelo();
  $('dueloMenu').style.display = 'none'; $('dueloEspera').style.display = ''; $('dueloConvite').style.display = 'none';
  statusDuelo('Entrando no duelo...');
  try { await carregarPeer(); } catch { statusDuelo('Sem internet para o duelo agora.'); return; }
  arena = { modo: 'duelo', host: false, codigo, pts: [0, 0], resp: {}, nomes: [nome, 'Amigo'] };
  const peer = arena.peer = new Peer();
  peer.on('open', () => {
    const conn = arena.conn = peer.connect(idSala(codigo), { reliable: true });
    ligarConexao(conn);
    setTimeout(() => { if (arena && !arena.ligado) statusDuelo('Não achei a sala. O duelo pode ter acabado: peça um link novo.'); }, 9000);
  });
  peer.on('error', e => statusDuelo(e.type === 'peer-unavailable' ? 'Essa sala não existe mais. Peça um link novo ao seu amigo.' : 'Não deu para conectar. Confira a internet.'));
}

function ligarConexao(conn) {
  conn.on('open', () => { arena.ligado = true; conn.send({ t: 'oi', nome: arena.nomes[0] }); });
  conn.on('data', m => receber(m));
  conn.on('close', () => {
    if (!arena || arena.acabou) return;
    clearInterval(arena.relogio);
    $('arenaExp').textContent = `${arena.nomes[1]} saiu do duelo.`; statusDuelo('Seu amigo saiu.');
    if (document.querySelector('#arena.ativa')) fimArena();
  });
}

function receber(m) {
  const a = arena; if (!a || !m) return;
  if (m.t === 'cheia') { statusDuelo('Esse duelo já tem dois jogadores.'); return; }
  if (m.t === 'oi') {
    a.nomes[1] = String(m.nome || 'Amigo').slice(0, 16);
    if (a.host) comecarRodada();
  }
  if (m.t === 'inicio') {
    a.perguntas = m.perguntas; a.pts = [0, 0]; a.acertos = 0; a.acabou = false;
    $('fimArena').style.display = 'none'; mostrar('arena'); contagem(() => {});
  }
  if (m.t === 'q') mostrarPergunta(m.i);
  if (m.t === 'r') {
    a.pts[1] += m.pts | 0; desenhaPlacar();
    if (!a.respondeu) $('arenaExp').textContent = `⚡ ${a.nomes[1]} já respondeu!`;
    if (a.host) { a.resp[m.i] = { ...(a.resp[m.i] || {}), ele: true }; checarFimQuestao(); }
  }
  if (m.t === 'revela') { if (!a.respondeu) { a.respondeu = true; } revelar(); }
  if (m.t === 'fim') { a.acabou = true; fimArena(); }
  if (m.t === 'revanche' && a.host) comecarRodada();
}

// ---------- o anfitrião comanda o ritmo ----------
function comecarRodada() {
  const a = arena;
  a.perguntas = sortearPerguntas(a.cat, POR_DUELO); a.pts = [0, 0]; a.acertos = 0; a.resp = {}; a.acabou = false;
  a.conn.send({ t: 'inicio', perguntas: a.perguntas });
  $('fimArena').style.display = 'none'; mostrar('arena');
  contagem(() => proximaQuestao(0));
}
function contagem(depois) {
  const a = arena; let n = 3;
  $('arenaOps').innerHTML = ''; $('arenaPergunta').textContent = '';
  $('arenaNum').textContent = a.modo === 'duelo' ? `${a.host ? '🔥 Você é a Chaminha' : '❄️ Você é o Gelinho'}` : '';
  $('arenaExp').textContent = `Duelo contra ${a.nomes[1]}!`; $('arenaExp').className = 'exp';
  desenhaPlacar();
  const passo = () => { $('arenaPergunta').innerHTML = `<span class="conta">${n || 'JÁ!'}</span>`; clique(); if (n-- > 0) a.espera = setTimeout(passo, 800); else a.espera = setTimeout(depois, 600); };
  passo();
}
function proximaQuestao(i) {
  const a = arena; if (!a) return;
  if (i >= a.perguntas.length) { a.acabou = true; a.conn.send({ t: 'fim' }); fimArena(); return; }
  a.conn.send({ t: 'q', i }); mostrarPergunta(i);
  clearTimeout(a.espera);
  a.espera = setTimeout(() => fecharQuestao(i), (TEMPO_Q + 1.5) * 1000); // folga para a resposta do amigo chegar
}
function checarFimQuestao() {
  const a = arena, r = a.resp[a.i] || {};
  if (r.eu && r.ele) { clearTimeout(a.espera); a.espera = setTimeout(() => fecharQuestao(a.i), 400); }
}
function fecharQuestao(i) {
  const a = arena; if (!a || a.i !== i || a.fechada === i) return;
  a.fechada = i; a.conn.send({ t: 'revela', i }); revelar();
  a.espera = setTimeout(() => proximaQuestao(i + 1), 3400);
}

// ---------- botões ----------
$('abrirDuelo').onclick = () => { clique(); abrirDuelo(); };
$('voltarDuelo').onclick = () => { clique(); pararArena(); mostrar('inicio'); };
$('soloBtn').onclick = iniciarSolo;
$('criarDueloBtn').onclick = criarDuelo;
$('reenviarConvite').onclick = () => { clique(); enviarConvite(); };
$('cancelarDuelo').onclick = () => { clique(); abrirDuelo(); };
$('sairArena').onclick = () => { clique(); $('fimArena').style.display = 'none'; pararArena(); abrirDuelo(); };
$('fimRevanche').onclick = () => {
  clique(); const a = arena; if (!a) return abrirDuelo();
  if (a.modo === 'solo') return iniciarSolo();
  if (!a.conn?.open) { $('fimArenaXP').textContent = 'Seu amigo saiu. Crie um duelo novo.'; return; }
  if (a.host) comecarRodada(); else { a.conn.send({ t: 'revanche' }); $('fimArenaXP').textContent = 'Pedido de revanche enviado...'; }
};
$('fimSair').onclick = () => { clique(); $('fimArena').style.display = 'none'; pararArena(); abrirDuelo(); };

// link de convite: ?duelo=CODIGO
{ const c = new URLSearchParams(location.search).get('duelo'); if (c && /^[A-Z0-9]{5}$/.test(c)) { history.replaceState(null, '', location.pathname); entrarDuelo(c); } }
