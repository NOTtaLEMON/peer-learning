// Gemini (Generative AI) initialization
// Provide your key by setting `window.GEMINI_API_KEY = '...'` before this script runs
// or put it in localStorage under `GEMINI_API_KEY` for quick local testing.
// IMPORTANT: For any real deployment, do NOT keep secrets client-side — proxy via a backend.
// Integrate provided API key as a fallback. For production, move this key to a backend.
const _geminiKey = window.GEMINI_API_KEY || localStorage.getItem('AIzaSyBt7OipaXBjHMWWszC9_VzBxaCLvcPRjwk') || 'AIzaSyBt7OipaXBjHMWWszC9_VzBxaCLvcPRjwk';
let genAI = null;
if (_geminiKey) {
  try {
    genAI = new GoogleGenerativeAI(_geminiKey);
  } catch (e) {
    console.warn('Failed to initialize Gemini client', e);
    genAI = null;
  }
} else {
  console.warn('Gemini API key not found; AI features disabled.');
}

// Helper to show loading state (safe: checks element existence)
function setLoading(elementId, isLoading) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (isLoading) {
    el.classList.add('loading');
    el.dataset.oldText = el.innerText || '';
    el.innerText = 'Generating...';
  }
}

// Helper to clear loading state
function clearLoading(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.remove('loading');
  if (el.dataset.oldText !== undefined) {
    el.innerText = el.dataset.oldText;
    delete el.dataset.oldText;
  }
}

// --- MATCH EXPLANATION (Before Session) ---
async function generateMatchExplanation(userA, userB) {
  if (!genAI) throw new Error('Gemini client not initialized');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const aStr = Array.isArray(userA.strengths) ? userA.strengths.join(', ') : (userA.strengths || '');
  const aWeak = Array.isArray(userA.weaknesses) ? userA.weaknesses.join(', ') : (userA.weaknesses || '');
  const bStr = Array.isArray(userB.strengths) ? userB.strengths.join(', ') : (userB.strengths || '');
  const bWeak = Array.isArray(userB.weaknesses) ? userB.weaknesses.join(', ') : (userB.weaknesses || '');

  const prompt = `Two students were matched based on complementary strengths and weaknesses.\n\n` +
    `Student A — Strengths: ${aStr} | Weaknesses: ${aWeak}\n` +
    `Student B — Strengths: ${bStr} | Weaknesses: ${bWeak}\n\n` +
    `In two short sentences, explain why these two students would complement each other as study partners.`;

  const response = await model.generateContent(prompt);
  // Some SDKs return different shapes; attempt to extract readable text
  if (response && response.response) {
    if (typeof response.response.text === 'function') return response.response.text();
    if (response.response.output_text) return response.response.output_text;
  }
  if (response && typeof response === 'string') return response;
  return JSON.stringify(response);
}

async function handleMatchExplanation() {
  const container = document.getElementById('match-explanation');
  try {
    let users = [];
    try {
      users = JSON.parse(localStorage.getItem('users')) || [];
    } catch (e) {
      console.warn('Failed reading users from localStorage', e);
      users = [];
    }

    const demoA = { strengths: ['Math'], weaknesses: ['Physics'] };
    const demoB = { strengths: ['Physics'], weaknesses: ['Math'] };

    const userA = users.length >= 2 ? users[users.length - 2] : demoA;
    const userB = users.length >= 1 ? users[users.length - 1] : demoB;

    if (!genAI) {
      container.innerText = 'AI unavailable — set GEMINI_API_KEY to enable match explanations.';
      return;
    }

    setLoading('match-explanation', true);
    const text = await generateMatchExplanation(userA, userB);
    clearLoading('match-explanation');
    container.innerText = text;
  } catch (err) {
    clearLoading('match-explanation');
    console.error(err);
    container.innerText = 'Error generating match explanation: ' + (err.message || String(err));
  }
}

// --- NOTES (After Session) ---
async function generateNotes(topic) {
  if (!genAI) throw new Error('Gemini client not initialized');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Explain the topic "${topic}" in simple, beginner-friendly bullet point notes. Keep each point short.`;

  const response = await model.generateContent(prompt);
  if (response && response.response) {
    if (typeof response.response.text === 'function') return response.response.text();
    if (response.response.output_text) return response.response.output_text;
  }
  return JSON.stringify(response);
}

async function handleNotes() {
  const topicEl = document.getElementById('topicInput');
  const box = document.getElementById('notes-box');
  const topic = topicEl ? topicEl.value.trim() : '';
  if (!topic) {
    alert('Enter a topic first');
    return;
  }
  if (!genAI) {
    box.innerText = 'AI unavailable — set GEMINI_API_KEY to enable notes generation.';
    return;
  }
  setLoading('notes-box', true);
  try {
    const text = await generateNotes(topic);
    clearLoading('notes-box');
    box.innerText = text;
  } catch (err) {
    clearLoading('notes-box');
    box.innerText = 'Error generating notes: ' + (err.message || String(err));
    console.error(err);
  }
}

// --- FLASHCARDS (After Session) ---
async function generateFlashcards(topic) {
  if (!genAI) throw new Error('Gemini client not initialized');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Create 5 flashcard Q&A pairs for the topic "${topic}". Format each as:\nQ: [question]\nA: [answer]\nSeparate pairs with a blank line.`;
  const response = await model.generateContent(prompt);
  if (response && response.response) {
    if (typeof response.response.text === 'function') return response.response.text();
    if (response.response.output_text) return response.response.output_text;
  }
  return JSON.stringify(response);
}

async function handleFlashcards() {
  const topic = (document.getElementById('topicInput') || {}).value || '';
  const box = document.getElementById('flashcards-box');
  if (!topic.trim()) {
    alert('Enter a topic first');
    return;
  }
  if (!genAI) {
    box.innerText = 'AI unavailable — set GEMINI_API_KEY to enable flashcards.';
    return;
  }
  setLoading('flashcards-box', true);
  try {
    const text = await generateFlashcards(topic);
    clearLoading('flashcards-box');
    box.innerText = text;
  } catch (err) {
    clearLoading('flashcards-box');
    box.innerText = 'Error generating flashcards: ' + (err.message || String(err));
    console.error(err);
  }
}

// --- QUIZ (After Session) ---
async function generateQuiz(topic) {
  if (!genAI) throw new Error('Gemini client not initialized');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Create a short quiz for the topic "${topic}" with 3 questions at different difficulty levels. Format as: [EASY] Q/A, [MEDIUM] Q/A, [HARD] Q/A.`;
  const response = await model.generateContent(prompt);
  if (response && response.response) {
    if (typeof response.response.text === 'function') return response.response.text();
    if (response.response.output_text) return response.response.output_text;
  }
  return JSON.stringify(response);
}

async function handleQuiz() {
  const topic = (document.getElementById('topicInput') || {}).value || '';
  const box = document.getElementById('quiz-box');
  if (!topic.trim()) {
    alert('Enter a topic first');
    return;
  }
  if (!genAI) {
    box.innerText = 'AI unavailable — set GEMINI_API_KEY to enable quizzes.';
    return;
  }
  setLoading('quiz-box', true);
  try {
    const text = await generateQuiz(topic);
    clearLoading('quiz-box');
    box.innerText = text;
  } catch (err) {
    clearLoading('quiz-box');
    box.innerText = 'Error generating quiz: ' + (err.message || String(err));
    console.error(err);
  }
}

// --- Navigation ---
function goBackToMain() {
  window.location.href = 'index.html';
}

// Initialize auth state (keeps parity with match.js)
window.addEventListener('load', () => {
  const current = localStorage.getItem('currentUser');
  const welcome = document.getElementById('user-welcome');
  const logoutBtn = document.getElementById('logout-btn');
  if (welcome) welcome.innerText = current ? `Signed in: ${current}` : 'Not signed in';
  if (logoutBtn) {
    if (current) logoutBtn.classList.remove('hidden'); else logoutBtn.classList.add('hidden');
  }
});

function logout() {
  if (window.firebaseAuthSignOut) {
    window.firebaseAuthSignOut().then(() => {
      localStorage.removeItem('currentUser');
      window.location.href = 'index.html';
    }).catch(() => {
      localStorage.removeItem('currentUser');
      window.location.href = 'index.html';
    });
    return;
  }
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}
