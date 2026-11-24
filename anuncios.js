// Anúncios e liberações: só no app da Play Store (window.QINative). No site tudo continua livre e sem anúncio.
const NATIVO = window.QINative || null;
const TRANCADOS = ['ciencias', 'esportes', 'brasil'], LIBERA_MIN = 30, PARTIDAS_POR_ANUNCIO = 3;
const trancado = cat => !!NATIVO && TRANCADOS.includes(cat) && Date.now() > ler('liberadoAte', 0);
const minutosLivres = () => Math.max(0, Math.ceil((ler('liberadoAte', 0) - Date.now()) / 6e4));

// anúncio premiado: a pessoa escolhe ver e libera os assuntos por 30 minutos
let depoisAnuncio = null;
window.qiAnuncio = ok => { const f = depoisAnuncio; depoisAnuncio = null; if (f) f(ok); };
function liberarComAnuncio(depois) {
  if (!NATIVO.anuncioPronto()) { $('dueloRecorde').textContent = '⏳ O anúncio ainda está carregando. Tente de novo em alguns segundos.'; return; }
  depoisAnuncio = ok => { if (!ok) return; guardar('liberadoAte', Date.now() + LIBERA_MIN * 6e4); somAcerto(); depois(); };
  NATIVO.verAnuncio();
}

if (NATIVO) {
  const _abrirDuelo = abrirDuelo;
  abrirDuelo = () => {
    _abrirDuelo();
    const livres = minutosLivres();
    if (livres) $('dueloRecorde').textContent += ` · 🔓 assuntos liberados por mais ${livres} min`;
    document.querySelectorAll('#catLista .chip').forEach(b => {
      const c = b.dataset.cat; if (!TRANCADOS.includes(c)) return;
      if (trancado(c)) b.innerHTML += ' 🔒';
      const escolher = b.onclick;
      b.onclick = () => {
        if (!trancado(c)) return escolher();
        if (!confirm(`${TEMAS[c][1]} é liberado por ${LIBERA_MIN} minutos assistindo a um anúncio curto. Ver agora?`)) return;
        liberarComAnuncio(() => { abrirDuelo(); document.querySelector(`#catLista [data-cat="${c}"]`)?.click(); });
      };
    });
  };

  // anúncio entre partidas: a cada 3 voltas de um jogo para o início, nunca no meio de uma partida
  const JOGOS = ['arena', 'adedonha', 'resultado', 'jogo'];
  const _mostrar = mostrar;
  mostrar = id => {
    const antes = document.querySelector('.tela.ativa')?.id;
    _mostrar(id);
    if (id !== 'inicio' || !JOGOS.includes(antes)) return;
    const n = ler('partidasSemAnuncio', 0) + 1;
    if (n < PARTIDAS_POR_ANUNCIO) return guardar('partidasSemAnuncio', n);
    guardar('partidasSemAnuncio', 0); NATIVO.intersticial();
  };

  // botão voltar do Android: volta ao início; no início, o app pergunta se quer sair
  window.voltarApp = () => {
    if (document.querySelector('.tela.ativa')?.id === 'inicio') return false;
    $('fimArena').style.display = 'none'; $('nomeModal').style.display = 'none'; $('vitoria').style.display = 'none'; fimEhDiario = false;
    limpezas.forEach(f => f()); limpezas = []; if (sessao) { sessao = null; $('dica').style.visibility = ''; $('desafio').style.visibility = ''; }
    pararArena(); mostrar('inicio'); return true;
  };

  if (NATIVO.pedePrivacidade()) {
    const b = document.createElement('button'); b.className = 'btn fantasma'; b.textContent = 'Privacidade dos anúncios';
    b.style.cssText = 'font-size:13px;min-height:48px;border-width:2px';
    b.onclick = () => NATIVO.privacidadeAnuncios();
    $('rodape').appendChild(b);
  }
}
