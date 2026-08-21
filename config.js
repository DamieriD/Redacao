// ===================================================
// CONFIGURAÇÕES DE API E CREDENCIAIS
// ===================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBhY331nB6_AIcqZ9NCX6bBCTLfqeDydC4",
  authDomain: "redacao-damieri.firebaseapp.com",
  projectId: "redacao-damieri",
  storageBucket: "redacao-damieri.firebasestorage.app",
  messagingSenderId: "97816688466",
  appId: "1:97816688466:web:44679682c4a9d83113ac8b",
  measurementId: "G-MGBQJ5GB1X"
};

const GROQ_API_KEY = "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";

// Disponibiliza as configurações globalmente
window.APP_CONFIG = {
  firebase: FIREBASE_CONFIG,
  groqApiKey: GROQ_API_KEY
};
