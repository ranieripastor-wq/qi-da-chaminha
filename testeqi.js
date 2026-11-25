// Teste de QI no formato dos testes reais (Raven, Cattell, WAIS): sem cronômetro, 30 itens do mais fácil ao mais difícil.
// Cada gerador recebe a dificuldade d (1 a 5) e devolve { p, porque, monta(palco) }, como os do treino.
const AREAS_T = {
  matriz: ['🔷', 'Matrizes', 'logica'], serie: ['🔢', 'Sequências', 'logica'], verbal: ['💬', 'Verbal', 'linguagem'],
  aritmetica: ['➗', 'Raciocínio numérico', 'matematica'], digitos: ['🧠', 'Memória', 'memoria'],
  rotacao: ['🔄', 'Visão espacial', 'atencao'], balanca: ['⚖️', 'Balanças', 'matematica'],
  figuras: ['🔶', 'Sequência de figuras', 'logica'], intruso: ['🔍', 'Figura diferente', 'atencao'],
};
// ordem do teste completo: 6 itens por nível de dificuldade (misturados dentro do nível)
const PLANO_QI = [
  ['matriz', 'serie', 'verbal', 'aritmetica', 'digitos', 'figuras'],
  ['matriz', 'serie', 'verbal', 'aritmetica', 'rotacao', 'intruso'],
  ['matriz', 'serie', 'verbal', 'aritmetica', 'balanca', 'figuras'],
  ['matriz', 'serie', 'verbal', 'aritmetica', 'rotacao', 'balanca'],
  ['matriz', 'serie', 'verbal', 'aritmetica', 'digitos', 'figuras'],
];
const PLANO_LOGICA = ['balanca', 'rotacao', 'intruso', 'balanca', 'rotacao'].map(x => ['matriz', 'serie', 'figuras', x]);

// ---------- desenho ----------
const TINTA = '#2B1408';
const DEFS = `<defs><pattern id="hach" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="${TINTA}"/></pattern></defs>`;
function formaSvg(forma, cx, cy, r, preench, rot = 0) {
  const fill = preench === 'cheio' ? TINTA : preench === 'listrado' ? 'url(#hach)' : '#fff';
  const a = `fill="${fill}" stroke="${TINTA}" stroke-width="2.4" stroke-linejoin="round" transform="rotate(${rot} ${cx} ${cy})"`;
  if (forma === 'circulo') return `<circle cx="${cx}" cy="${cy}" r="${r}" ${a}/>`;
  if (forma === 'quadrado') return `<rect x="${cx - r * .85}" y="${cy - r * .85}" width="${r * 1.7}" height="${r * 1.7}" ${a}/>`;
  if (forma === 'triangulo') return `<polygon points="${cx},${cy - r} ${cx + r * .95},${cy + r * .75} ${cx - r * .95},${cy + r * .75}" ${a}/>`;
  if (forma === 'losango') return `<polygon points="${cx},${cy - r} ${cx + r * .8},${cy} ${cx},${cy + r} ${cx - r * .8},${cy}" ${a}/>`;
  if (FORMAS_POLI[forma]) { const [lados, interno] = FORMAS_POLI[forma], n = interno ? lados * 2 : lados;
    const pts = Array.from({ length: n }, (_, i) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / n, rr = interno && i % 2 ? r * interno : r; return `${(cx + rr * Math.cos(ang)).toFixed(1)},${(cy + rr * Math.sin(ang)).toFixed(1)}`; });
    return `<polygon points="${pts.join(' ')}" ${a}/>`; }
  if (forma === 'cruz') { const t = r * .36; return `<polygon points="${cx - t},${cy - r} ${cx + t},${cy - r} ${cx + t},${cy - t} ${cx + r},${cy - t} ${cx + r},${cy + t} ${cx + t},${cy + t} ${cx + t},${cy + r} ${cx - t},${cy + r} ${cx - t},${cy + t} ${cx - r},${cy + t} ${cx - r},${cy - t} ${cx - t},${cy - t}" ${a}/>`; }
  // seta: aponta para cima com rot 0 (assimétrica, serve para regras de giro)
  return `<polygon points="${cx},${cy - r} ${cx + r * .8},${cy - r * .1} ${cx + r * .3},${cy - r * .1} ${cx + r * .3},${cy + r} ${cx - r * .3},${cy + r} ${cx - r * .3},${cy - r * .1} ${cx - r * .8},${cy - r * .1}" ${a}/>`;
}
// uma célula da matriz: n figuras iguais
function celulaSvg(c, tam = 60) {
  const pos = { 1: [[30, 30]], 2: [[17, 30], [43, 30]], 3: [[30, 16], [16, 43], [44, 43]] }[c.n], r = c.n === 1 ? 19 : 11.5;
  return `<svg viewBox="0 0 60 60" width="${tam}" height="${tam}">${DEFS}${pos.map(([x, y]) => formaSvg(c.forma, x, y, r, c.preench, c.rot)).join('')}</svg>`;
}
// nome para leitor de tela: "2 losango listrado girado 90°"
const descreve = c => `${c.n} ${c.forma} ${c.preench}` + (c.rot ? ` girado ${c.rot}°` : '');
const chave = c => `${c.forma}|${c.n}|${c.preench}|${c.rot}`;

// botões com desenho (o botao() comum só aceita texto)
function botoesSvg(palco, ops, iCerta, colunas = 3, nomes = []) {
  const g = grade(palco, colunas); g.style.gap = '10px'; g.style.padding = '8px 2px';
  embaralha(ops.map((h, i) => [h, i])).forEach(([h, i], pos) => {
    const b = document.createElement('button'); b.className = 'opc'; b.style.padding = '6px 0'; b.style.lineHeight = '0';
    b.innerHTML = h; b.setAttribute('aria-label', nomes[i] || 'Opção ' + (pos + 1));
    if (i === iCerta) b.dataset.certo = 1;
    b.onclick = () => i === iCerta ? ganhar(b) : errar(b);
    g.appendChild(b);
  });
}

// ---------- 1. Matrizes progressivas (estilo Raven) ----------
// [lados, raio de dentro] (com raio de dentro vira estrela)
const FORMAS_POLI = { pentagono: [5], hexagono: [6], estrela: [5, .45] };
const FORMAS = ['circulo', 'quadrado', 'triangulo', 'losango', 'pentagono', 'hexagono', 'estrela', 'cruz'], PREENCH = ['cheio', 'vazio', 'listrado'];
function dadosMatriz(d) {
  const F = embaralha(FORMAS).slice(0, 3), P = embaralha(PREENCH), base = sorteia(0, 3) * 45, giro = um([45, 90]);
  let cel, regra;
  if (d === 1) { cel = (r, c) => ({ forma: F[r], n: c + 1, preench: 'cheio', rot: 0 }); regra = 'Em cada linha a figura é a mesma e a quantidade aumenta: 1, 2, 3.'; }
  else if (d === 2) { cel = (r, c) => ({ forma: F[c], n: 1, preench: P[r], rot: 0 }); regra = 'Cada coluna tem uma figura e cada linha tem um preenchimento.'; }
  else if (d === 3) { cel = (r, c) => ({ forma: 'seta', n: 1, preench: P[r], rot: (base + c * giro) % 360 }); regra = `A seta gira ${giro}° a cada passo para a direita, e cada linha tem um preenchimento.`; }
  else if (d === 4) { cel = (r, c) => ({ forma: F[(r + c) % 3], n: 2, preench: P[(r + 2 * c) % 3], rot: 0 }); regra = 'Cada linha e cada coluna têm as 3 figuras e os 3 preenchimentos, uma vez cada.'; }
  else { cel = (r, c) => ({ forma: F[(r + c) % 3], n: (2 * r + c) % 3 + 1, preench: P[(r + 2 * c) % 3], rot: 0 }); regra = 'Cada linha e cada coluna têm as 3 figuras, as 3 quantidades e os 3 preenchimentos, uma vez cada.'; }
  const certa = cel(2, 2), k = chave(certa);
  // distratores: mudam um detalhe da certa, ou copiam uma vizinha (erro comum)
  const cand = [cel(2, 1), cel(1, 2)];
  (d === 3 ? [] : F.concat(FORMAS)).forEach(f => cand.push({ ...certa, forma: f }));
  [1, 2, 3].forEach(n => cand.push({ ...certa, n }));
  PREENCH.forEach(p => cand.push({ ...certa, preench: p }));
  if (d === 3) [0, 45, 90, 135, 180, 225, 270, 315].forEach(rt => cand.push({ ...certa, rot: rt }));
  const vistas = new Set([k]), erradas = [];
  for (const c of embaralha(cand)) { const kc = chave(c); if (!vistas.has(kc)) { vistas.add(kc); erradas.push(c); } if (erradas.length === 5) break; }
  return { grade: [0, 1, 2].map(r => [0, 1, 2].map(c => cel(r, c))), certa, erradas, regra };
}
function matriz(d) {
  const m = dadosMatriz(d);
  return { p: 'Qual figura completa o quadro?', porque: m.regra,
    monta(palco) {
      const cel = (c, ult) => `<div style="background:#fff;border:2px solid ${TINTA};border-radius:8px;display:flex;align-items:center;justify-content:center;aspect-ratio:1">${ult ? '<b style="font-size:34px;color:#D9480F">?</b>' : celulaSvg(c, 52)}</div>`;
      const q = document.createElement('div');
      q.style.cssText = 'display:grid;grid-template-columns:repeat(3,58px);gap:5px;justify-content:center;margin:2px auto 6px';
      q.innerHTML = m.grade.flatMap((l, r) => l.map((c, k) => cel(c, r === 2 && k === 2))).join('');
      palco.appendChild(q);
      botoesSvg(palco, [m.certa, ...m.erradas].map(c => celulaSvg(c, 56)), 0, 3, [m.certa, ...m.erradas].map(descreve));
    } };
}

// ---------- 2. Sequências (estilo Cattell / testes de raciocínio) ----------
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function dadosSerie(d) {
  const t = d === 1 ? 0 : d === 2 ? sorteia(1, 2) : d === 3 ? sorteia(3, 4) : d === 4 ? sorteia(5, 6) : sorteia(7, 9);
  let s, certa, regra, letras = false;
  if (t === 0) { const a = sorteia(2, 9), k = sorteia(3, 9); s = [0, 1, 2, 3, 4].map(i => a + i * k); certa = a + 5 * k; regra = `Soma ${k} toda vez.`; }
  else if (t === 1) { const a = sorteia(2, 5); s = [0, 1, 2, 3, 4].map(i => a * 2 ** i); certa = a * 32; regra = 'Dobra toda vez.'; }
  else if (t === 2) { const a = sorteia(20, 40), x = sorteia(3, 6), y = sorteia(1, 2); s = [a]; for (let i = 1; i < 5; i++) s.push(s.at(-1) + (i % 2 ? x : -y)); certa = s.at(-1) + x; regra = `Alterna: soma ${x}, tira ${y}.`; }
  else if (t === 3) { const a = sorteia(1, 3), b = sorteia(2, 4); s = [a, b]; while (s.length < 6) s.push(s.at(-1) + s.at(-2)); certa = s[5] + s[4]; s = s.slice(0, 6); regra = 'Cada número é a soma dos dois anteriores.'; }
  else if (t === 4) { const a = sorteia(2, 8); s = [a]; for (let i = 1; i < 5; i++) s.push(s.at(-1) + 2 * i); certa = s.at(-1) + 10; regra = 'A diferença cresce de 2 em 2: +2, +4, +6, +8, +10.'; }
  else if (t === 5) { const a = sorteia(1, 3); s = [a]; for (let i = 1; i < 5; i++) s.push(s.at(-1) * 2 + 1); certa = s.at(-1) * 2 + 1; regra = 'Dobra e soma 1.'; }
  else if (t === 6) { letras = true; const a = sorteia(0, 4); const ix = [a, a + 2, a + 5, a + 9, a + 14]; s = ix.map(i => LETRAS[i]); certa = LETRAS[a + 20]; regra = 'Os saltos no alfabeto crescem: pula 1, depois 2, 3, 4, 5 letras.'; }
  else if (t === 7) { const a = sorteia(1, 3); s = [0, 1, 2, 3, 4].map(i => (a + i) ** 2 + 1); certa = (a + 5) ** 2 + 1; regra = `São quadrados mais 1: ${a + 5}×${a + 5} + 1 = ${certa}.`; }
  else if (t === 8) { const x = sorteia(2, 6), k = sorteia(2, 4), y = sorteia(40, 60), j = sorteia(3, 7); s = [x, y, x * k, y - j, x * k * k, y - 2 * j]; certa = x * k ** 3; regra = `Duas sequências intercaladas: ${x}, ${x * k}, ${x * k * k}... (vezes ${k}) e ${y}, ${y - j}, ${y - 2 * j}... (menos ${j}).`; }
  else { const a = sorteia(1, 2); s = [0, 1, 2, 3].map(i => (a + i) ** 3); certa = (a + 4) ** 3; regra = `São cubos: ${a + 4}×${a + 4}×${a + 4} = ${certa}.`; }
  const erradas = letras ? [LETRAS[LETRAS.indexOf(certa) - 1], LETRAS[LETRAS.indexOf(certa) + 1], LETRAS[LETRAS.indexOf(certa) - 2], LETRAS[LETRAS.indexOf(certa) + 2]]
    : [certa + 1, certa - 1, certa + 2, certa - 2, certa * 2, Math.round(certa * 1.5)].filter(v => v > 0);
  return { s, certa: String(certa), erradas, regra };
}
function serie(d) {
  const x = dadosSerie(d);
  return { id: 'serie' + x.s.join(','), p: `Qual vem depois?\n${x.s.join(', ')}, ?`, porque: `${x.regra} A resposta é ${x.certa}.`,
    monta(palco) { botoes(palco, opcoes(x.certa, x.erradas), x.certa); } };
}

// ---------- 3. Verbal (semelhanças, analogias, vocabulário e intruso, como no WAIS) ----------
// [dificuldade, pergunta, certa, [erradas], explicação]
const VERBAL = [
  [1, 'Qual palavra NÃO pertence ao grupo?', 'Cenoura', ['Maçã', 'Banana', 'Uva'], 'Cenoura é legume; as outras são frutas.'],
  [1, 'Cachorro está para latir assim como gato está para…', 'Miar', ['Rugir', 'Uivar', 'Cacarejar'], 'É o som que cada animal faz.'],
  [1, 'O que uma maçã e uma banana têm em comum?', 'São frutas', ['São vermelhas', 'São legumes', 'Nascem embaixo da terra'], 'As duas são frutas.'],
  [1, 'Pé está para sapato assim como mão está para…', 'Luva', ['Anel', 'Dedo', 'Braço'], 'É o que veste cada parte do corpo.'],
  [1, 'Qual é o contrário de "generoso"?', 'Mesquinho', ['Bondoso', 'Alegre', 'Corajoso'], 'Generoso divide; mesquinho guarda tudo para si.'],
  [1, 'O que um barco e um avião têm em comum?', 'São meios de transporte', ['Andam na água', 'Têm rodas', 'Voam'], 'Os dois levam pessoas e cargas de um lugar a outro.'],
  [2, 'Livro está para biblioteca assim como quadro está para…', 'Museu', ['Pintor', 'Moldura', 'Parede'], 'É o lugar onde ficam guardados e expostos.'],
  [2, 'O que um poema e uma estátua têm em comum?', 'São obras de arte', ['São feitos de pedra', 'Rimam', 'São sempre antigos'], 'Os dois são criações artísticas.'],
  [2, 'Qual palavra NÃO pertence ao grupo?', 'Flauta', ['Violino', 'Violão', 'Harpa'], 'A flauta é de sopro; os outros são de cordas.'],
  [2, 'Lobo está para alcateia assim como abelha está para…', 'Enxame', ['Rebanho', 'Cardume', 'Manada'], 'Alcateia é o grupo de lobos; enxame, o de abelhas.'],
  [2, 'Qual palavra NÃO pertence ao grupo?', 'Tubarão', ['Baleia', 'Golfinho', 'Foca'], 'O tubarão é peixe; os outros são mamíferos.'],
  [2, 'Qual é o sinônimo de "veloz"?', 'Rápido', ['Lento', 'Pesado', 'Forte'], 'Veloz e rápido querem dizer a mesma coisa.'],
  [3, 'Termômetro está para temperatura assim como barômetro está para…', 'Pressão do ar', ['Chuva', 'Luz', 'Velocidade do vento'], 'O barômetro mede a pressão atmosférica.'],
  [3, 'O que um relógio e um calendário têm em comum?', 'Medem o tempo', ['Têm ponteiros', 'Ficam na parede', 'Usam pilha'], 'Os dois servem para medir a passagem do tempo.'],
  [3, 'Qual palavra NÃO pertence ao grupo?', 'Bronze', ['Ferro', 'Cobre', 'Ouro'], 'Bronze é uma liga (mistura de metais); os outros são elementos puros.'],
  [3, 'Qual palavra NÃO pertence ao grupo?', 'Lua', ['Mercúrio', 'Vênus', 'Marte'], 'A Lua é um satélite; os outros são planetas.'],
  [3, 'Arquiteto está para projeto assim como compositor está para…', 'Partitura', ['Palco', 'Plateia', 'Instrumento'], 'É onde cada um registra a sua criação.'],
  [3, 'Qual é o contrário de "escasso"?', 'Abundante', ['Raro', 'Pequeno', 'Pobre'], 'Escasso é quando falta; abundante é quando sobra.'],
  [3, 'Ovelha está para lã assim como bicho-da-seda está para…', 'Seda', ['Algodão', 'Couro', 'Mel'], 'É o material que cada animal fornece.'],
  [4, 'Qual é o contrário de "prolixo"?', 'Conciso', ['Confuso', 'Longo', 'Detalhado'], 'Prolixo fala demais; conciso diz tudo em poucas palavras.'],
  [4, 'Qual é o sinônimo de "efêmero"?', 'Passageiro', ['Eterno', 'Frágil', 'Enorme'], 'Efêmero é o que dura pouco.'],
  [4, 'O que a liberdade e a justiça têm em comum?', 'São valores abstratos', ['São leis escritas', 'São objetos', 'São lugares'], 'São ideias, não coisas que se pegam.'],
  [4, 'Qual palavra NÃO pertence ao grupo?', 'Cubo', ['Triângulo', 'Quadrado', 'Círculo'], 'O cubo é um sólido (3D); as outras são figuras planas.'],
  [4, 'Médico está para diagnóstico assim como juiz está para…', 'Sentença', ['Advogado', 'Tribunal', 'Crime'], 'É a decisão que cada um dá no seu trabalho.'],
  [4, 'Qual palavra NÃO pertence ao grupo?', 'Sapo', ['Cobra', 'Lagarto', 'Jacaré'], 'O sapo é anfíbio; os outros são répteis.'],
  [4, 'O que uma mosca e uma árvore têm em comum?', 'São seres vivos', ['Têm asas', 'Fazem fotossíntese', 'Vivem na água'], 'As duas nascem, crescem e se reproduzem.'],
  [5, 'Qual é o significado de "ubíquo"?', 'Presente em toda parte', ['Muito antigo', 'Raro', 'Escondido'], 'Ubíquo é o que está em todos os lugares ao mesmo tempo.'],
  [5, 'Qual é o contrário de "obsoleto"?', 'Moderno', ['Antigo', 'Ultrapassado', 'Inútil'], 'Obsoleto é o que ficou ultrapassado.'],
  [5, 'Quem é "perspicaz"…', 'Percebe as coisas rápido', ['Fala demais', 'É teimoso', 'Tem medo de tudo'], 'Perspicaz é quem tem percepção aguda, sagaz.'],
  [5, 'Mapa está para território assim como partitura está para…', 'Música', ['Papel', 'Maestro', 'Orquestra'], 'Os dois são a representação escrita de outra coisa.'],
  [5, 'Pintor está para tela assim como escultor está para…', 'Mármore', ['Pincel', 'Museu', 'Tinta'], 'É o material onde cada um cria a obra.'],
  [5, 'O que o vento e a água de um rio têm em comum?', 'Podem gerar energia', ['São sólidos', 'Têm cor', 'São feitos pelo homem'], 'Os dois movimentam turbinas: energia eólica e hidrelétrica.'],
];
function verbal(d) {
  const nivel = VERBAL.filter(v => v[0] === d), [, p, certa, erradas, exp] = um(nivel);
  return { id: p + certa, p, porque: exp, monta(palco) { botoes(palco, [certa, ...erradas], certa); } };
}

// ---------- 4. Raciocínio aritmético (problemas falados, como no WAIS) ----------
function dadosAritmetica(d) {
  let p, certa, erradas, porque, pre = '';
  if (d === 1) { const a = sorteia(12, 30), b = sorteia(5, 15), c = sorteia(3, 10); certa = a + b - c;
    p = `Lia tinha ${a} figurinhas, ganhou ${b} e deu ${c} para a irmã. Com quantas ficou?`; erradas = [a + b + c, a - b + c, certa + 1, certa - 2]; porque = `${a} + ${b} − ${c} = ${certa}.`; }
  else if (d === 2) { const pr = sorteia(2, 9), n = sorteia(2, 5); let m = sorteia(6, 9); certa = m * pr; pre = 'R$ ';
    p = `${n} cadernos custam R$ ${n * pr}. Quanto custam ${m} cadernos?`; erradas = [certa + pr, certa - pr, n * pr + m, certa + 2, certa + 2 * pr, certa - 1]; porque = `Cada caderno custa R$ ${pr}; ${m} × ${pr} = ${certa}.`; }
  else if (d === 3) { const [v, min] = um([[60, 45], [60, 20], [30, 40], [90, 20], [120, 15], [40, 45], [60, 50]]); const km = v * min / 60; certa = min;
    p = `Um ônibus anda a ${v} km por hora. Quantos minutos ele leva para andar ${km} km?`; erradas = [min + 10, min - 5, km, Math.round(60 * v / km / 10) * 10 || min + 15]; porque = `Em 1 minuto ele anda ${v / 60} km; ${km} ÷ ${v / 60} = ${min} minutos.`; }
  else if (d === 4) { const [a, b] = um([[2, 4], [3, 6], [4, 2], [6, 3], [2, 6], [6, 2], [3, 1]]), t = b * sorteia(1, 3) * (a === 3 && b === 1 ? 1 : 1); certa = a * t / b;
    p = `${a} pedreiros levantam um muro em ${t} dias. Em quantos dias ${b} ${b > 1 ? 'pedreiros fazem' : 'pedreiro faz'} o mesmo muro, no mesmo ritmo?`; erradas = [t * b / a, t, certa + 1, certa * 2].map(v => Math.round(v)); porque = `O muro dá ${a} × ${t} = ${a * t} dias de trabalho; dividido por ${b} = ${certa} dias.`; }
  else { const [pr, x] = um([[100, 10], [200, 20], [500, 50], [400, 10], [200, 50], [300, 20]]); certa = pr * (100 + x) * (100 - x) / 10000; pre = 'R$ ';
    p = `Uma camisa de R$ ${pr} subiu ${x}% e depois teve desconto de ${x}%. Quanto custa agora?`; erradas = [pr, pr * (100 + x) / 100, pr * (100 - x) / 100, certa + x]; porque = `Subiu para R$ ${pr * (100 + x) / 100}; ${x}% de desconto sobre esse valor dá R$ ${certa}. Não volta ao preço original!`; }
  return { p, certa: pre + certa, erradas: erradas.filter(v => v > 0 && Number.isInteger(v) && v !== certa).map(v => pre + v), porque };
}
function aritmetica(d) {
  const x = dadosAritmetica(d);
  return { id: x.p, p: x.p, porque: x.porque, monta(palco) { botoes(palco, opcoes(x.certa, x.erradas), x.certa); } };
}

// ---------- 5. Memória de dígitos (na ordem e de trás para frente, como no WAIS) ----------
function dadosDigitos(d) {
  const n = [0, 5, 6, 4, 5, 6][d], inverso = d >= 3;
  let seq;
  do { seq = []; while (seq.length < n) { const x = sorteia(1, 9); if (x !== seq.at(-1)) seq.push(x); } } while (inverso && seq.join() === [...seq].reverse().join());
  const alvo = inverso ? [...seq].reverse() : seq, fmt = a => a.join(' '), certa = fmt(alvo);
  const variantes = new Set();
  for (let t = 0; t < 40 && variantes.size < 3; t++) {
    const v = [...alvo], k = sorteia(0, n - 2);
    if (t % 3 === 0) [v[k], v[k + 1]] = [v[k + 1], v[k]];
    else if (t % 3 === 1) v[k] = (v[k] % 9) + 1;
    else { const j = sorteia(0, n - 1); [v[0], v[j]] = [v[j], v[0]]; }
    if (fmt(v) !== certa) variantes.add(fmt(v));
  }
  if (inverso) variantes.add(fmt(seq)); // erro clássico: repetir na ordem em que ouviu
  return { seq, inverso, certa, erradas: [...variantes].slice(-3) };
}
function digitos(d) {
  const x = dadosDigitos(d);
  return { p: x.inverso ? 'Memorize os números. Depois, escolha-os de TRÁS PARA FRENTE.' : 'Memorize os números na ordem.',
    porque: `A sequência era ${x.seq.join(' ')}${x.inverso ? `; de trás para frente: ${x.certa}` : ''}.`,
    monta(palco) {
      const tela = document.createElement('div');
      tela.style.cssText = `display:flex;align-items:center;justify-content:center;height:180px;font-size:96px;font-weight:800;color:${TINTA}`;
      palco.appendChild(tela);
      let i = 0;
      const passo = () => {
        if (i < x.seq.length) { tela.textContent = x.seq[i++]; tela.animate?.([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], 200); limpezas.push(clearTimeout.bind(null, setTimeout(passo, 1000))); return; }
        tela.remove();
        $('pergunta').textContent = x.inverso ? 'Qual era a sequência de TRÁS PARA FRENTE?' : 'Qual era a sequência?';
        const g = grade(palco, 1);
        embaralha([x.certa, ...x.erradas]).forEach(o => { const b = botao(g, o, () => o === x.certa ? ganhar(b) : errar(b)); b.style.fontSize = '26px'; b.style.letterSpacing = '3px'; if (o === x.certa) b.dataset.certo = 1; });
      };
      passo();
    } };
}

// ---------- 6. Rotação mental (só girar; figura espelhada não vale) ----------
const PECAS = { F: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]], L: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]], N: [[1, 0], [1, 1], [0, 2], [1, 2], [0, 3]],
  P: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], Y: [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]] };
const normaliza = q => { const mx = Math.min(...q.map(p => p[0])), my = Math.min(...q.map(p => p[1])); return q.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const gira = (q, k) => { let r = q; for (let i = 0; i < k; i++) r = r.map(([x, y]) => [-y, x]); return normaliza(r); };
const espelha = q => normaliza(q.map(([x, y]) => [-x, y]));
const kq = q => JSON.stringify(q);
function pecaSvg(q, tam = 64, cor = '#FF8A1F') {
  const w = Math.max(...q.map(p => p[0])) + 1, h = Math.max(...q.map(p => p[1])) + 1, l = 12, ox = (60 - w * l) / 2, oy = (60 - h * l) / 2;
  return `<svg viewBox="0 0 60 60" width="${tam}" height="${tam}">${q.map(([x, y]) => `<rect x="${ox + x * l}" y="${oy + y * l}" width="${l}" height="${l}" fill="${cor}" stroke="${TINTA}" stroke-width="1.6"/>`).join('')}</svg>`;
}
function dadosRotacao() {
  const nome = um(Object.keys(PECAS)), base = normaliza(PECAS[nome]), modelo = gira(base, sorteia(0, 3));
  const certa = gira(modelo, sorteia(1, 3)), espelho = espelha(modelo);
  const erradas = embaralha([0, 1, 2, 3]).slice(0, 3).map(k => gira(espelho, k));
  return { modelo, certa, erradas };
}
function rotacao() {
  const x = dadosRotacao();
  return { p: 'Qual peça é a MESMA do modelo, só que girada? (Espelhada não vale.)', porque: 'As outras são o modelo espelhado: nenhum giro faz elas ficarem iguais.',
    monta(palco) {
      const m = document.createElement('div'); m.style.cssText = 'display:flex;flex-direction:column;align-items:center;font-weight:800;color:#8A5A3A;font-size:14px';
      m.innerHTML = `MODELO${pecaSvg(x.modelo, 96, '#FFC928')}`; palco.appendChild(m);
      botoesSvg(palco, [x.certa, ...x.erradas].map(q => pecaSvg(q, 70)), 0, 2);
    } };
}

// ---------- 7. Balanças (pesos equivalentes, como no WAIS-IV) ----------
function dadosBalanca(d) {
  const a = sorteia(2, 4), A = '🔺', B = '🔵', C = '🟦';
  if (d <= 3) { const b = sorteia(2, 3);
    return { linhas: [`${B} = ${A.repeat(a)}`, `${C} = ${B.repeat(b)}`], pergunta: `Quantos ${A} pesam o mesmo que ${C}?`, certa: a * b, porque: `${C} = ${b} ${B} e cada ${B} = ${a} ${A}: ${b} × ${a} = ${a * b}.` }; }
  return { linhas: [`${B} = ${A.repeat(a)}`, `${C} ${A} = ${B} ${B}`], pergunta: `Quantos ${A} pesam o mesmo que ${C}?`, certa: 2 * a - 1,
    porque: `${B} ${B} = ${2 * a} ${A}. Se ${C} mais um ${A} pesa isso, ${C} = ${2 * a} − 1 = ${2 * a - 1}.` };
}
function balanca(d) {
  const x = dadosBalanca(d);
  return { id: x.linhas.join('|'), p: x.pergunta, porque: x.porque,
    monta(palco) {
      const c = document.createElement('div');
      c.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center;margin:6px 0 4px';
      c.innerHTML = x.linhas.map(l => `<div style="background:#fff;border:2px solid ${TINTA};border-radius:14px;padding:6px 14px;font-size:26px;letter-spacing:2px">⚖️ ${l}</div>`).join('');
      palco.appendChild(c);
      botoes(palco, opcoes(String(x.certa), [x.certa + 1, x.certa - 1, x.certa + 2, x.certa * 2, x.certa - 2].filter(v => v > 0)), String(x.certa));
    } };
}

// ---------- 8. Sequência de figuras (o que vem no 5º quadro?) ----------
function dadosFiguras(d) {
  // só figuras que mudam de cara a cada 45° (a cruz e o quadrado se repetiriam)
  const forma = d === 1 ? 'seta' : um(['seta', 'seta', 'triangulo']), P = embaralha(PREENCH), base = sorteia(0, 7) * 45;
  // cada nível soma uma regra: giro, preenchimento em ciclo, quantidade em ciclo, giro ao contrário
  const giro = d === 1 ? 90 : d === 5 ? -45 : 45, sentido = giro > 0 ? 'horário' : 'anti-horário';
  const quadro = i => ({ forma, rot: ((base + i * giro) % 360 + 360) % 360,
    preench: d >= 3 ? P[i % 3] : d === 2 ? P[i % 2] : 'cheio', n: d >= 4 ? i % 3 + 1 : 1 });
  const regras = [`a figura gira ${Math.abs(giro)}° no sentido ${sentido}`];
  if (d === 2) regras.push('o preenchimento se reveza entre dois'); if (d >= 3) regras.push('o preenchimento segue um ciclo de 3');
  if (d >= 4) regras.push('a quantidade vai 1, 2, 3 e volta');
  const certa = quadro(4), cand = [quadro(3), quadro(5), { ...certa, rot: (certa.rot + 180) % 360 }];
  [0, 45, 90, 135, 180, 225, 270, 315].forEach(rot => cand.push({ ...certa, rot }));
  PREENCH.forEach(preench => cand.push({ ...certa, preench })); [1, 2, 3].forEach(n => cand.push({ ...certa, n }));
  const vistas = new Set([chave(certa)]), erradas = [];
  for (const c of [cand[0], ...embaralha(cand.slice(1))]) { const k = chave(c); if (!vistas.has(k)) { vistas.add(k); erradas.push(c); } if (erradas.length === 5) break; }
  return { quadros: [0, 1, 2, 3].map(quadro), certa, erradas, regra: 'A cada quadro, ' + regras.join(', ') + '.' };
}
function figuras(d) {
  const x = dadosFiguras(d);
  return { p: 'Qual figura vem no 5º quadro?', porque: x.regra,
    monta(palco) {
      const q = document.createElement('div');
      q.style.cssText = 'display:grid;grid-template-columns:repeat(5,52px);gap:4px;justify-content:center;margin:2px auto 8px';
      q.innerHTML = [...x.quadros, null].map(c => `<div style="background:#fff;border:2px solid ${TINTA};border-radius:8px;display:flex;align-items:center;justify-content:center;aspect-ratio:1">${c ? celulaSvg(c, 46) : '<b style="font-size:30px;color:#D9480F">?</b>'}</div>`).join('');
      palco.appendChild(q);
      botoesSvg(palco, [x.certa, ...x.erradas].map(c => celulaSvg(c, 56)), 0, 3, [x.certa, ...x.erradas].map(descreve));
    } };
}

// ---------- 9. Figura diferente (4 são a mesma peça girada; 1 está espelhada) ----------
function dadosIntruso() {
  const base = normaliza(PECAS[um(Object.keys(PECAS))]);
  return { iguais: [0, 1, 2, 3].map(k => gira(base, k)), certa: gira(espelha(base), sorteia(0, 3)) };
}
function intruso() {
  const x = dadosIntruso();
  return { p: 'Quatro peças são a MESMA, só que giradas. Qual é a diferente?', porque: 'A diferente está espelhada, como num espelho: nenhum giro deixa ela igual às outras.',
    monta(palco) { botoesSvg(palco, [x.certa, ...x.iguais].map(q => pecaSvg(q, 70)), 0, 3); } };
}

const QIT = { matriz, serie, verbal, aritmetica, digitos, rotacao, balanca, figuras, intruso };
// fila do teste: [area, dificuldade] na ordem em que aparecem
const filaTeste = area => (area === 'logica' ? PLANO_LOGICA : PLANO_QI).flatMap((nivel, k) => embaralha(nivel).map(a => [a, k + 1]));
// QI a partir dos acertos ponderados pela dificuldade: média 100, desvio 15 (a média esperada é acertar metade dos pontos)
function qiDoTeste(respostas) {
  let pts = 0, max = 0;
  respostas.forEach(r => { max += r.d; if (r.certo) pts += r.d; });
  const z = (pts / max - .5) * 6; // tudo certo = +3 desvios (QI 145), metade = 100
  return Math.max(70, Math.min(148, Math.round(100 + 15 * z)));
}

// autoteste das regras (roda uma vez ao carregar; não aparece para o jogador)
(() => {
  for (let i = 0; i < 300; i++) {
    const d = 1 + (i % 5);
    const m = dadosMatriz(d), ks = [m.certa, ...m.erradas].map(chave);
    console.assert(new Set(ks).size === 6, 'matriz com opção repetida', d);
    const s = dadosSerie(d), os = opcoes(s.certa, s.erradas); console.assert(new Set(os).size === os.length && os.length >= 4, 'série', s);
    const a = dadosAritmetica(d), oa = opcoes(a.certa, a.erradas); console.assert(oa.length >= 4 && new Set(oa).size === oa.length, 'aritmética', a);
    const g = dadosDigitos(d); console.assert(g.erradas.length === 3 && !g.erradas.includes(g.certa), 'dígitos', g);
    const r = dadosRotacao(), giros = [0, 1, 2, 3].map(k => kq(gira(r.modelo, k)));
    console.assert(giros.includes(kq(r.certa)) && r.erradas.every(e => !giros.includes(kq(e))) && new Set(r.erradas.map(kq)).size === 3, 'rotação');
    const b = dadosBalanca(d); console.assert(b.certa > 1, 'balança');
    const f = dadosFiguras(d); console.assert(f.erradas.length === 5 && new Set([f.certa, ...f.erradas].map(chave)).size === 6, 'figuras', d);
    const t = dadosIntruso(), giros2 = t.iguais.map(kq); console.assert(new Set(giros2).size === 4 && !giros2.includes(kq(t.certa)), 'intruso');
  }
  [1, 2, 3, 4, 5].forEach(d => console.assert(VERBAL.filter(v => v[0] === d).length >= 5, 'verbal poucas no nível', d));
  console.assert(qiDoTeste(Array(30).fill({ d: 3, certo: true })) === 145 && qiDoTeste(Array(30).fill({ d: 3, certo: false })) === 70, 'escala do QI');
})();
