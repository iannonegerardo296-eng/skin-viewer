# 🎮 Banco Controllo Skin Minecraft

Web app locale per ispezionare, validare e organizzare skin Minecraft in 3D — nessun dato lascia il browser.

## Avvio

**Locale** (serve un server, non aprire il file direttamente):
```bash
cd skin-checker
python -m http.server 8000     # oppure: npx http-server -p 8000
```
→ apri `http://localhost:8000`

### TypeScript

Il progetto mantiene il viewer statico e le librerie browser senza bundler, ma ora include un layer UI tipizzato in TypeScript. Per controllarlo o ricompilarlo:

```bash
npm install
npm run typecheck
npm run build:web
```

Il file sorgente è `js/ui-enhancements.ts`; il relativo output browser è `js/ui-enhancements.js`, già incluso nella pagina. La dashboard è scritta in `src/dashboard.ts` (compilata in `dist/src/dashboard.js`, committato nel repo). Il backend condiviso è in `lib/app.js`: lo stesso codice viene usato dal server locale (`server/dev-server.js`) e dalle funzioni Vercel, che usano due endpoint auth espliciti più il catch-all `api/[...path].js` per mantenere il deployment entro il limite Hobby.

### Skin Control Center

La home è una dashboard admin con autenticazione, account persistiti su database, ruoli `admin`/`user`, sessioni HttpOnly, activity log e catalogo curato con attribuzione alle fonti Planet Minecraft, NameMC e MineSkin. Gli admin vedono anche un pulsante **"Carica skin"** nel catalogo (e un equivalente **"Carica nel catalogo"** nel revisore 3D) per aggiungere skin al database direttamente da un PNG.

**Non esiste più un admin di default.** Nessun account viene creato automaticamente con credenziali prevedibili. Per avere il primo admin:

- **In locale**: imposta `ADMIN_USERNAME` e `ADMIN_PASSWORD` in `.env.local` prima del primo avvio, oppure registra un account normale da `/api/auth/register` e promuovilo a `admin` direttamente nel database.
- **Su Vercel**: imposta le stesse due variabili nelle Environment Variables del progetto (vedi sotto), oppure registra un account dall'app pubblicata e promuovilo a mano nel database (via Turso CLI/dashboard).

Avvio completo in locale:
```bash
npm install
npm run typecheck
npm run dev
```

Il server ascolta su `http://127.0.0.1:8000`; puoi cambiare porta con `PORT=8001 npm run dev` (su PowerShell: `$env:PORT=8001; npm run dev`). In locale il database è un file SQLite in `data/skin-control.sqlite` (creato al volo, escluso dal versionamento). `review.html` contiene il revisore 3D e condivide il tema visuale con la dashboard.

### Deploy su Vercel

L'app usa funzioni serverless Node in `api/` più `@libsql/client` per il database, quindi funziona sia in locale sia su Vercel con lo **stesso codice**. Il filesystem di Vercel è di sola lettura/effimero fuori da `/tmp`, quindi un file SQLite locale non può essere il database "vero" in produzione: serve un database SQLite servito via rete, e la scelta più semplice e gratuita è **Turso** (libSQL, protocollo compatibile con SQLite).

1. Crea un database gratuito su [turso.tech](https://turso.tech) (CLI: `turso db create skin-control`).
2. Recupera URL e token: `turso db show skin-control --url` e `turso db tokens create skin-control`.
3. Su [vercel.com](https://vercel.com) → il tuo progetto → **Settings → Environment Variables**, aggiungi:
   - `TURSO_DATABASE_URL` = l'URL del database (`libsql://...`)
   - `TURSO_AUTH_TOKEN` = il token generato
   - `ADMIN_USERNAME` e `ADMIN_PASSWORD` = credenziali del primo admin (create al primo avvio della funzione serverless)
4. Deploy:
   ```bash
   npm install -g vercel
   vercel
   ```
   oppure collega il repo GitHub da vercel.com → Add New → Project. Il `vercel.json` incluso gestisce cache/routing; Vercel **non** ricompila nulla in deploy (`buildCommand` è disattivato), quindi `dist/src/dashboard.js` deve stare nel repository e va rigenerato con `npm run build:web` (o `npm run dev`) e ricommittato ogni volta che modifichi `src/dashboard.ts`.

> Se il progetto Vercel esisteva già prima di aggiungere questo `vercel.json`, controlla **Settings → Build & Development Settings**: le impostazioni salvate lì manualmente hanno la precedenza sul file. Se vedi un "Build Command" con override attivo, disattivalo (o svuotalo) così viene usato quello del `vercel.json`.

Senza `TURSO_DATABASE_URL` l'app su Vercel proverebbe comunque a scrivere un file locale in `/tmp`: funziona per una singola invocazione ma i dati **non persistono** tra un deploy/invocazione e l'altra, quindi per un uso reale imposta sempre Turso.

## Struttura del progetto

```
index.html              versione modulare (usa questa per sviluppare)
index-all-in-one.html   stesso progetto, CSS/JS incollati inline
css/style.css
js/app.js                logica applicativa
js/skinview3d.min.js     rendering 3D delle skin
js/jszip.min.js          creazione/lettura ZIP
js/gsap.min.js           animazioni del Centro Controlli
vercel.json / package.json / .gitignore
```
⚠️ Se modifichi i file modulari, ricorda di rigenerare `index-all-in-one.html` (i due file vanno disallineati altrimenti).

## Funzionalità

- **Import**: ZIP (cartelle → categorie), cartella locale, o immagini sciolte
- **Visualizzatore 3D**: ruota/zoom, pose (in piedi, cammina, corri, saluta)
- **Controlli da tastiera**: `W`/`↑` approva · `S`/`↓` segnala · `A`/`←` precedente · `D`/`→` successiva · `Esc` chiude
- **Controlli automatici** (pulsanti dedicati in toolbar + "🎛️ Centro Controlli" che li lancia tutti insieme):
  - 📐 **Dimensioni** — verifica che ogni skin sia 64×64 (o multiplo) e leggibile
  - 🧍 **Slim/Wide** — rileva il modello analizzando la texture del braccio
  - 🚩 **Anomalie tecniche** — segnala texture quasi trasparenti, pattern a scacchiera "texture mancante", o quasi-monocromatiche. Non è un giudizio estetico: guarda solo segnali tecnici concreti di file rotti o placeholder, quindi non penalizza boss/mob legittimamente saturi o semplici.
- **Export**: ZIP con **solo le skin approvate**, organizzate in `Wide/` e `Slim/` con le stesse categorie; report CSV con stato, modello ed esito controlli

## Troubleshooting

**Errori 404 (style.css/app.js non trovati)** → stai lanciando il server dalla cartella sbagliata. Devi essere *dentro* `skin-checker/` quando esegui `python -m http.server`. In alternativa usa `index-all-in-one.html`, che non ha dipendenze esterne.

**Export ZIP vuoto** → nessuna skin è stata approvata (`W`/click ✓). L'export include solo quelle approvate, di proposito.
