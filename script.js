// Gerar as 30 linhas numeradas ao carregar a página
const lineNumbersContainer = document.getElementById('line-numbers');
for (let i = 1; i <= 30; i++) {
  const lineDiv = document.createElement('div');
  lineDiv.className = 'line-number';
  lineDiv.innerText = i;
  lineNumbersContainer.appendChild(lineDiv);
}

const editor = document.getElementById('editor');
const tema = document.getElementById('tema');
const titulo = document.getElementById('titulo');
const rascunho = document.getElementById('rascunho');

let idRedacaoAtual = localStorage.getItem('redacao_atual_id') || Date.now().toString();

// Gerenciamento e Salvamento de Histórico Local
function salvarProgressoLocal() {
  let redacoes = JSON.parse(localStorage.getItem('minhas_redacoes') || '{}');
  
  redacoes[idRedacaoAtual] = {
    id: idRedacaoAtual,
    tema: tema.innerText,
    titulo: titulo.value,
    conteudo: editor.innerHTML,
    rascunho: rascunho.value
  };

  localStorage.setItem('minhas_redacoes', JSON.stringify(redacoes));
  localStorage.setItem('redacao_atual_id', idRedacaoAtual);
  
  renderizarHistorico();
  document.getElementById('save-status').innerText = '✓ Salvo automaticamente';
}

function renderizarHistorico() {
  const container = document.getElementById('history-list');
  const redacoes = JSON.parse(localStorage.getItem('minhas_redacoes') || '{}');
  container.innerHTML = '';

  Object.values(redacoes).reverse().forEach(item => {
    const div = document.createElement('div');
    div.className = `history-item ${item.id === idRedacaoAtual ? 'active' : ''}`;
    
    const tituloExibicao = item.titulo && item.titulo.trim() !== '' ? item.titulo : 'Sem título';
    
    div.innerHTML = `
      <span onclick="carregarRedacao('${item.id}')" style="flex: 1; overflow: hidden; text-overflow: ellipsis;">📝 ${tituloExibicao}</span>
      <button class="btn-delete-item" onclick="deletarRedacao('${item.id}', event)">✕</button>
    `;
    container.appendChild(div);
  });
}

function carregarRedacao(id) {
  const redacoes = JSON.parse(localStorage.getItem('minhas_redacoes') || '{}');
  if (redacoes[id]) {
    idRedacaoAtual = id;
    tema.innerText = redacoes[id].tema || '';
    titulo.value = redacoes[id].titulo || '';
    editor.innerHTML = redacoes[id].conteudo || '';
    rascunho.value = redacoes[id].rascunho || '';
    
    localStorage.setItem('redacao_atual_id', idRedacaoAtual);
    atualizarContadores();
    renderizarHistorico();
  }
}

function novaRedacao() {
  idRedacaoAtual = Date.now().toString();
  tema.innerText = '';
  titulo.value = '';
  editor.innerHTML = '';
  rascunho.value = '';
  atualizarContadores();
  salvarProgressoLocal();
}

function deletarRedacao(id, e) {
  e.stopPropagation();
  let redacoes = JSON.parse(localStorage.getItem('minhas_redacoes') || '{}');
  delete redacoes[id];
  localStorage.setItem('minhas_redacoes', JSON.stringify(redacoes));
  
  if (id === idRedacaoAtual) {
    novaRedacao();
  } else {
    renderizarHistorico();
  }
}

function aoDigitarNoEditor() {
  atualizarContadores();
  salvarProgressoLocal();
}

window.onload = function() {
  renderizarHistorico();
  carregarRedacao(idRedacaoAtual);
};

// Alternância de Tema (Escuro / Claro)
function toggleTheme() {
  const body = document.body;
  const themeBtn = document.getElementById('theme-btn');
  body.classList.toggle('dark-mode');

  if (body.classList.contains('dark-mode')) {
    themeBtn.innerText = '☀️ Modo Claro';
  } else {
    themeBtn.innerText = '🌙 Modo Escuro';
  }
}

// Corretor Ortográfico
let spellcheckAtivo = true;
function toggleSpellcheck() {
  spellcheckAtivo = !spellcheckAtivo;
  const btn = document.getElementById('spellcheck-btn');
  const campos = [editor, tema, titulo, rascunho];

  campos.forEach(campo => {
    if (campo) {
      campo.setAttribute('spellcheck', spellcheckAtivo ? 'true' : 'false');
    }
  });

  btn.innerText = spellcheckAtivo ? '✓ Corretor: ON' : '✗ Corretor: OFF';
}

function inserirTabulacao() {
  editor.focus();
  document.execCommand('insertHTML', false, '&#09;');
  aoDigitarNoEditor();
}

function alterarTamanhoFonte(tamanho) {
  if (!tamanho) return;
  const selecao = window.getSelection();
  if (selecao.rangeCount > 0 && !selecao.isCollapsed) {
    const span = document.createElement('span');
    span.style.fontSize = tamanho;
    const range = selecao.getRangeAt(0);
    range.surroundContents(span);
  } else {
    editor.style.fontSize = tamanho;
  }
  salvarProgressoLocal();
}

function handleTabIndent(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    
    if (e.target === editor) {
      document.execCommand('insertHTML', false, '&#09;');
    } 
    else if (e.target === rascunho) {
      const start = rascunho.selectionStart;
      const end = rascunho.selectionEnd;
      rascunho.value = rascunho.value.substring(0, start) + "\t" + rascunho.value.substring(end);
      rascunho.selectionStart = rascunho.selectionEnd = start + 1;
    }
    
    aoDigitarNoEditor();
  }
}

editor.addEventListener('keydown', handleTabIndent);
rascunho.addEventListener('keydown', handleTabIndent);

function execCmd(command) {
  document.execCommand(command, false, null);
  salvarProgressoLocal();
}

function atualizarContadores() {
  const texto = editor.innerText || '';
  const caracteres = texto.replace(/\n/g, '').length;
  const palavras = texto.trim() === '' ? 0 : texto.trim().split(/\s+/).length;

  document.getElementById('char-count').innerText = `Caracteres: ${caracteres}`;
  document.getElementById('word-count').innerText = `Palavras: ${palavras}`;
}

// Exportação de Documentos
function exportarDocumento() {
  const formato = document.getElementById('export-format').value;
  const temaTexto = tema.innerText.trim();
  const tituloTexto = titulo.value.trim() || 'Minha_Redacao';
  const rascunhoTexto = rascunho.value;
  const textoSimples = editor.innerText;
  const htmlEditor = editor.innerHTML;

  const nomeBase = tituloTexto.replace(/[^a-zA-Z0-9áàâãéèêíóòôõúçÁÀÂÃÉÈÊÍÓÒÔÕÚÇ\s]/g, '').replace(/\s+/g, '_');

  if (formato === 'txt') {
    let conteudoCompleto = '';
    if (temaTexto !== '') conteudoCompleto += `TEMA: ${temaTexto}\n\n`;
    conteudoCompleto += `${tituloTexto.toUpperCase()}\n\n${textoSimples}`;
    if (rascunhoTexto.trim() !== '') {
      conteudoCompleto += `\n\n----------------------------------------\nNOTAS DE RASCUNHO:\n\n${rascunhoTexto}`;
    }
    baixarArquivo(conteudoCompleto, `${nomeBase}.txt`, 'text/plain;charset=utf-8');
  } 
  else if (formato === 'doc') {
    let conteudoHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>${tituloTexto}</title></head>
      <body style="font-family: Georgia, serif;">
    `;
    if (temaTexto !== '') conteudoHTML += `<p><i><b>Tema:</b> ${temaTexto}</i></p>`;
    conteudoHTML += `<h2>${tituloTexto.toUpperCase()}</h2><div>${htmlEditor}</div>`;
    if (rascunhoTexto.trim() !== '') {
      conteudoHTML += `<hr/><br/><h3>NOTAS DE RASCUNHO:</h3><p>${rascunhoTexto.replace(/\n/g, '<br/>')}</p>`;
    }
    conteudoHTML += `</body></html>`;

    baixarArquivo(conteudoHTML, `${nomeBase}.doc`, 'application/msword');
  } 
  else if (formato === 'pdf') {
    const elemento = document.getElementById('paper-to-print');
    elemento.classList.add('printing');

    const opcoes = {
      margin:       0,
      filename:     `${nomeBase}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opcoes).from(elemento).save().then(() => {
      elemento.classList.remove('printing');
    }).catch(() => {
      elemento.classList.remove('printing');
    });
  }
}

function baixarArquivo(conteudo, nomeArquivo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(link.href);
}