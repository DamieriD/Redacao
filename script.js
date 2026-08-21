let auth = null;
let db = null;
let firebaseConfig = {};
let GROQ_API_KEY = "";

let editor, tema, titulo, rascunho;
let usuarioAtivo = null;
let modoCadastro = false;
let idRedacaoAtual = null;
let debounceTimer = null;

function inicializarFirebase() {
  try {
    if (window.APP_CONFIG) {
      firebaseConfig = window.APP_CONFIG.firebase || {};
      GROQ_API_KEY = window.APP_CONFIG.groqApiKey || "";
    }

    if (typeof firebase !== 'undefined') {
      if (firebase.apps && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();
      db = firebase.firestore();

      auth.onAuthStateChanged((user) => {
        const authScreen = document.getElementById('auth-screen');
        const appContent = document.getElementById('app-content');
        const userDisplay = document.getElementById('user-display-email');

        if (user) {
          usuarioAtivo = user;
          if (authScreen) authScreen.style.display = 'none';
          if (appContent) appContent.style.display = 'flex';
          if (userDisplay) userDisplay.innerText = user.email;
          carregarHistoricoNuvem();
        } else {
          usuarioAtivo = null;
          if (authScreen) authScreen.style.display = 'flex';
          if (appContent) appContent.style.display = 'none';
        }
      });
    }
  } catch (err) {
    console.error("Erro ao inicializar Firebase:", err);
  }
}

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
  if (!auth) {
    alert("Erro: O serviço de autenticação não foi inicializado.");
    return;
  }

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
  if (!auth) {
    alert("Erro: O serviço de autenticação não foi inicializado.");
    return;
  }
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
  if (auth) auth.signOut();
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

function salvarProgresso() {
  if (!usuarioAtivo || !db) return;

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
        if (statusEl) statusEl.innerText = '💾 Rascunho salvo';
      })
      .catch((error) => {
        console.error("Erro ao salvar:", error);
        if (statusEl) statusEl.innerText = '✕ Erro ao salvar';
      });
  }, 400);
}

function carregarHistoricoNuvem() {
  if (!usuarioAtivo || !db) return;

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

        if (id === idRedacaoAtual) encontrouAtual = true;

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
        if (primeiraDoc) carregarRedacao(primeiraDoc.id);
      }
    }, (error) => {
      console.error("Erro ao carregar histórico:", error);
    });
}

function carregarRedacao(id) {
  if (!usuarioAtivo || !id || !db) return;

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
  if (e) e.stopPropagation();
  if (!usuarioAtivo || !db) return;

  db.collection('usuarios')
    .doc(usuarioAtivo.uid)
    .collection('redacoes')
    .doc(id)
    .delete()
    .then(() => {
      if (id === idRedacaoAtual) idRedacaoAtual = null;
    })
    .catch(err => console.error("Erro ao deletar:", err));
}

function aoDigitarNoEditor() {
  atualizarContadores();
  salvarProgresso();
}

function execCmd(comando, valor = null) {
  if (!editor) return;
  editor.focus();
  document.execCommand(comando, false, valor);
  aoDigitarNoEditor();
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

function exportarDocumento() {
  if (!editor) return;
  const formato = document.getElementById('export-format')?.value || 'txt';
  const tituloTexto = (titulo && titulo.value.trim()) ? titulo.value.trim() : 'Minha_Redacao';
  const conteudoTexto = editor.innerText || '';
  const paperElement = document.getElementById('paper-to-print');

  if (formato === 'pdf' && typeof html2pdf !== 'undefined') {
    const opt = {
      margin: 10,
      filename: `${tituloTexto}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(paperElement).save();
    return;
  }

  if ((formato === 'png' || formato === 'jpg') && typeof html2canvas !== 'undefined') {
    html2canvas(paperElement).then(canvas => {
      const link = document.createElement('a');
      link.download = `${tituloTexto}.${formato}`;
      link.href = canvas.toDataURL(`image/${formato === 'jpg' ? 'jpeg' : 'png'}`);
      link.click();
    });
    return;
  }

  let blob, extensao;
  if (formato === 'doc') {
    const content = `<html><head><meta charset="utf-8"></head><body><h2>${tituloTexto}</h2><div>${editor.innerHTML}</div></body></html>`;
    blob = new Blob([content], { type: 'application/msword' });
    extensao = '.doc';
  } else {
    blob = new Blob([`${tituloTexto}\n\n${conteudoTexto}`], { type: 'text/plain;charset=utf-8' });
    extensao = '.txt';
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${tituloTexto}${extensao}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function handleTabIndent(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.target === editor || editor.contains(e.target)) {
      document.execCommand('insertHTML', false, '&#09;');
      aoDigitarNoEditor();
    } else if (e.target === rascunho) {
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

let spellcheckAtivo = true;
function toggleSpellcheck() {
  spellcheckAtivo = !spellcheckAtivo;
  const btn = document.getElementById('spellcheck-btn');
  const campos = [editor, tema, titulo, rascunho];

  campos.forEach(campo => {
    if (campo) campo.setAttribute('spellcheck', spellcheckAtivo ? 'true' : 'false');
  });

  if (btn) btn.innerText = spellcheckAtivo ? '✓ Corretor: ON' : '✗ Corretor: OFF';
}

async function avaliarRedacaoComIA() {
  const temaTexto = tema ? tema.innerText.trim() : '';
  const tituloTexto = titulo ? titulo.value.trim() : '';
  const texto = editor ? editor.innerText.trim() : '';
  const card = document.getElementById('ai-evaluation-card');
  const btn = document.getElementById('ai-eval-btn');

  if (!texto) {
    alert("Escreva sua redação antes de solicitar a avaliação.");
    return;
  }

  if (btn) {
    btn.innerText = "⏳ Avaliando...";
    btn.disabled = true;
  }

  const prompt = `Você é um corretor profissional de redação. Preciso que você faça uma correção detalhada do meu texto, atribuindo uma nota exata e justificando cada ponto de acordo com as seguintes 4 competências:
  
Argumentação e Informatividade (AI) [0 a 8 pontos]: Avalie a originalidade, a relevância, a correção e a autoria dos meus argumentos. O texto traz repertório suficiente e bem aplicado ao tema?
Coerência e Coesão (CC) [0 a 8 pontos]: Veja se a estrutura dos parágrafos está bem organizada, se há progressão clara das ideias sem contradições e se usei os conectivos de forma correta e variada.
Morfossintaxe (M) [0 a 2 pontos]: Analise a estrutura das frases, a concordância verbal e nominal, a regência, os tempos verbais e a colocação pronominal.
Pontuação, Acentuação e Ortografia (PO) [0 a 2 pontos]: Aponte qualquer desvio gramatical, erro de acentuação, ortografia ou uso incorreto da pontuação (vírgulas, pontos, etc.).

Por favor, aponte os erros diretamente no texto, explique como posso melhorar cada trecho e dê a nota final detalhada por competência. 
As notas de cada competência podem ser fracionadas (ex.: 6,5 / 1,25). A soma total varia de 0 a 20 pontos.


Tema: ${temaTexto}
Título: ${tituloTexto}
Texto:
${texto}

Retorne EXCLUSIVAMENTE um JSON válido neste formato exato:
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
        model: "openai/gpt-oss-120b",
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

    const scorePoVal = res.score_po ? Number(res.score_po) : 0.0;
    document.getElementById('score-po').innerText = `${scorePoVal.toFixed(1)} / 2.0`;
    document.getElementById('feedback-po').innerText = res.feedback_po;

    const total = Number(res.score_ai) + Number(res.score_cc) + Number(res.score_m) + scorePoVal;
    document.getElementById('ai-total-score').innerHTML = `<strong>Pontuação:</strong> ${total.toFixed(1)} / 20.0`;
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

// Vinculação Segura de Eventos após o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  editor = document.getElementById('editor');
  tema = document.getElementById('tema');
  titulo = document.getElementById('titulo');
  rascunho = document.getElementById('rascunho');

  document.getElementById('auth-submit-btn')?.addEventListener('click', processarAutenticacao);
  document.getElementById('login-theme-btn')?.addEventListener('click', toggleTheme);
  document.getElementById('auth-toggle-link')?.addEventListener('click', alternarModoAutenticacao);
  document.getElementById('btn-google-auth')?.addEventListener('click', entrarComGoogle);

  aplicarTemaSalvo();
  inicializarFirebase();

  const lineNumbersContainer = document.getElementById('line-numbers');
  if (lineNumbersContainer && lineNumbersContainer.children.length === 0) {
    for (let i = 1; i <= 30; i++) {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'line-number';
      lineDiv.innerText = i;
      lineNumbersContainer.appendChild(lineDiv);
    }
  }

  if (editor) editor.addEventListener('keydown', handleTabIndent);
  if (rascunho) rascunho.addEventListener('keydown', handleTabIndent);

  const passwordInput = document.getElementById('auth-password');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') processarAutenticacao();
    });
  }
});
