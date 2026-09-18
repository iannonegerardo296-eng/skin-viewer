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
npm run build
```

Il file sorgente è `js/ui-enhancements.ts`; il relativo output browser è `js/ui-enhancements.js`, già incluso nella pagina. La dashboard è scritta in `src/dashboard.ts` e il backend in `server/index.ts`; entrambi vengono compilati in `dist/`.

### Skin Control Center

La home è una dashboard admin con autenticazione, account persistiti in SQLite, ruoli `admin`/`user`, sessioni HttpOnly, activity log e catalogo curato con attribuzione alle fonti Planet Minecraft, NameMC e MineSkin. Al primo avvio viene creato automaticamente l’account `accountadmin`: usa `ADMIN_PASSWORD` in `.env.local`, oppure la password locale predefinita `accountadmin` (cambiala subito dalla sezione account).

Avvio completo:
```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Il backend ascolta su `http://127.0.0.1:8000`; puoi cambiare porta con `PORT=8001 npm run dev` (su PowerShell: `$env:PORT=8001; npm run dev`). Il database viene creato in `data/skin-control.sqlite`, escluso dal versionamento. `review.html` conserva il revisore 3D legacy collegato dalla dashboard.

**Senza server**: apri `index-all-in-one.html` con doppio-click (stesso identico progetto, tutto in un file).

**Vercel**:
```bash
npm install -g vercel
vercel
```
oppure collega il repo GitHub da [vercel.com](https://vercel.com) → Add New → Project. Il `vercel.json` incluso gestisce già cache/routing.

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
