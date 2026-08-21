// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBhY331nB6_AIcqZ9NCX6bBCTLfqeDydC4",
  authDomain: "redacao-damieri.firebaseapp.com",
  projectId: "redacao-damieri",
  storageBucket: "redacao-damieri.firebasestorage.app",
  messagingSenderId: "97816688466",
  appId: "1:97816688466:web:44679682c4a9d83113ac8b",
  measurementId: "G-MGBQJ5GB1X"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Elementos da Interface
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

let usuarioAtivo = null;
let modoCadastro = false;
let idRedacaoAtual = null;
let debounceTimer = null;

// ==========================================
// AUTENTICAÇÃO COM FIREBASE
// ==========================================
auth.onAuthStateChanged((user) => {
  if (user) {
    usuarioAtivo = user;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    document.getElementById('user-display-email').innerText = user.email;

    carregarHistoricoNuvem();
  } else {
    usuarioAtivo = null;
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
  }
});

function alternarModoAutenticacao() {
  modoCadastro = !modoCadastro;
  const title = document.getElementById('auth-title');
  const btn = document.getElementById('auth-submit-btn');
  const label = document.getElementById('auth-toggle-label');
  const link = document.getElementById('auth-toggle-link');
  const msg = document.getElementById('auth-message');

  msg.innerText = '';

  if (modoCadastro) {
    title.innerText = 'Criar Nova Conta';
    btn.innerText = 'Cadastrar';
    label.innerText = 'Já possui uma conta?';
    link.innerText = 'Entrar';
  } else {
    title.innerText = 'Entrar na Conta';
    btn.innerText = 'Entrar';
    label.innerText = 'Não tem uma conta?';
    link.innerText = 'Cadastre-se';
  }
}

function processarAutenticacao() {
  const emailInput = document.getElementById('auth-email').value.trim();
  const passwordInput = document.getElementById('auth-password').value;
  const msg = document.getElementById('auth-message');

  if (!emailInput || !passwordInput) {
    msg.className = 'login-error-msg';
    msg.innerText = 'Preencha todos os campos.';
    return;
  }

  msg.innerText = 'Carregando...';

  if (modoCadastro) {
    auth.createUserWithEmailAndPassword(emailInput, passwordInput)
      .then(() => {
        msg.className = 'login-success-msg';
        msg.innerText = 'Conta criada com sucesso!';
      })
      .catch((error) => {
        msg.className = 'login-error-msg';
        msg.innerText = traduzirErroFirebase(error.code);
      });
  } else {
    auth.signInWithEmailAndPassword(emailInput, passwordInput)
      .then(() => {
        msg.innerText = '';
      })
      .catch((error) => {
        msg.className = 'login-error-msg';
        msg.innerText = traduzirErroFirebase(error.code);
      });
  }
}

function fazerLogout() {
  auth.signOut();
}

function traduzirErroFirebase(codigo) {
  switch (codigo) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha inválidos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'Formato de e-mail inválido.';
    default:
      return 'Erro na autenticação. Tente novamente.';
  }
}

// ==========================================
// ARMAZENAMENTO NA NUVEM (FIRESTORE)
// ==========================================
function salvarProgresso() {
  if (!usuarioAtivo) return;

  document.getElementById('save-status').innerText = '⏳ Salvando...';

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!idRedacaoAtual) {
      idRedacaoAtual = Date.now().toString();
    }

    const dadosRedacao = {
      tema: tema.innerText || '',
      titulo: titulo.value || '',
      conteudo: editor.innerHTML || '',
      rascunho: rascunho.value || '',
      atualizadoEm: Date.now()
    };

    db.collection('usuarios')
      .doc(usuarioAtivo.uid)
      .collection('redacoes')
      .doc(idRedacaoAtual)
      .set(dadosRedacao, { merge: true })
      .then(() => {
        document.getElementById('save-status').innerText = '✓ Salvo na nuvem';
      })
      .catch((error) => {
        console.error("Erro ao salvar:", error);
        document.getElementById('save-status').innerText = '✕ Erro ao salvar';
      });
  }, 400);
}

function carregarHistoricoNuvem() {
  if (!usuarioAtivo) return;

  db.collection('usuarios')
    .doc(usuarioAtivo.uid)
    .collection('redacoes')
    .orderBy('atualizadoEm', 'desc')
    .onSnapshot((snapshot) => {
      const container = document.getElementById('history-list');
      container.innerHTML = '';

      if (snapshot.empty) {
        novaRedacao();
        return;
      }

      let encontrouAtual = false;

      snapshot.forEach((doc) => {
        const item = doc.data();
        const id = doc.id;

        if (id === idRedacaoAtual) {
          encontrouAtual = true;
        }

        const div = document.createElement('div');
        div.className = `history-item ${id === idRedacaoAtual ? 'active' : ''}`;
        
        const tituloExibicao = item.titulo && item.titulo.trim() !== '' ? item.titulo : 'Sem título';
        
        div.innerHTML = `
          <span onclick="carregarRedacao('${id}')" style="flex: 1; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📝 ${tituloExibicao}</span>
          <button class="btn-delete-item" onclick="deletarRedacao('${id}', event)">✕</button>
        `;
        container.appendChild(div);
      });

      // Se a redação ativa não existir mais no banco ou for a primeira execução
      if (!idRedacaoAtual || !encontrouAtual) {
        const primeiraDoc = snapshot.docs[0];
        if (primeiraDoc) {
          carregarRedacao(primeiraDoc.id);
        }
      }
    }, (error) => {
      console.error("Erro ao escutar histórico:", error);
    });
}

function carregarRedacao(id) {
  if (!usuarioAtivo || !id) return;

  idRedacaoAtual = id;

  // Atualiza visualmente a seleção da sidebar
  const itens = document.querySelectorAll('.history-item');
  itens.forEach(el => el.classList.remove('active'));

  db.collection('usuarios')
    .doc(usuarioAtivo.uid)
    .collection('redacoes')
    .doc(id)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const dados = doc.data();
        tema.innerText = dados.tema || '';
        titulo.value = dados.titulo || '';
        editor.innerHTML = dados.conteudo || '';
        rascunho.value = dados.rascunho || '';
        atualizarContadores();
        
        // Re-renderiza classe active após seleção
        const historicoItens = document.querySelectorAll('.history-item');
        historicoItens.forEach(item => {
          if (item.querySelector('span')?.getAttribute('onclick')?.includes(id)) {
            item.classList.add('active');
          }
        });
      }
    })
    .catch(err => console.error("Erro ao carregar redação:", err));
}

function novaRedacao() {
  idRedacaoAtual = Date.now().toString();
  tema.innerText = '';
  titulo.value = '';
  editor.innerHTML = '';
  rascunho.value = '';
  atualizarContadores();
  salvarProgresso();
}

function deletarRedacao(id, e) {
  e.stopPropagation();
  if (!usuarioAtivo) return;

  db.collection('usuarios')
    .doc(usuarioAtivo.uid)
    .collection('redacoes')
    .doc(id)
    .delete()
    .then(() => {
      if (id === idRedacaoAtual) {
        idRedacaoAtual = null;
      }
    })
    .catch(err => console.error("Erro ao deletar:", err));
}

function aoDigitarNoEditor() {
  atualizarContadores();
  salvarProgresso();
}


// ==========================================
// PERSISTÊNCIA E ALTERNÂNCIA DO MODO ESCURO
// ==========================================
function toggleTheme() {
  const body = document.body;
  body.classList.toggle('dark-mode');
  
  const isDark = body.classList.contains('dark-mode');
  localStorage.setItem('themePreference', isDark ? 'dark' : 'light');
  
  atualizarBotoesTema(isDark);
}

function atualizarBotoesTema(isDark) {
  const texto = isDark ? '☀️ Modo Claro' : '🌙 Modo Escuro';
  const themeBtn = document.getElementById('theme-btn');
  const loginThemeBtn = document.getElementById('login-theme-btn');
  
  if (themeBtn) themeBtn.innerText = texto;
  if (loginThemeBtn) loginThemeBtn.innerText = texto;
}

function aplicarTemaSalvo() {
  const temaSalvo = localStorage.getItem('themePreference');
  const isDark = temaSalvo === 'dark';

  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  
  atualizarBotoesTema(isDark);
}

// Garante que o tema será aplicado logo após a página carregar por completo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', aplicarTemaSalvo);
} else {
  aplicarTemaSalvo();
}

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
  salvarProgresso();
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
  salvarProgresso();
}

function atualizarContadores() {
  const texto = editor.innerText || '';
  const caracteres = texto.replace(/\n/g, '').length;
  const palavras = texto.trim() === '' ? 0 : texto.trim().split(/\s+/).length;

  document.getElementById('char-count').innerText = `Caracteres: ${caracteres}`;
  document.getElementById('word-count').innerText = `Palavras: ${palavras}`;
}

function exportarDocumento() {
  const format = document.getElementById('export-format').value;
  
  // Captura o elemento da folha da redação (ajuste a classe/id se no seu código tiver outro nome)
  const paperElement = document.querySelector('.paper') || document.querySelector('.essay-paper') || document.querySelector('.editor-container');

  if (!paperElement) {
    alert("Elemento da folha não encontrado!");
    return;
  }

  // Nome do arquivo baseado no título ou padrão
  const titleInput = document.getElementById('essay-title') || document.querySelector('.essay-title');
  const fileName = (titleInput && titleInput.value.trim()) ? titleInput.value.trim() : 'Minha_Redacao';

  if (format === 'png' || format === 'jpg') {
    // Opções de renderização com boa qualidade
    html2canvas(paperElement, {
      scale: 2, // Aumenta a resolução do "print"
      useCORS: true,
      backgroundColor: null // Mantém o fundo original da folha
    }).then(canvas => {
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const imageURL = canvas.toDataURL(mimeType, 0.95);

      // Cria o elemento para download automático
      const downloadLink = document.createElement('a');
      downloadLink.href = imageURL;
      downloadLink.download = `${fileName}.${format}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }).catch(err => {
      console.error("Erro ao gerar a imagem:", err);
      alert("Ocorreu um erro ao gerar a imagem da redação.");
    });
  } else if (format === 'pdf') {
    // Lógica para exportar em PDF (caso já utilize html2pdf)
    if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: 10,
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(paperElement).save();
    }
  } else if (format === 'txt') {
    // Exportação em TXT
    const textContent = document.getElementById('editor')?.innerText || paperElement.innerText;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${fileName}.txt`;
    downloadLink.click();
  } else if (format === 'doc') {
    // Exportação em DOC (HTML mascarado)
    const textContent = document.getElementById('editor')?.innerHTML || paperElement.innerHTML;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const footer = "</body></html>";
    const blob = new Blob([header + textContent + footer], { type: 'application/msword' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = `${fileName}.doc`;
    downloadLink.click();
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


// ==========================================
// AUTENTICAÇÃO COM GOOGLE
// ==========================================
function loginComGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const msg = document.getElementById('auth-message');

  auth.signInWithPopup(provider)
    .then((result) => {
      // Sucesso no Login
      if (msg) msg.innerText = '';
    })
    .catch((error) => {
      console.error("Erro no login Google:", error);
      if (msg) {
        msg.className = 'login-error-msg';
        msg.innerText = 'Falha ao autenticar com a conta do Google.';
      }
    });
}

// ==========================================
// gemini integração
// ==========================================
const GEMINI_API_KEY = "AQ.Ab8RN6IwqrGrn27i7CYdlpStv-iHG57fdevQvC5EPrXuHldHrgI"; 

async function avaliarRedacaoComGemini() {
  const tema = document.getElementById('tema').innerText.trim();
  const titulo = document.getElementById('titulo').value.trim();
  const texto = document.getElementById('editor').innerText.trim();
  const card = document.getElementById('ai-evaluation-card');
  const btn = document.querySelector('.ai-btn-main');

  if (!texto) {
    alert("Escreva sua redação antes de solicitar a avaliação.");
    return;
  }

  btn.innerText = "⏳ Avaliando...";
  btn.disabled = true;

  const systemPrompt = `Você é um corretor de redações bancas examinadoras. Avalie o texto estritamente sob estas 4 competências:
1. Argumentação e Informatividade (AI) - Nota de 0 a 8.
2. Coerência e Coesão (CC) - Nota de 0 a 8.
3. Morfossintaxe (M) - Nota de 0 a 2.
4. Pontuação, Acentuação e Ortografia (PO) - Nota de 0 a 2.

Retorne EXCLUSIVAMENTE um objeto JSON válido no formato:
{
  "score_ai": number,
  "feedback_ai": "string",
  "score_cc": number,
  "feedback_cc": "string",
  "score_m": number,
  "feedback_m": "string",
  "score_po": number,
  "feedback_po": "string",
  "feedback_geral": "string"
}`;

  const userContent = `Tema: ${tema}\nTítulo: ${titulo}\nTexto:\n${texto}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt + "\n\n" + userContent }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    const res = JSON.parse(resultText);

    // Atualização das notas na interface
    document.getElementById('score-ai').innerText = `${res.score_ai.toFixed(1)} / 8.0`;
    document.getElementById('feedback-ai').innerText = res.feedback_ai;

    document.getElementById('score-cc').innerText = `${res.score_cc.toFixed(1)} / 8.0`;
    document.getElementById('feedback-cc').innerText = res.feedback_cc;

    document.getElementById('score-m').innerText = `${res.score_m.toFixed(1)} / 2.0`;
    document.getElementById('feedback-m').innerText = res.feedback_m;

    document.getElementById('score-po').innerText = `${res.score_po.toFixed(1)} / 2.0`;
    document.getElementById('feedback-po').innerText = res.feedback_po;

    const total = res.score_ai + res.score_cc + res.score_m + res.score_po;
    document.getElementById('ai-total-score').innerText = `${total.toFixed(1)} / 20.0`;
    document.getElementById('feedback-geral').innerText = res.feedback_geral;

    card.style.display = "block";
  } catch (error) {
    console.error(error);
    alert("Falha ao realizar a avaliação pela IA.");
  } finally {
    btn.innerText = "✨ Avaliar Redação com IA";
    btn.disabled = false;
  }
}
