# Déploiement sur Vercel — Véronique AI

Ce guide décrit comment déployer l'application sur Vercel, du clone jusqu'à la
production, en passant par la base de données distante et les clés API.

---

## 1. Prérequis

- Un compte **Vercel** (gratuit) : https://vercel.com
- Un compte **GitHub** (le repo sera connecté à Vercel)
- Une **base de données Turso** (gratuite) — voir §3
- Les **clés API** souhaitées — voir §4

---

## 2. Déployer le code sur Vercel

### Option A — Via le CLI Vercel (le plus rapide)

```bash
# 1. Installer le CLI Vercel
npm i -g vercel

# 2. Se connecter (ouvre le navigateur)
vercel login

# 3. À la racine du projet, déployer en preview
vercel

# 4. Configurer les variables d'environnement (voir §5) puis déployer en prod
vercel --prod
```

### Option B — Via le dashboard Vercel (Git integration)

1. Poussez le projet sur GitHub.
2. Sur https://vercel.com/new → « Import » votre repo.
3. Framework Preset : **Next.js** (détecté automatiquement).
4. Build Command : laissez par défaut (`next build`).
5. **Avant de cliquer sur Deploy**, ajoutez les variables d'environnement (§5).
6. Déployez. Les pushes suivants redéploient automatiquement.

---

## 3. Base de données — Turso (libSQL)

Vercel étant serverless, il n'y a **pas de filesystem persistant** : le fichier
SQLite local ne marche pas en prod. On utilise **Turso**, une base SQLite
distante gratuite et edge-compatible.

### Créer la base Turso

```bash
# 1. Installer Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# 2. S'authentifier (ouvre le navigateur)
turso auth login

# 3. Créer une base de données
turso db create veronique-ai

# 4. Récupérer l'URL de connexion
turso db show veronique-ai --url
# → libsql://veronique-ai-<votre-user>.turso.io

# 5. Créer un token d'accès
turso db tokens create veronique-ai
# → eyJhbGciOiJF...
```

### Pousser le schéma Prisma vers Turso

En local, créez temporairement un `.env` pointant vers Turso, puis lancez la
migration :

```bash
# .env temporaire pour la migration
DATABASE_URL="file:./db/custom.db"   # gardé pour ne pas casser le dev local
TURSO_DATABASE_URL="libsql://veronique-ai-<user>.turso.io"
TURSO_AUTH_TOKEN="eyJhbGciOiJF..."

# Générer le client Prisma (déjà fait, mais au cas où)
bun run db:generate

# Pousser le schéma vers Turso. Comme le datasource du schema.prisma est
# `sqlite` (compatible libSQL), on utilise le flag --url :
bunx prisma db push --url "libsql://veronique-ai-<user>.turso.io?authToken=eyJhbGciOiJF..."
```

Le schéma (`UserProfile` + `Message`) est maintenant créé sur Turso.

---

## 4. Clés API nécessaires

L'application marche avec **zéro clé externe** grâce au SDK `z-ai-web-dev-sdk`
pré-configuré. Mais pour de meilleures performances et moins de dépendance,
ajoutez ces clés gratuites. **Toutes sont optionnelles** — l'app fonctionne
sans, avec fallback automatique.

| Capacité | Provider recommandé | URL d'inscription (gratuit) | Variable d'env | Obligatoire ? |
|---|---|---|---|---|
| **LLM** | Groq (Llama 3.3 70B) | https://console.groq.com/keys | `GROQ_API_KEY` | Non (fallback z-ai) |
| **LLM** (alt.) | OpenRouter (Llama 3.3 70B) | https://openrouter.ai/keys | `OPENROUTER_API_KEY` | Non |
| **STT** | Groq (Whisper Large v3) | (idem que LLM) | `GROQ_API_KEY` | Non (fallback z-ai) |
| **TTS** | ElevenLabs (voix FR) | https://elevenlabs.io/app/settings/api-keys | `ELEVENLABS_API_KEY` | Non (fallback z-ai) |
| **DB** | Turso (libSQL) | https://turso.tech | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | **Oui pour Vercel** |

### Résolution automatique (chaîne de fallback)

```
LLM :  Groq       → OpenRouter → z-ai SDK
STT :  Groq       → z-ai SDK   (language=fr + filtre anti-CJK toujours actifs)
TTS :  ElevenLabs → z-ai SDK
```

Si un provider échoue (clé invalide, réseau, quota), l'app bascule
automatiquement sur le suivant — l'utilisateur ne voit pas d'erreur.

---

## 5. Variables d'environnement à configurer sur Vercel

Dans le dashboard Vercel : **Settings → Environment Variables**. Ajoutez pour
les environnements **Production** et **Preview** :

### Obligatoires (DB)

```
TURSO_DATABASE_URL = libsql://veronique-ai-<user>.turso.io
TURSO_AUTH_TOKEN   = eyJhbGciOiJF...
```

### Optionnelles mais recommandées (API externes)

```
GROQ_API_KEY         = gsk_...
OPENROUTER_API_KEY   = sk-or-v1-...
ELEVENLABS_API_KEY   = sk_...
```

### Pour le dev local uniquement (ne PAS mettre sur Vercel)

```
DATABASE_URL = file:./db/custom.db
```

Après avoir ajouté les variables, **redéployez** pour qu'elles soient prises en
compte.

---

## 6. Vérification post-déploiement

Une fois déployé, vérifiez ces endpoints sur votre domaine Vercel :

- `https://<votre-app>.vercel.app/` → l'app se charge (onboarding)
- `https://<votre-app>.vercel.app/api/providers/health` → état des providers
- `https://<votre-app>.vercel.app/api/profile?userId=test` → DB répond
- `https://<votre-app>.vercel.app/api/chat` (POST) → LLM répond
- `https://<votre-app>.vercel.app/api/tts` (POST) → audio renvoyé

Dans l'app, l'indicateur en haut à droite (TTS · LLM · STT) montre en direct
quels providers sont actifs.

---

## 7. Notes techniques

- **Next.js 16 + Turbopack** : supporté nativement par Vercel.
- **API routes** : `maxDuration: 60s` (cf. `vercel.json`) pour les appels LLM/TTS/STT.
- **Pas de `output: "standalone"`** : retiré du `next.config.ts` car Vercel
  gère le build nativement.
- **Prisma** : le client est généré automatiquement au build via le
  `postinstall` de Prisma. Si le build échoue sur Vercel avec une erreur
  Prisma, ajoutez dans `package.json` :
  ```json
  "postinstall": "prisma generate"
  ```
