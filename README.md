# Recall

A Quizlet-style study app: paste terms to build sets, then drill them in Learn mode.
Stack: **Vite + React** (frontend) · **Firebase Auth + Firestore** (Google sign-in, synced data) · **Vercel** (hosting).

```
src/
  firebase.js          Firebase setup (reads .env.local)
  lib/store.js         Firestore reads/writes (users/{uid}/sets/{setId})
  lib/parse.js         Paste → cards parser
  lib/learn.js         Learn-mode rules (rounds, levels, question types)
  components/          Library, SetView, Import, Learn, MasteryBar
firestore.rules        Security rules: each user sees only their own sets
```

---

## 1. Run it locally

Install **Node.js 20+** (https://nodejs.org), then in this folder:

```bash
npm install
```

## 2. Create the Firebase project (≈10 min)

1. Go to https://console.firebase.google.com → **Add project** → name it (e.g. `recall`). Google Analytics is optional; turn it off.
2. **Add a web app**: on the project home, click the `</>` icon → nickname `recall-web` → **Register app** (skip Firebase Hosting).
   You'll see a `firebaseConfig = { apiKey: ..., ... }` block — keep this tab open.
3. **Turn on Google sign-in**: left menu **Build → Authentication → Get started → Sign-in method → Google → Enable** → choose a support email → **Save**.
4. **Create the database**: **Build → Firestore Database → Create database** →
   location **asia-northeast3 (Seoul)** → start in **production mode** → **Create**.
5. **Paste the security rules**: Firestore → **Rules** tab → replace everything with the contents of `firestore.rules` → **Publish**.

## 3. Connect the app to Firebase

```bash
cp .env.example .env.local
```

Open `.env.local` and fill each line from the `firebaseConfig` block:

| .env.local                         | firebaseConfig      |
|-----------------------------------|---------------------|
| VITE_FIREBASE_API_KEY             | apiKey              |
| VITE_FIREBASE_AUTH_DOMAIN         | authDomain          |
| VITE_FIREBASE_PROJECT_ID          | projectId           |
| VITE_FIREBASE_STORAGE_BUCKET      | storageBucket       |
| VITE_FIREBASE_MESSAGING_SENDER_ID | messagingSenderId   |
| VITE_FIREBASE_APP_ID              | appId               |

Then:

```bash
npm run dev
```

Open http://localhost:5173, sign in with Google, and make a set. 🎉
(These keys are safe to ship in a frontend — access is protected by `firestore.rules`, not by hiding the key.)

## 4. Put the code on GitHub

Create an empty repo at https://github.com/new (e.g. `recall`), then:

```bash
git init
git add .
git commit -m "Recall: first version"
git branch -M main
git remote add origin https://github.com/<your-username>/recall.git
git push -u origin main
```

`.env.local` is in `.gitignore`, so your keys are not pushed.

## 5. Deploy on Vercel

1. https://vercel.com → sign up with GitHub → **Add New… → Project** → import the `recall` repo.
2. Framework preset is detected as **Vite** automatically. Leave build settings as they are.
3. Open **Environment Variables** and add the same six `VITE_FIREBASE_…` keys and values from `.env.local`.
4. **Deploy**. You get a URL like `https://recall-xxxx.vercel.app`.

## 6. Allow your Vercel domain to sign in

Firebase blocks Google sign-in from unknown domains. In Firebase:
**Authentication → Settings → Authorized domains → Add domain** → paste `recall-xxxx.vercel.app` (no `https://`).

Done. From now on every `git push` to `main` redeploys automatically.

---

### Troubleshooting

- **"Firebase isn't configured yet"** — `.env.local` is missing or you didn't restart `npm run dev`. On Vercel: env vars missing → add them, then **Redeploy**.
- **"This domain isn't allowed yet"** — step 6.
- **"Missing or insufficient permissions"** — the rules from `firestore.rules` weren't published (step 2.5).
- **Custom domain** — Vercel → Project → Settings → Domains. Add that domain to Firebase authorized domains too.
