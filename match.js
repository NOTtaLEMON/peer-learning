// Store users in an array (persisted in localStorage)
const users = (() => {
  try {
    const raw = localStorage.getItem('users');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Could not parse users from localStorage:', e);
    return [];
  }
})();

function saveUsers() {
  try {
    localStorage.setItem('users', JSON.stringify(users));
  } catch (e) {
    console.warn('Could not save users to localStorage:', e);
  }
}

async function addUser() {
  const name = document.getElementById("name").value;

  // collect the two strength fields and normalize to an array
  const strengthInputs = [
    document.getElementById("strength1").value,
    document.getElementById("strength2").value
  ];
  const strengths = strengthInputs.map(s => s.trim()).filter(Boolean);

  // collect the two weakness fields
  const weaknessInputs = [
    document.getElementById("weakness1").value,
    document.getElementById("weakness2").value
  ];
  const weaknesses = weaknessInputs.map(s => s.trim()).filter(Boolean);

  const mode = document.getElementById('mode').value;
  const availability = document.getElementById('availability').value;
  const primaryGoal = document.getElementById('primaryGoal').value;
  const preferredFrequency = document.getElementById("preferredFrequency").value;
  const partnerPreference = document.getElementById("partnerPreference").value;
  const sessionLength = document.getElementById("sessionLength").value;
  const timeZone = document.getElementById("timeZone").value.trim();
  const studyPersonality = document.getElementById("studyPersonality").value;

  // prefer an explicit username (currentUser) for identity; we'll prompt if none exists
  let username = localStorage.getItem('currentUser') || '';
  if (!username) username = name && name.trim() ? name.trim() : '';

  if (!username) {
    try {
      const picked = window.prompt('Choose a username to identify yourself (no spaces recommended):', '');
      if (picked && picked.trim()) {
        username = picked.trim();
        localStorage.setItem('currentUser', username);
        console.debug('addUser: username chosen via prompt', username);
      }
    } catch (e) { console.warn('Prompt for username was blocked or failed', e); }
  }

  const user = {
    name: username || name,
    strengths,
    weaknesses,
    preferredMode: mode,
    availability,
    primaryGoal,
    preferredFrequency,
    partnerPreference,
    sessionLength,
    timeZone,
    studyPersonality,
    addedBy: localStorage.getItem('currentUser') || username || null
  };
  users.push(user);
  saveUsers();
  // push to Firebase Realtime Database if helper is available
  if (window.firebaseSaveUser) {
    window.firebaseSaveUser(user).then(key => {
      if (key) console.log('Saved user to Firebase with key', key);
    }).catch(e => console.warn('Firebase save user error', e));
  }
  // Notify and clear form inputs
  alert("User added: " + name + " (Availability: " + availability + ")");

  document.getElementById("name").value = "";
  document.getElementById("strength1").value = "";
  document.getElementById("strength2").value = "";
  document.getElementById("weakness1").value = "";
  document.getElementById("weakness2").value = "";
  document.getElementById('mode').selectedIndex = 0;
  document.getElementById('availability').selectedIndex = 0;
  document.getElementById('primaryGoal').selectedIndex = 0;
  document.getElementById('preferredFrequency').selectedIndex = 0;
  document.getElementById('partnerPreference').selectedIndex = 0;
  document.getElementById('sessionLength').selectedIndex = 0;
  document.getElementById('timeZone').selectedIndex = 15;
  document.getElementById('studyPersonality').selectedIndex = 0;
  document.getElementById("name").focus();

  // Update result area with current user count
  const count = users.length;
  document.getElementById("result").innerText = `Added ${name}. Total users: ${count}`;

  // Ensure one profile per signed-in user: if a current user exists, or username provided,
  // save this form as that user's profile and render the profile view.
  let currentUser = localStorage.getItem('currentUser') || username;
  if (!currentUser && username) {
    currentUser = username;
    localStorage.setItem('currentUser', currentUser);
  }

  if (currentUser) {
    const profile = {
      name: currentUser,
      strengths,
      weaknesses,
      preferredMode: mode,
      availability,
      primaryGoal,
      preferredFrequency,
      partnerPreference,
      sessionLength,
      timeZone,
      studyPersonality
    };
    try {
      console.debug('addUser: saving profile for', currentUser, profile);
      await saveProfile(profile);
      console.debug('addUser: profile saved locally for', currentUser);
    } catch (e) {
      console.warn('Could not save profile', e);
    }
    // Replace match section with profile view and prompt to find matches
    await renderUserProfileView();
  }
}

function matchUsers(userA, userB) {
  // Configurable weights - primary priority is availability, then complementary strengths,
  // then other fields. Tune as needed.
  const WEIGHTS = {
    availability: 100,     // highest priority
    compPerMatch: 30,      // each complementary strength/weakness match
    preferredMode: 8,
    primaryGoal: 6,
    preferredFrequency: 6,
    partnerPreference: 4,
    sessionLength: 4,
    timeZone: 3,
    studyPersonality: 3
  };

  // defensive normalization helpers
  const normArr = arr => (Array.isArray(arr) ? arr.map(s => (s || '').toString().toLowerCase().trim()) : []);
  const norm = s => (s || '').toString().toLowerCase().trim();

  const aStr = normArr(userA.strengths);
  const aWeak = normArr(userA.weaknesses);
  const bStr = normArr(userB.strengths);
  const bWeak = normArr(userB.weaknesses);

  let score = 0;

  // 1) Availability match (highest weight)
  if (norm(userA.availability) && norm(userA.availability) === norm(userB.availability)) {
    score += WEIGHTS.availability;
  }

  // 2) Complementary strengths/weaknesses (both directions)
  // For each weakness of A that matches a strength of B -> reward
  aWeak.forEach(w => { if (bStr.includes(w)) score += WEIGHTS.compPerMatch; });
  // For each weakness of B that matches a strength of A -> reward
  bWeak.forEach(w => { if (aStr.includes(w)) score += WEIGHTS.compPerMatch; });

  // 3) Other factors (each question has a weight)
  if (norm(userA.preferredMode) && norm(userA.preferredMode) === norm(userB.preferredMode)) score += WEIGHTS.preferredMode;
  if (norm(userA.primaryGoal) && norm(userA.primaryGoal) === norm(userB.primaryGoal)) score += WEIGHTS.primaryGoal;
  if (norm(userA.preferredFrequency) && norm(userA.preferredFrequency) === norm(userB.preferredFrequency)) score += WEIGHTS.preferredFrequency;
  if (norm(userA.partnerPreference) && norm(userA.partnerPreference) === norm(userB.partnerPreference)) score += WEIGHTS.partnerPreference;
  if (norm(userA.sessionLength) && norm(userA.sessionLength) === norm(userB.sessionLength)) score += WEIGHTS.sessionLength;
  if (norm(userA.timeZone) && norm(userA.timeZone) === norm(userB.timeZone)) score += WEIGHTS.timeZone;
  if (norm(userA.studyPersonality) && norm(userA.studyPersonality) === norm(userB.studyPersonality)) score += WEIGHTS.studyPersonality;

  return score;
}

// Return score breakdown object for UI explanations
function scoreDetails(userA, userB) {
  const WEIGHTS = {
    availability: 100,
    compPerMatch: 30,
    preferredMode: 8,
    primaryGoal: 6,
    preferredFrequency: 6,
    partnerPreference: 4,
    sessionLength: 4,
    timeZone: 3,
    studyPersonality: 3
  };

  const normArr = arr => (Array.isArray(arr) ? arr.map(s => (s || '').toString().toLowerCase().trim()) : []);
  const norm = s => (s || '').toString().toLowerCase().trim();

  const aStr = normArr(userA.strengths);
  const aWeak = normArr(userA.weaknesses);
  const bStr = normArr(userB.strengths);
  const bWeak = normArr(userB.weaknesses);

  let total = 0;
  const reasons = [];

  if (norm(userA.availability) && norm(userA.availability) === norm(userB.availability)) {
    total += WEIGHTS.availability;
    reasons.push({ reason: 'Same availability', points: WEIGHTS.availability });
  }

  // complementary matches
  let compCount = 0;
  aWeak.forEach(w => { if (bStr.includes(w)) { total += WEIGHTS.compPerMatch; compCount++; } });
  bWeak.forEach(w => { if (aStr.includes(w)) { total += WEIGHTS.compPerMatch; compCount++; } });
  if (compCount > 0) reasons.push({ reason: `${compCount} complementary strength/weakness match${compCount>1?'es':''}`, points: WEIGHTS.compPerMatch * compCount });

  if (norm(userA.preferredMode) && norm(userA.preferredMode) === norm(userB.preferredMode)) { total += WEIGHTS.preferredMode; reasons.push({ reason: 'Same preferred mode', points: WEIGHTS.preferredMode }); }
  if (norm(userA.primaryGoal) && norm(userA.primaryGoal) === norm(userB.primaryGoal)) { total += WEIGHTS.primaryGoal; reasons.push({ reason: 'Same primary goal', points: WEIGHTS.primaryGoal }); }
  if (norm(userA.preferredFrequency) && norm(userA.preferredFrequency) === norm(userB.preferredFrequency)) { total += WEIGHTS.preferredFrequency; reasons.push({ reason: 'Same preferred frequency', points: WEIGHTS.preferredFrequency }); }
  if (norm(userA.partnerPreference) && norm(userA.partnerPreference) === norm(userB.partnerPreference)) { total += WEIGHTS.partnerPreference; reasons.push({ reason: 'Same partner preference', points: WEIGHTS.partnerPreference }); }
  if (norm(userA.sessionLength) && norm(userA.sessionLength) === norm(userB.sessionLength)) { total += WEIGHTS.sessionLength; reasons.push({ reason: 'Same session length', points: WEIGHTS.sessionLength }); }
  if (norm(userA.timeZone) && norm(userA.timeZone) === norm(userB.timeZone)) { total += WEIGHTS.timeZone; reasons.push({ reason: 'Same time zone', points: WEIGHTS.timeZone }); }
  if (norm(userA.studyPersonality) && norm(userA.studyPersonality) === norm(userB.studyPersonality)) { total += WEIGHTS.studyPersonality; reasons.push({ reason: 'Similar study personality', points: WEIGHTS.studyPersonality }); }

  return { score: total, reasons };
}

function findBestMatch(targetUser, allUsers) {
  let bestScore = -1;
  let bestMatch = null;

  allUsers.forEach(otherUser => {
    if (otherUser.name !== targetUser.name) {
      const score = matchUsers(targetUser, otherUser);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = otherUser;
      }
    }
  });

  return bestMatch;
}

// Build target user object from the matching form inputs (so we can match without having
// to rely on a locally persisted user). This mirrors the shape used by `addUser()`.
function buildTargetUserFromForm() {
  const name = document.getElementById("name").value || ('visitor-' + Date.now());
  const strengthInputs = [
    document.getElementById("strength1").value,
    document.getElementById("strength2").value
  ];
  const strengths = strengthInputs.map(s => (s || '').trim()).filter(Boolean);
  const weaknessInputs = [
    document.getElementById("weakness1").value,
    document.getElementById("weakness2").value
  ];
  const weaknesses = weaknessInputs.map(s => (s || '').trim()).filter(Boolean);
  const mode = document.getElementById('mode').value;
  const availability = document.getElementById('availability').value;
  const primaryGoal = document.getElementById('primaryGoal').value;
  const preferredFrequency = document.getElementById("preferredFrequency").value;
  const partnerPreference = document.getElementById("partnerPreference").value;
  const sessionLength = document.getElementById("sessionLength").value;
  const timeZone = document.getElementById("timeZone").value.trim();
  const studyPersonality = document.getElementById("studyPersonality").value;

  return {
    name,
    strengths,
    weaknesses,
    preferredMode: mode,
    availability,
    primaryGoal,
    preferredFrequency,
    partnerPreference,
    sessionLength,
    timeZone,
    studyPersonality
  };
}

// Fetch users from Firebase Realtime Database (returns array of user objects)
async function fetchUsersFromFirebase() {
  try {
    if (!window.firebase || !firebase.database) throw new Error('Firebase not available');
    const dbRef = firebase.database().ref();
    // fetch both 'users' (matching entries) and 'profiles' (registered users)
    const [usersSnap, profilesSnap] = await Promise.all([
      dbRef.child('users').once('value'),
      dbRef.child('profiles').once('value')
    ]);

    const usersVal = usersSnap.val() || {};
    const profilesVal = profilesSnap.val() || {};

    const fromUsers = Object.keys(usersVal).map(k => Object.assign({}, usersVal[k]));
    // profiles may have different shape (username, email) — normalize to matching fields where possible
    const fromProfiles = Object.keys(profilesVal).map(k => {
      const p = profilesVal[k] || {};
      return {
        name: p.username || p.name || k,
        strengths: p.strengths || [],
        weaknesses: p.weaknesses || [],
        preferredMode: p.preferredMode || p.mode || '',
        availability: p.availability || '',
        primaryGoal: p.primaryGoal || '',
        preferredFrequency: p.preferredFrequency || '',
        partnerPreference: p.partnerPreference || '',
        sessionLength: p.sessionLength || '',
        timeZone: p.timeZone || '',
        studyPersonality: p.studyPersonality || ''
      };
    });

    // Merge and dedupe by name (profiles take precedence)
    const byName = new Map();
    fromUsers.concat(fromProfiles).forEach(u => {
      const key = (u.name || u.username || '').toString();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, u);
      else {
        // merge fields preferring existing values
        const existing = byName.get(key);
        byName.set(key, Object.assign({}, existing, u));
      }
    });

    return Array.from(byName.values());
  } catch (e) {
    console.warn('fetchUsersFromFirebase failed', e);
    return [];
  }
}

// Load a single profile by username (prefers Firebase, falls back to localStorage)
async function loadProfile(username) {
  if (!username) return null;
  const key = username.toString();
  // Try Firebase first
  try {
    if (window.firebase && firebase.database) {
      const snap = await firebase.database().ref('profiles/' + key).once('value');
      const val = snap.val();
      if (val) return normalizeProfile(val, key);
    }
  } catch (e) {
    console.warn('loadProfile firebase read failed', e);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem('profiles');
    if (raw) {
      const profiles = JSON.parse(raw || '{}');
      const p = profiles[key] || profiles[username] || null;
      if (p) return normalizeProfile(p, key);
    }
  } catch (e) { console.warn('loadProfile local read failed', e); }

  return null;
}

// Save profile to Firebase and localStorage
async function saveProfile(profile) {
  if (!profile || !profile.name) return false;
  const key = profile.name.toString();
  try {
    if (window.firebaseSaveProfile) await window.firebaseSaveProfile(Object.assign({}, profile, { username: key }));
  } catch (e) { console.warn('saveProfile firebase failed', e); }

  try {
    const raw = localStorage.getItem('profiles');
    const profiles = raw ? JSON.parse(raw) : {};
    profiles[key] = Object.assign({}, profiles[key] || {}, profile);
    localStorage.setItem('profiles', JSON.stringify(profiles));
  } catch (e) { console.warn('saveProfile local failed', e); }

  return true;
}

function normalizeProfile(p, keyFallback) {
  const p0 = p || {};
  const name = p0.username || p0.name || keyFallback || 'unknown';
  const strengths = Array.isArray(p0.strengths) ? p0.strengths : (typeof p0.strengths === 'string' ? p0.strengths.split(',').map(s=>s.trim()).filter(Boolean) : []);
  const weaknesses = Array.isArray(p0.weaknesses) ? p0.weaknesses : (typeof p0.weaknesses === 'string' ? p0.weaknesses.split(',').map(s=>s.trim()).filter(Boolean) : []);
  return {
    name,
    strengths,
    weaknesses,
    preferredMode: p0.preferredMode || p0.mode || '',
    availability: p0.availability || '',
    primaryGoal: p0.primaryGoal || '',
    preferredFrequency: p0.preferredFrequency || '',
    partnerPreference: p0.partnerPreference || '',
    sessionLength: p0.sessionLength || '',
    timeZone: p0.timeZone || '',
    studyPersonality: p0.studyPersonality || ''
  };
}

// Render the current signed-in user's profile into the #match-section as view/edit UI
async function renderUserProfileView() {
  const current = localStorage.getItem('currentUser');
  const section = document.getElementById('match-section');
  if (!section) return;

  let profile = null;
  if (current) profile = await loadProfile(current);
  // If no profile, still show editable empty profile for the user
  if (!profile) profile = { name: current || '', strengths: [], weaknesses: [], preferredMode: '', availability: '', primaryGoal:'', preferredFrequency:'', partnerPreference:'', sessionLength:'', timeZone:'', studyPersonality:'' };

  // If loaded profile looks empty (some fields missing), try sensible fallbacks:
  // 1) check localStorage 'profiles' entries for a matching key
  // 2) check the in-memory `users` array for an entry added by this user
  try {
    const looksEmpty = (!profile.availability && (!profile.strengths || !profile.strengths.length) && (!profile.weaknesses || !profile.weaknesses.length));
    if (looksEmpty && current) {
      console.debug('renderUserProfileView: profile appears empty, trying fallback sources for', current);
      // localStorage profiles
      const raw = localStorage.getItem('profiles');
      if (raw) {
        try {
          const profiles = JSON.parse(raw || '{}');
          // look for profile keyed by current or with name/username matching
          for (const k of Object.keys(profiles)) {
            const p = profiles[k] || {};
            if ((p.username && p.username === current) || (p.name && p.name === current) || k === current) {
              profile = normalizeProfile(p, k);
              console.debug('renderUserProfileView: found fallback profile in localStorage for', current, profile);
              break;
            }
          }
        } catch (e) { console.warn('renderUserProfileView: could not parse local profiles', e); }
      }

      // if still empty, check the `users` array for last entry added by this user
      if ((!profile.availability || profile.availability === '') && Array.isArray(users) && users.length) {
        // find most recent user entry where addedBy === current or name === current
        for (let i = users.length - 1; i >= 0; i--) {
          const u = users[i] || {};
          if (u.addedBy === current || u.name === current) {
            // construct a profile-like object
            profile = normalizeProfile({ name: u.name || current, strengths: u.strengths || [], weaknesses: u.weaknesses || [], preferredMode: u.preferredMode || u.mode || '', availability: u.availability || '', primaryGoal: u.primaryGoal || '', preferredFrequency: u.preferredFrequency || '', partnerPreference: u.partnerPreference || '', sessionLength: u.sessionLength || '', timeZone: u.timeZone || '', studyPersonality: u.studyPersonality || '' }, u.name || current);
            console.debug('renderUserProfileView: found fallback profile from users array for', current, profile);
            break;
          }
        }
      }
    }
  } catch (e) { console.warn('renderUserProfileView fallback attempt failed', e); }

  // build view HTML
  section.innerHTML = `
    <h2>Your Profile</h2>
    <div id="profile-view" style="display:flex;flex-direction:column;gap:8px">
      <div><strong>Name:</strong> <span id="pv-name">${escapeHtml(profile.name)}</span></div>
      <div><strong>Availability:</strong> <span id="pv-availability">${escapeHtml(profile.availability || '—')}</span></div>
      <div><strong>Mode:</strong> <span id="pv-mode">${escapeHtml(profile.preferredMode || '—')}</span></div>
      <div><strong>Strengths:</strong> <span id="pv-strengths">${escapeHtml((profile.strengths || []).join(', ') || '—')}</span></div>
      <div><strong>Weaknesses:</strong> <span id="pv-weaknesses">${escapeHtml((profile.weaknesses || []).join(', ') || '—')}</span></div>
      <div style="margin-top:8px">
        <button id="edit-profile-btn">Edit Profile</button>
        <button id="find-match-btn" style="margin-left:8px">Find Match</button>
      </div>
    </div>
  `;

  // wire buttons
  document.getElementById('find-match-btn').onclick = async () => { console.debug('Find Match clicked for', profile.name); await findMatch(); };
  document.getElementById('edit-profile-btn').onclick = () => renderProfileEditor(profile);
}

function renderProfileEditor(profile) {
  const section = document.getElementById('match-section');
  if (!section) return;
  section.innerHTML = `
    <h2>Edit Your Profile</h2>
    <div id="profile-edit" style="display:flex;flex-direction:column;gap:8px;max-width:680px">
      <label>Name (cannot change): <input id="pe-name" type="text" value="${escapeHtml(profile.name)}" disabled/></label>
      <label>Availability: <input id="pe-availability" type="text" value="${escapeHtml(profile.availability)}"/></label>
      <label>Preferred Mode: <input id="pe-mode" type="text" value="${escapeHtml(profile.preferredMode)}"/></label>
      <label>Strengths (comma separated): <input id="pe-strengths" type="text" value="${escapeHtml((profile.strengths||[]).join(', '))}"/></label>
      <label>Weaknesses (comma separated): <input id="pe-weaknesses" type="text" value="${escapeHtml((profile.weaknesses||[]).join(', '))}"/></label>
      <label>Primary Goal: <input id="pe-primaryGoal" type="text" value="${escapeHtml(profile.primaryGoal)}"/></label>
      <label>Preferred Frequency: <input id="pe-preferredFrequency" type="text" value="${escapeHtml(profile.preferredFrequency)}"/></label>
      <label>Partner Preference: <input id="pe-partnerPreference" type="text" value="${escapeHtml(profile.partnerPreference)}"/></label>
      <label>Session Length: <input id="pe-sessionLength" type="text" value="${escapeHtml(profile.sessionLength)}"/></label>
      <label>Time Zone: <input id="pe-timeZone" type="text" value="${escapeHtml(profile.timeZone)}"/></label>
      <label>Study Personality: <input id="pe-studyPersonality" type="text" value="${escapeHtml(profile.studyPersonality)}"/></label>
      <div style="margin-top:8px">
        <button id="save-profile-btn-inline">Save Profile</button>
        <button id="cancel-profile-edit" style="margin-left:8px">Cancel</button>
      </div>
    </div>
  `;

  document.getElementById('cancel-profile-edit').onclick = () => renderUserProfileView();
  document.getElementById('save-profile-btn-inline').onclick = async () => {
    const newProfile = {
      name: document.getElementById('pe-name').value.trim() || profile.name,
      availability: document.getElementById('pe-availability').value.trim(),
      preferredMode: document.getElementById('pe-mode').value.trim(),
      strengths: document.getElementById('pe-strengths').value.split(',').map(s=>s.trim()).filter(Boolean),
      weaknesses: document.getElementById('pe-weaknesses').value.split(',').map(s=>s.trim()).filter(Boolean),
      primaryGoal: document.getElementById('pe-primaryGoal').value.trim(),
      preferredFrequency: document.getElementById('pe-preferredFrequency').value.trim(),
      partnerPreference: document.getElementById('pe-partnerPreference').value.trim(),
      sessionLength: document.getElementById('pe-sessionLength').value.trim(),
      timeZone: document.getElementById('pe-timeZone').value.trim(),
      studyPersonality: document.getElementById('pe-studyPersonality').value.trim()
    };
    await saveProfile(newProfile);
    alert('Profile saved.');
    await renderUserProfileView();
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
}

// Find a match using remote Firebase users when available; fall back to local `users` array.
async function findMatch() {
  // Build target from the signed-in user's profile when available
  const current = localStorage.getItem('currentUser');
  let targetUser = null;
  if (current) {
    try {
      targetUser = await loadProfile(current);
    } catch (e) {
      console.warn('Error loading profile for current user', e);
      targetUser = null;
    }
  }
  // fallback to form-built target (guest / profile missing)
  if (!targetUser) targetUser = buildTargetUserFromForm();
  // If there's a signed-in username, prefer it as the canonical display name (avoid visitor-####)
  if (current && targetUser) {
    targetUser.name = current;
  }
  const resultEl = document.getElementById('result');

  let allCandidates = [];
  // Prefer Firebase as source of truth
  if (window.firebase && firebase.database) {
    const remote = await fetchUsersFromFirebase();
    if (remote && remote.length) allCandidates = remote;
  }

  // Fallback to local storage users if firebase returned nothing
  if (!allCandidates.length) {
    allCandidates = users.slice();
  }

  // Remove target-like entries with identical name if present
  allCandidates = allCandidates.filter(u => (u.name || u.username || '') !== (targetUser.name || ''));

  if (!allCandidates.length) {
    resultEl.innerText = 'No other users available to match against.';
    return;
  }

  // compute all matches and sort
  const allMatches = [];
  allCandidates.forEach(otherUser => {
    const details = scoreDetails(targetUser, otherUser);
    allMatches.push({ user: otherUser, score: details.score, reasons: details.reasons });
  });
  allMatches.sort((a, b) => b.score - a.score);
  window._currentMatches = allMatches;
  window._currentMatchIndex = 0;
  // remember last target for navigation helpers
  window._lastTargetName = targetUser.name;
  // Select top 3 matches
  const topMatches = allMatches.slice(0, 3).filter(m => m.score > 0);
  if (!topMatches.length) {
    resultEl.innerText = 'No good match found yet.';
    return;
  }

  // Render a nicer UI: cards for each top match with reasons and info
  resultEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px"><h3>Top matches for ${targetUser.name}</h3></div>`;
  const container = resultEl.querySelector('div');
  topMatches.forEach((m, idx) => {
    const card = document.createElement('div');
    card.style.border = '1px solid rgba(0,0,0,0.08)';
    card.style.padding = '12px';
    card.style.borderRadius = '8px';
    card.style.background = idx % 2 === 0 ? 'linear-gradient(90deg, rgba(255,255,255,1), rgba(245,250,255,1))' : '#fff';
    card.style.boxShadow = '0 2px 8px rgba(16,24,40,0.04)';

    const title = document.createElement('div');
    title.innerHTML = `<strong style="font-size:16px">${idx+1}. ${m.user.name || m.user.username || '(unknown)'}</strong> <span style="color:#666;margin-left:8px">Score: ${m.score}</span>`;
    card.appendChild(title);

    const info = document.createElement('div');
    info.style.marginTop = '8px';
    const strengths = Array.isArray(m.user.strengths) ? m.user.strengths.join(', ') : (m.user.strengths || '—');
    const weaknesses = Array.isArray(m.user.weaknesses) ? m.user.weaknesses.join(', ') : (m.user.weaknesses || '—');
    info.innerHTML = `<div style="color:#333"><em>Availability:</em> ${m.user.availability || '—'} &nbsp; • &nbsp; <em>Mode:</em> ${m.user.preferredMode || '—'}</div>
                      <div style="margin-top:6px"><strong>Strengths:</strong> ${strengths}</div>
                      <div style="margin-top:4px"><strong>Weaknesses:</strong> ${weaknesses}</div>`;
    card.appendChild(info);

    if (m.reasons && m.reasons.length) {
      const reasonsEl = document.createElement('ul');
      reasonsEl.style.marginTop = '8px';
      reasonsEl.style.paddingLeft = '18px';
      m.reasons.forEach(r => {
        const li = document.createElement('li');
        li.style.marginBottom = '4px';
        li.innerText = `${r.reason} (+${r.points})`;
        reasonsEl.appendChild(li);
      });
      card.appendChild(reasonsEl);
    }

    const actions = document.createElement('div');
    actions.style.marginTop = '10px';
    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start Session';
    startBtn.onclick = () => startSession(m.user);
    startBtn.style.marginRight = '8px';
    const viewProfile = document.createElement('button');
    viewProfile.textContent = 'View Details';
    viewProfile.onclick = () => alert(`Profile for ${m.user.name || m.user.username || '(unknown)'}:\n\nStrengths: ${strengths}\nWeaknesses: ${weaknesses}\nAvailability: ${m.user.availability || '—'}`);
    actions.appendChild(startBtn);
    actions.appendChild(viewProfile);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

function showNextMatch() {
  const allMatches = window._currentMatches || [];
  if (!allMatches.length) return;
  window._currentMatchIndex = (window._currentMatchIndex + 1) % allMatches.length;
  const currentMatch = allMatches[window._currentMatchIndex].user;
  const resultEl = document.getElementById('result');
  const targetName = window._lastTargetName || ((users && users.length) ? users[users.length - 1].name : 'you');
  resultEl.innerHTML = `Best match for ${targetName}: <strong>${currentMatch.name || currentMatch.username || '(unknown)'}</strong> (Match ${window._currentMatchIndex + 1}/${allMatches.length})`;

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Session';
  startBtn.onclick = () => startSession(currentMatch);
  startBtn.style.marginLeft = '12px';

  const findNew = document.createElement('button');
  findNew.textContent = 'Find a different match';
  findNew.onclick = showNextMatch;
  findNew.style.marginLeft = '8px';

  resultEl.appendChild(startBtn);
  resultEl.appendChild(findNew);
}

function startSession(match) {
  // create a simple dummy Meet link and show session info
  const meetCode = Math.random().toString(36).slice(2,9);
  const meetLink = `https://meet.google.com/${meetCode}`;
  const info = document.getElementById('session-info');
  info.innerHTML = `<p>Session with <strong>${match.name}</strong></p>
    <p>Preferred mode: ${match.preferredMode || '—'}</p>
    <p><a href="${meetLink}" target="_blank">Join Meet</a></p>
    <div style="margin-top:10px"><button onclick="endSession('${match.name}')">End Session / Give Feedback</button>
    <button style="margin-left:8px" onclick="quitLinking()">Quit linking / Find new buddy</button></div>`;

  // store current session to localStorage
  localStorage.setItem('currentSession', JSON.stringify({ with: match.name, startedAt: Date.now() }));
  // ensure session section visible
  show('session-section');
}

function quitLinking() {
  // allow user to end linking without feedback -> clear session and prompt feedback optionally
  localStorage.removeItem('currentSession');
  // show feedback survey anyway as requested
  endSession(null);
}

function endSession(peerName) {
  // mark last session peer and show feedback section
  if (peerName) localStorage.setItem('lastSessionPeer', peerName);
  else localStorage.removeItem('lastSessionPeer');
  // hide session info
  const info = document.getElementById('session-info');
  info.innerHTML = '<p>Session ended. Please provide feedback below.</p>';
  // show feedback section
  show('postquiz-section');
  // scroll to feedback
  document.getElementById('postquiz-section').scrollIntoView({ behavior: 'smooth' });
}

function submitFeedback(e) {
  if (e) e.preventDefault();
  const rating = document.getElementById('peer-rating').value;
  const comments = document.getElementById('peer-feedback').value.trim();
  const peer = localStorage.getItem('lastSessionPeer') || 'unknown';
  const givenBy = localStorage.getItem('currentUser') || 'unknown';
  const fb = { peer, givenBy, rating: Number(rating), comments, at: Date.now() };
  const raw = localStorage.getItem('feedbacks');
  const arr = raw ? JSON.parse(raw) : [];
  arr.push(fb);
  localStorage.setItem('feedbacks', JSON.stringify(arr));
  // also send feedback to Firebase if available
  if (window.firebaseSaveFeedback) {
    window.firebaseSaveFeedback(fb).then(k => { if (k) console.log('Feedback saved to Firebase', k); });
  }
  alert('Thanks — feedback saved locally.');
  // clear feedback form and hide it
  document.getElementById('peer-rating').value = '';
  document.getElementById('peer-feedback').value = '';
  hide('postquiz-section');
}

// Small helpers to show/hide sections
function show(id) { const el = document.getElementById(id); if(el) el.classList.remove('hidden'); }
function hide(id) { const el = document.getElementById(id); if(el) el.classList.add('hidden'); }

// --- Simple auth / flow (dummy) ---
function login() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { alert('Enter email and password to login'); return; }

  // Use Firebase Auth if available
  if (window.firebaseAuthLogin) {
    window.firebaseAuthLogin(email, password).then(cred => {
      const user = cred.user;
      const display = (user.email) || user.uid;
      localStorage.setItem('currentUser', display);
      showMainForUser(display);
    }).catch(err => {
      console.warn('Login failed', err);
      alert('Login failed: ' + (err.message || err));
    });
    return;
  }

  // Fallback: local demo
  localStorage.setItem('currentUser', email);
  showMainForUser(email);
}

function signup() {
  // Dummy signup — simply store the username locally and proceed
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { alert('Enter email and password to sign up'); return; }

  if (window.firebaseAuthSignup) {
    // create account with Firebase Auth, then reveal username step
    window.firebaseAuthSignup(email, password).then(cred => {
      // store temp values while user sets display name
      window._pendingSignup = { uid: cred.user.uid, email: cred.user.email };
      // reveal username row and swap buttons
      const row = document.getElementById('auth-username-row');
      if (row) row.classList.remove('hidden');
      const setBtn = document.getElementById('set-username-btn');
      const signupBtn = document.getElementById('signup-btn');
      if (setBtn) setBtn.classList.remove('hidden');
      if (signupBtn) signupBtn.classList.add('hidden');
      alert('Account created. Please choose a display name to finish.');
    }).catch(err => {
      console.warn('Signup failed', err);
      alert('Signup failed: ' + (err.message || err));
    });
    return;
  }

  // Fallback: local demo signup (store profile by email)
  const profilesRaw = localStorage.getItem('profiles');
  const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
  profiles[email] = { email };
  localStorage.setItem('profiles', JSON.stringify(profiles));
  // reveal username row
  window._pendingSignup = { uid: email, email };
  const row = document.getElementById('auth-username-row'); if (row) row.classList.remove('hidden');
  const setBtn = document.getElementById('set-username-btn'); if (setBtn) setBtn.classList.remove('hidden');
  const signupBtn = document.getElementById('signup-btn'); if (signupBtn) signupBtn.classList.add('hidden');
}

function completeSignup() {
  const uname = document.getElementById('auth-username').value.trim();
  if (!uname) { alert('Enter a display name'); return; }
  const pending = window._pendingSignup || {};
  const uid = pending.uid || pending.email || ('local-' + Date.now());
  const email = pending.email || '';
  const profile = { uid, username: uname, email };

  // Save profile to Firebase DB if available
  if (window.firebaseSaveProfile) {
    window.firebaseSaveProfile(profile).then(k => { if (k) console.log('Profile saved to Firebase', k); });
  }

  // also persist locally for demo
  const profilesRaw = localStorage.getItem('profiles');
  const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
  profiles[uid] = profile;
  localStorage.setItem('profiles', JSON.stringify(profiles));

  // finish signup flow
  localStorage.setItem('currentUser', uname);
  showMainForUser(uname);
  // hide username UI
  const row = document.getElementById('auth-username-row'); if (row) row.classList.add('hidden');
  const setBtn = document.getElementById('set-username-btn'); if (setBtn) setBtn.classList.add('hidden');
  const signupBtn = document.getElementById('signup-btn'); if (signupBtn) signupBtn.classList.remove('hidden');
  window._pendingSignup = null;
}


function logout() {
  // sign out from Firebase if available
  if (window.firebaseAuthSignOut) {
    window.firebaseAuthSignOut().then(() => {
      localStorage.removeItem('currentUser');
      show('auth-screen');
      hide('logout-btn');
      document.getElementById('user-welcome').innerText = 'Not signed in';
      document.querySelector('main').classList.add('hidden');
    }).catch(() => {
      // fallback clear
      localStorage.removeItem('currentUser');
      show('auth-screen');
      hide('logout-btn');
      document.getElementById('user-welcome').innerText = 'Not signed in';
      document.querySelector('main').classList.add('hidden');
    });
    return;
  }

  localStorage.removeItem('currentUser');
  show('auth-screen');
  hide('logout-btn');
  document.getElementById('user-welcome').innerText = 'Not signed in';
  document.querySelector('main').classList.add('hidden');
}

function showMainForUser(username) {
  hide('auth-screen');
  document.querySelector('main').classList.remove('hidden');
  document.getElementById('user-welcome').innerText = `Signed in: ${username}`;
  document.getElementById('logout-btn').classList.remove('hidden');
}

// initialize flow on load
window.addEventListener('load', () => {
  const current = localStorage.getItem('currentUser');
  if (current) showMainForUser(current);
  else {
    // show auth screen
    show('auth-screen');
    document.querySelector('main').classList.add('hidden');
  }

  // hide post-session feedback area until a session ends
  hide('postquiz-section');

  // wire profile save button if present
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) saveBtn.onclick = saveBasicProfileForm;

  // wire postquiz submit
  const postForm = document.getElementById('postquiz-form');
  if (postForm) postForm.onsubmit = submitFeedback;
});

function saveBasicProfileForm() {
  const uname = document.getElementById('profile-username').value.trim();
  const pwd = document.getElementById('profile-password').value;
  if (!uname || !pwd) { document.getElementById('profile-status').innerText = 'Provide username & password'; return; }
  const profilesRaw = localStorage.getItem('profiles');
  const profiles = profilesRaw ? JSON.parse(profilesRaw) : {};
  profiles[uname] = { username: uname };
  localStorage.setItem('profiles', JSON.stringify(profiles));
  document.getElementById('profile-status').innerText = 'Profile saved locally (demo)';
  if (window.firebaseSaveProfile) {
    window.firebaseSaveProfile({ username: uname }).then(k => { if (k) console.log('Profile saved to Firebase', k); });
  }
}
