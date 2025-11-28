// Firebase initialization and simple helpers (Realtime Database)
(function () {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyCL4_TNQlEaAXxwfHssGJJTjMDBaMeicFY",
      authDomain: "peerfuse.firebaseapp.com",
      databaseURL: "https://peerfuse-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "peerfuse",
      storageBucket: "peerfuse.firebasestorage.app",
      messagingSenderId: "988908506888",
      appId: "1:988908506888:web:318514adde43a5b327e6bd",
      measurementId: "G-YW68EEWEC9"
    };

    if (!window.firebase) {
      console.warn('Firebase SDK not loaded');
      return;
    }

    // Initialize Firebase app
    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.database(app);
    const auth = firebase.auth();

    // Expose simple helpers on window so existing code can call them
    window.firebaseSaveUser = async function (user) {
      try {
        const ref = db.ref('users').push();
        await ref.set(Object.assign({}, user, { createdAt: Date.now() }));
        return ref.key;
      } catch (e) {
        console.warn('firebaseSaveUser failed', e);
        return null;
      }
    };

    // Auth helpers
    window.firebaseAuthSignup = async function (email, password) {
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        return cred; // contains user with uid
      } catch (e) {
        console.warn('firebaseAuthSignup failed', e);
        throw e;
      }
    };

    window.firebaseAuthLogin = async function (email, password) {
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        return cred;
      } catch (e) {
        console.warn('firebaseAuthLogin failed', e);
        throw e;
      }
    };

    window.firebaseAuthSignOut = async function () {
      try { await auth.signOut(); return true; } catch (e) { console.warn(e); return false; }
    };

    // Save profile keyed by uid/username/email when available
    window.firebaseSaveProfile = async function (profile) {
      try {
        if (!profile) return null;
        const key = profile.uid || profile.username || profile.email;
        if (!key) return null;
        const normalized = Object.assign(
          {},
          profile,
          {
            username: profile.username || profile.uid || profile.email,
            updatedAt: Date.now()
          }
        );
        await db.ref('profiles/' + key).set(normalized);
        return key;
      } catch (e) {
        console.warn('firebaseSaveProfile failed', e);
        return null;
      }
    };

    window.firebaseSaveFeedback = async function (fb) {
      try {
        const ref = db.ref('feedbacks').push();
        await ref.set(Object.assign({}, fb, { createdAt: Date.now() }));
        return ref.key;
      } catch (e) {
        console.warn('firebaseSaveFeedback failed', e);
        return null;
      }
    };

    window.firebaseSetCurrentUser = async function (username) {
      try {
        await db.ref('sessions/current').set({ user: username, at: Date.now() });
        return true;
      } catch (e) {
        console.warn('firebaseSetCurrentUser failed', e);
        return false;
      }
    };

    console.log('Firebase initialized (demo)');
  } catch (err) {
    console.warn('Error initializing firebase-init.js', err);
  }
})();
