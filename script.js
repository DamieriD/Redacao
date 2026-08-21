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
if (lineNumbersContainer) {
  for (let i = 1; i <= 30; i++) {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'line-number';
    lineDiv.innerText = i;
    lineNumbersContainer.appendChild(lineDiv);
  }
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

  if (msg) msg.innerText = '';

  if (modoCadastro) {
    if (title) title.innerText = 'Criar Nova Conta';
    if (btn) btn.innerText = 'Cadastrar';
    if (label) label.innerText = 'Já possui uma conta?';
    if (link) link.innerText = 'Entrar';
  } else {
    if (title) title.innerText = 'Entrar na Conta';
    if (btn) btn.innerText = 'Entrar';
    if (label) label.innerText = 'Não tem uma conta?';
    if (link) link.innerText = 'Cadastre-se';
  }
}

function processarAutenticacao() {
  const emailInput = document.getElementById('auth-email')?.value.trim();
  const passwordInput = document.getElementById('auth-password')?.value;
  const msg = document.getElementById('auth-message');

  if (!emailInput || !passwordInput) {
    if (msg) {
      msg.className = 'login-error-msg';
      msg.innerText = 'Preencha todos os campos.';
    }
    return;
  }

  if (msg) msg.innerText = 'Carregando...';

  if (modoCadastro) {
    auth.createUserWithEmailAndPassword(emailInput, passwordInput)
      .then(() => {
        if (msg) {
          msg.className = 'login-success-msg';
          msg.innerText = 'Conta criada com sucesso!';
        }
      })
      .catch((error) => {
        if (msg) {
          msg.className = 'login-error-msg';
          msg.innerText = traduzirErroFirebase(error.code);
        }
      });
  } else {
    auth.signInWithEmailAndPassword(emailInput, passwordInput)
      .then(() => {
        if (msg) msg.innerText = '';
      })
      .catch((error) => {
        if (msg) {
          msg.className = 'login-error-msg';
          msg.innerText = traduzirErroFirebase(error.code);
        }
      });
  }
}

function entrarComGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((error) => {
    const msg = document.getElementById('auth-message');
    if (msg) {
      msg.className = 'login-error-msg';
      msg.innerText = 'Erro ao entrar com o Google.';
    }
    console.error("Erro no Google Auth:", error);
  });
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

  const statusEl = document.getElementById('save-status');
  if (statusEl) statusEl.innerText = '⏳ Salvando...';

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!idRedacaoAtual) {
      idRedacaoAtual = Date.now().toString();
    }

    const dadosRedacao = {
      tema: tema ? tema.innerText : '',
      titulo: titulo ? titulo.value : '',
      conteudo: editor ? editor.innerHTML : '',
      rascunho: rascunho ? rascunho.value : '',
      atualizadoEm: Date.now()
    };

    db.collection('usuarios')
      .doc(usuarioAtivo.uid)
      .collection('redacoes')
      .doc(idRedacaoAtual)
      .set(dadosRedacao, { merge: true })
      .then(() => {
        if (statusEl) statusEl.innerText = '✓ Salvo na nuvem';
      })
      .catch((error) => {
        console.error("Erro ao salvar:", error);
        if (statusEl) statusEl.innerText = '✕ Erro ao salvar';
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
      if (!container) return;
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
        if (tema) tema.innerText = dados.tema || '';
        if (titulo) titulo.value = dados.titulo || '';
        if (editor) editor.innerHTML = dados.conteudo || '';
        if (rascunho) rascunho.value = dados.rascunho || '';
        atualizarContadores();
        
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
  if (tema) tema.innerText = '';
  if (titulo) titulo.value = '';
  if (editor) editor.innerHTML = '';
  if (rascunho) rascunho.value = '';
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

  if (btn) btn.innerText = spellcheckAtivo ? '✓ Corretor: ON' : '✗ Corretor: OFF';
}

function inserirTabulacao() {
  if (!editor) return;
  editor.focus();
  document.execCommand('insertHTML', false, '&#09;');
  aoDigitarNoEditor();
}

function alterarTamanhoFonte(tamanho) {
  if (!tamanho || !editor) return;
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
  }
}

function atualizarContadores() {
  if (!editor) return;
  const texto = editor.innerText || '';
  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const caracteres = texto.length;
  
  const wordCountEl = document.getElementById('word-count');
  const charCountEl = document.getElementById('char-count');
  
  if (wordCountEl) wordCountEl.innerText = `Palavras: ${palavras}`;
  if (charCountEl) charCountEl.innerText = `Caracteres: ${caracteres}`;
}

// ==========================================
// INTEGRAÇÃO COM GEMINI AI
// ==========================================
const GROQ_API_KEY = "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"; // Cole sua chave gsk_ aqui

async function avaliarRedacaoComIA() {
  const temaTexto = tema ? tema.innerText.trim() : '';
  const tituloTexto = titulo ? titulo.value.trim() : '';
  const texto = editor ? editor.innerText.trim() : '';
  const card = document.getElementById('ai-evaluation-card');
  const btn = document.querySelector('.ai-btn-main');

  if (!texto) {
    alert("Escreva sua redação antes de solicitar a avaliação.");
    return;
  }

  if (btn) {
    btn.innerText = "⏳ Avaliando...";
    btn.disabled = true;
  }

  const prompt = `Você é um corretor de redações profissional. Avalie o texto abaixo sob estas 4 competências:
1. Argumentação e Informatividade (AI) - Nota de 0 a 8.
2. Coerência e Coesão (CC) - Nota de 0 a 8.
3. Morfossintaxe (M) - Nota de 0 a 2.
4. Pontuação, Acentuação e Ortografia (PO) - Nota de 0 a 2.

Tema: ${temaTexto}
Título: ${tituloTexto}
Texto:
${texto}

Retorne EXCLUSIVAMENTE um JSON válido neste formato exato (sem texto antes ou depois):
{
  "score_ai": 0,
  "feedback_ai": "texto",
  "score_cc": 0,
  "feedback_cc": "texto",
  "score_m": 0,
  "feedback_m": "texto",
  "score_po": 0,
  "feedback_po": "texto",
  "feedback_geral": "texto"
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b", // Modelo gratuito super inteligente e rápido
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Erro HTTP ${response.status}`);
    }

    const res = JSON.parse(data.choices[0].message.content);

    document.getElementById('score-ai').innerText = `${Number(res.score_ai).toFixed(1)} / 8.0`;
    document.getElementById('feedback-ai').innerText = res.feedback_ai;

    document.getElementById('score-cc').innerText = `${Number(res.score_cc).toFixed(1)} / 8.0`;
    document.getElementById('feedback-cc').innerText = res.feedback_cc;

    document.getElementById('score-m').innerText = `${Number(res.score_m).toFixed(1)} / 2.0`;
    document.getElementById('feedback-m').innerText = res.feedback_m;

    document.getElementById('score-po').innerText = `${Number(res.score_po).innerText = res.score_po ? Number(res.score_po).toFixed(1) : "0.0"} / 2.0`;
    document.getElementById('feedback-po').innerText = res.feedback_po;

    const total = Number(res.score_ai) + Number(res.score_cc) + Number(res.score_m) + Number(res.score_po);
    document.getElementById('ai-total-score').innerText = `${total.toFixed(1)} / 20.0`;
    document.getElementById('feedback-geral').innerText = res.feedback_geral;

    if (card) card.style.display = "block";

  } catch (error) {
    console.error("Erro detalhado:", error);
    alert(`Erro na avaliação: ${error.message}`);
  } finally {
    if (btn) {
      btn.innerText = "✨ Avaliar Redação com IA";
      btn.disabled = false;
    }
  }
}
// Expor funções globais
window.processarAutenticacao = processarAutenticacao;
window.alternarModoAutenticacao = alternarModoAutenticacao;
window.entrarComGoogle = entrarComGoogle;
window.fazerLogout = fazerLogout;
window.avaliarRedacaoComGemini = avaliarRedacaoComGemini;

// Vincular botões da tela de autenticação
document.addEventListener('DOMContentLoaded', () => {
  const submitBtn = document.getElementById('auth-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', processarAutenticacao);
  }

  // Permite pressionar "Enter" nos campos de e-mail/senha para entrar
  const passwordInput = document.getElementById('auth-password');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') processarAutenticacao();
    });
  }
});

