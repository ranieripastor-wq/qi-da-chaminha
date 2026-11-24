// Desafio do dia: as mesmas 10 perguntas para todo o Brasil, uma tentativa por dia, ranking só de hoje
const API_DIA = API.replace('/ranking', '/diario');
const diaBR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const numDesafio = (dia = diaBR()) => Math.round((Date.parse(dia) - Date.parse('2026-11-23')) / 864e5);

// sorteio que dá o mesmo resultado em todo aparelho para a mesma data
function semente(s) {
  let h = 1779033703 ^ s.length;
  for (const c of s) { h = Math.imul(h ^ c.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
function perguntasDoDia(dia) {
  const r = semente('qi-chaminha-' + dia);
  const emb = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const temas = emb(Object.keys(TEMAS).sort()), usadas = new Set();
  return Array.from({ length: POR_DUELO }, (_, k) => {
    const c = temas[k % temas.length], lista = TEMAS[c][2];
    let i; do i = Math.floor(r() * lista.length); while (usadas.has(c + i));
    usadas.add(c + i);
    const [p, certa, erradas, exp] = lista[i];
    return { c, p, certa, exp, ops: emb([certa, ...erradas]) };
  });
}

let diaDados = ler('diaCache', null);
async function buscarDiario() {
  try {
    const r = await fetch(API_DIA + '?id=' + meuId(), { cache: 'no-store' });
    if (r.ok) { diaDados = await r.json(); guardar('diaCache', diaDados); }
  } catch {}
  return diaDados;
}

const feitoHoje = () => { const f = ler('diario', null); return f?.dia === diaBR() ? f : null; };

function iniciarDiario() {
  if (feitoHoje()?.fim) return mostrarFimDiario();
  pararArena(); clique();
  const dia = diaBR(), antes = feitoHoje();
  arena = { modo: 'solo', diario: true, dia, eu: 'eu', jog: { eu: { nome: 'Você', time: 0, pts: 0, acertos: 0, resp: -1 } },
    perguntas: perguntasDoDia(dia), marcas: [] };
  // quem saiu no meio continua de onde parou (sem ver as mesmas perguntas de novo)
  if (antes) { arena.marcas = antes.marcas; Object.assign(arena.jog.eu, { pts: antes.pts, acertos: antes.ac }); }
  $('fimArena').style.display = 'none'; mostrar('arena');
  arena.marcas.length >= POR_DUELO ? fimDiario() : mostrarPergunta(arena.marcas.length);
}

// chamado pelo arena.js a cada resposta do desafio
function marcarDiario(a, certo) {
  a.marcas[a.i] = certo ? '🟩' : '🟥';
  guardar('diario', { dia: a.dia, marcas: a.marcas, pts: a.jog.eu.pts, ac: a.jog.eu.acertos });
}

async function fimDiario() {
  const a = arena, eu = a.jog.eu;
  clearInterval(a.relogio); clearTimeout(a.espera);
  const f = { dia: a.dia, marcas: a.marcas, pts: eu.pts, ac: eu.acertos, fim: true };
  guardar('diario', f); guardar('xp', ler('xp', 0) + eu.acertos * 10); marcarDia();
  if (eu.acertos >= 8) { faiscas(innerWidth / 2, innerHeight / 3); somAcerto(); }
  mostrarFimDiario();
  if (!ler('apelido', '') && !(await pedirApelido('Como você quer aparecer no ranking de hoje?'))) return;
  let r = await enviarDiario(f);
  if (r.erro === 'nome' && await pedirApelido('Esse apelido não pode. Escolha outro:')) r = await enviarDiario(f);
  if (!r.erro) { guardar('diario', { ...f, pos: r.pos, total: r.total }); buscarDiario(); }
  mostrarFimDiario(r.erro);
}
async function enviarDiario(f) {
  try {
    const r = await fetch(API_DIA, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: meuId(), nome: ler('apelido', ''), dia: f.dia, ac: f.ac, pts: f.pts }) });
    return r.ok ? await r.json() : { erro: (await r.json().catch(() => ({}))).erro || 'servidor' };
  } catch { return { erro: 'rede' }; }
}

const textoPos = f => f.pos ? `${posTexto(f.pos)} de ${f.total} hoje` : '';
function horasParaAmanha() {
  const resta = 864e5 - (Date.now() - 3 * 3600e3) % 864e5, h = Math.floor(resta / 36e5), m = Math.floor(resta % 36e5 / 6e4);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}
function mostrarFimDiario(erro) {
  // terminou depois da meia-noite: mostra a tentativa que acabou de fazer
  const f = feitoHoje() || (ler('diario', null)?.fim ? ler('diario', null) : null); if (!f) return;
  $('fimArenaMascote').innerHTML = chaminha(80);
  $('fimArenaTitulo').innerHTML = `📅 Desafio #${numDesafio(f.dia)}`;
  $('fimArenaPlacar').innerHTML = `<div class="quadrinhos">${f.marcas.join('')}</div><b>${f.ac}/${POR_DUELO}</b> · ${f.pts} pontos`
    + `<div style="font-weight:800;color:var(--brasa);margin-top:4px">${f.pos ? textoPos(f) : erro === 'rede' ? 'Sem internet: o ranking não recebeu.' : erro ? '' : 'Vendo sua posição...'}</div>`;
  $('fimArenaXP').textContent = `Novo desafio em ${horasParaAmanha()} · todo mundo responde as mesmas perguntas`;
  $('fimRevanche').style.display = '';
  $('fimRevanche').textContent = '🏆 Ranking de hoje';
  $('fimArenaZap').onclick = () => compartilhar(
    `📅 Desafio do dia #${numDesafio(f.dia)} · QI da Chaminha\n${f.marcas.join('')} ${f.ac}/${POR_DUELO}\n⚡ ${f.pts} pontos${f.pos ? ' · ' + textoPos(f) : ''}\nConsegue fazer melhor?`);
  $('fimArena').style.display = 'flex';
}

// selo de calendário com o dia de hoje (o emoji 📅 mostra sempre "JUL 17")
const seloDia = () => { const d = new Date(Date.now() - 3 * 3600e3); return `<span class="selo" aria-hidden="true"><i>${['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][d.getUTCMonth()]}</i><b>${d.getUTCDate()}</b></span>`; };
function desenhaBotaoDiario() {
  const f = feitoHoje();
  $('abrirDiario').innerHTML = f?.fim
    ? `<span class="calend">✅</span><span>DESAFIO #${numDesafio()} FEITO<small>${f.ac}/10 · ${f.pos ? textoPos(f) + ' · ' : ''}volta em ${horasParaAmanha()}</small></span>`
    : `${seloDia()}<span>DESAFIO DO DIA #${numDesafio()}<small>${f ? 'continue de onde parou' : '10 perguntas iguais para todo o Brasil'}</small></span>`;
  $('abrirDiario').classList.toggle('feito', !!f?.fim);
}

let fimEhDiario = false;
const _mostrarFim = mostrarFimDiario;
mostrarFimDiario = erro => {
  fimEhDiario = true; _mostrarFim(erro);
  // ficou sem internet no fim: tenta mandar de novo quando a caixa abrir outra vez
  const f = feitoHoje();
  if (erro === undefined && f?.fim && !f.pos && ler('apelido', '') && !enviandoDia) {
    enviandoDia = true;
    enviarDiario(f).then(r => { enviandoDia = false; if (!r.erro) { guardar('diario', { ...f, pos: r.pos, total: r.total }); buscarDiario(); } if (fimEhDiario) _mostrarFim(r.erro); });
  }
};
let enviandoDia = false;
const revancheArena = $('fimRevanche').onclick, sairFim = $('fimSair').onclick, sairArenaX = $('sairArena').onclick;
const fecharFimDiario = () => { clique(); fimEhDiario = false; $('fimArena').style.display = 'none'; pararArena(); };
$('fimRevanche').onclick = e => fimEhDiario ? (fecharFimDiario(), abaRank = 'hoje', abrirRanking()) : revancheArena(e);
$('fimSair').onclick = e => fimEhDiario ? (fecharFimDiario(), mostrar('inicio')) : sairFim(e);
$('sairArena').onclick = e => arena?.diario ? (fecharFimDiario(), mostrar('inicio')) : sairArenaX(e);
$('abrirDiario').onclick = () => { clique(); iniciarDiario(); };
desenhaBotaoDiario(); buscarDiario();
