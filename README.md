# 🎮 Banco Controllo Skin Minecraft

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)](https://github.com/yourusername/banco-controllo-skin/releases)
[![Node.js](https://img.shields.io/badge/Node.js-14+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.6+-blue.svg)](https://www.python.org/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](#)

Applicazione web professionale per ispezionare, organizzare e controllare skin Minecraft con un'interfaccia moderna, animazioni fluide e controlli avanzati da tastiera.

**🌐 Demo Live**: [banco-controllo-skin.vercel.app](https://banco-controllo-skin.vercel.app) (Se deployato)

---

## ✨ Features Principali

### 🎮 Controlli Avanzati
- **WASD + Frecce direzionali**: Navigazione completa da tastiera
  - `W` / `↑` → Approva skin
  - `S` / `↓` → Segnala come da correggere
  - `A` / `←` → Skin precedente
  - `D` / `→` → Skin successiva
  - `Esc` → Chiudi visualizzatore
- **Mouse**: Supporto completo con click
- **Visualizzatore 3D**: Ruota, zooma, scegli pose (in piedi, cammina, corri, saluta)

### 🔍 Verifica Automatica Iniziale
- Controlla dimensioni e formato di tutte le skin
- Rileva automaticamente modello **slim** vs **wide/classic**
- Segnala anomalie (corruzione, 64×32, dimensioni non valide)
- Flagga automaticamente le skin problematiche

### ✨ Interfaccia Professionale
- **Tooltip intelligenti**: 350ms delay, posizionamento smart
- **Toast notifications**: Feedback non-bloccante (successo/errore/avviso)
- **Animazioni fluide**: 
  - Ingresso a cascata delle card (sfasate 16ms)
  - Hover avanzato (traslazione + zoom + ombra)
  - Pulse su verdict button
  - Flash colorato sul stage frame
- **Design dark mode**: Ottimizzato per lunghe sessioni
- **Responsive**: Funziona su desktop e tablet

### 📦 Organizzazione Intelligente
- **Importazione flessibile**: ZIP, Cartelle, Immagini sciolte
- **Categorie automatiche**: Le sottocartelle diventano categorie
- **Esportazione doppia**: ZIP con cartelle `Wide/` e `Slim/` separate (mai mescolate)
- **Report CSV**: Traccia categoria, nome, stato e modello

### 🔒 Privacy First
- **100% locale**: Nessun dato verso server
- **Nessun upload**: File rimangono sul tuo computer
- **Nessuna cookie**: Zero tracking
- **Offline-ready**: Funziona completamente offline una volta caricato

---

## 🚀 Quick Start

### Avvio Locale (60 secondi)

#### Con Python (consigliato)
```bash
cd skin-checker
python -m http.server 8000
```
Apri: **http://localhost:8000**

#### Con Node.js
```bash
cd skin-checker
npx http-server -p 8000
```
Apri: **http://localhost:8000**

#### Con VS Code
- Installa estensione **"Live Server"**
- Clicca destro su `index.html` → "Open with Live Server"
- Si apre automaticamente nel browser

### Deploy su Vercel (30 secondi)
```bash
npm install -g vercel
vercel
```
Segui i 3 step → Live URL in 30 secondi! ✓

Oppure usa il [Dashboard Vercel](https://vercel.com) per un click deploy.

---

## 📋 Requisiti

- **Browser moderno**: Chrome, Firefox, Safari, Edge (ultimi 2 anni)
- **Python 3.6+** oppure **Node.js 14+** (solo per server locale)
- **Nessuna dipendenza NPM** (tutto bundled)

## 💾 Installazione

### Download manuale
1. Scarica la cartella `skin-checker/`
2. Apri terminale nella cartella
3. Esegui: `python -m http.server 8000`
4. Apri: `http://localhost:8000`

### Clona il repo (Git)
```bash
git clone https://github.com/yourusername/banco-controllo-skin.git
cd banco-controllo-skin/skin-checker
python -m http.server 8000
```

### Vercel (un click)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fbanco-controllo-skin)

---

## 🎯 Uso

### 1. Carica le skin
- **ZIP**: Con cartelle che diventano categorie
- **Cartella**: Le sottocartelle diventano categorie
- **Immagini sciolte**: Usa la categoria predefinita

### 2. Verifica automatica (opzionale)
Clicca **"🔍 Verifica iniziale"** per:
- Controllare dimensioni/formato
- Rilevare slim/wide automaticamente
- Segnalare anomalie (corruzione, 64×32, etc.)

### 3. Ispeziona manualmente
- Clicca su una card per aprire il visualizzatore 3D
- Usa WASD o mouse per navigare e valutare
- Approva ✓ o Segnala ✗ ogni skin

### 4. Esporta
- **Report CSV**: categoria, stato, modello
- **ZIP**: Organizzato in Wide/ e Slim/ con stesse categorie

### 5. Riprendi da precedente
- Importa il CSV da una sessione precedente
- Continua da dove hai lasciato

---

## 📁 Struttura del Progetto

```
skin-checker/
├── index.html                      # Pagina principale (125 righe)
│
├── css/
│   └── style.css                   # Stili + animazioni (422 righe)
│
├── js/
│   ├── app.js                      # Logica applicativa (840 righe)
│   ├── skinview3d.min.js           # Visualizzatore 3D (1997 righe)
│   └── jszip.min.js                # Gestione ZIP (minificato)
│
├── index-all-in-one.html           # Versione single-file (fallback)
│
├── 📚 DOCUMENTAZIONE
│   ├── README.md                   # Questa guida
│   ├── QUICKSTART.md               # Istruzioni veloci (2 min)
│   ├── SETUP.md                    # Setup dettagliato
│   ├── CHANGELOG.md                # Novità v2.0
│   ├── VERIFICA_INIZIALE_SPIEGAZIONE.md
│   ├── FIX_404_ERRORS.md
│   └── ERRORE_404_SOLUZIONE.txt
│
├── ⚙️ CONFIGURAZIONE
│   ├── vercel.json                 # Config Vercel
│   ├── package.json                # Metadata progetto
│   └── .gitignore                  # Git config
│
└── 📄 File di supporto
    └── START_HERE.txt              # Guida visiva iniziale
```

---

## 🎮 Scorciatoie da Tastiera

| Tasto | Azione |
|-------|--------|
| **W** / **↑** | Approva skin corrente |
| **S** / **↓** | Segnala skin corrente |
| **A** / **←** | Vai a skin precedente |
| **D** / **→** | Vai a skin successiva |
| **Esc** | Chiudi visualizzatore 3D |
| **Mouse drag** | Ruota modello 3D |
| **Mouse scroll** | Zooma modello 3D |

---

## 📊 Tecnologie Utilizzate

### Frontend
- **HTML5** — Markup semantico
- **CSS3** — Animazioni fluide, variabili CSS, grid layout
- **JavaScript vanilla** — Zero dipendenze, tutto nativo
- **SkinView3D** — Rendering 3D delle skin Minecraft
- **JSZip** — Creazione e lettura file ZIP

### Backend (deploy)
- **Vercel** — Serverless hosting (consigliato)
- **GitHub Pages** — Alternativa statica
- **Netlify** — Altra opzione di hosting

### Build & Dev
- **Node.js** — Runtime JavaScript
- **Python** — Server locale di sviluppo
- **Git** — Version control

---

## 🔍 Comparazione Features v1.0 vs v2.0

| Feature | v1.0 | v2.0 |
|---------|------|------|
| Controllo da tastiera | ←/→ + A/F | **WASD + ←/→/↑/↓** |
| Verifica formato | Manuale | **Automatica** |
| Rilevamento slim/wide | Solo bottone | **Automatico + bottone** |
| Tooltip pulsanti | ✗ | **✓** |
| Feedback azioni | Alert | **Toast non-bloccanti** |
| Animazioni | Minime | **Fluide + polish** |
| Organizzazione ZIP | Una cartella | **Wide/ e Slim/ separati** |
| Anomalie rilevate | ✗ | **✓ Segnalate e flaggate** |
| Modularizzazione | Monolite | **HTML/CSS/JS separati** |
| Badge anomalie | ✗ | **✓ Con pulsating effect** |

---

## 📈 Performance

- **Bundle size**: ~650KB (mantenuto compatto)
- **Tempo caricamento**: <1s (tutto locale)
- **Memory usage**: Ottimizzato per centinaia di skin
- **Batch processing**: Non blocca l'interfaccia
- **Lazy loading**: Immagini caricate su demand

---

## 🐛 Troubleshooting

### Errore 404 "Failed to load resource"
**Causa**: Stai lanciando il server dalla cartella sbagliata  
**Soluzione**: `cd skin-checker` poi `python -m http.server 8000`  
**Alternativa**: Apri `index-all-in-one.html` direttamente nel browser

### Skin non caricate correttamente
**Causa**: PNG corrotto o dimensioni non valide  
**Soluzione**: Usa il pulsante "🔍 Verifica iniziale" per controllare

### ZIP non scarica
**Causa**: Browser ha bloccato il download  
**Soluzione**: Permetti i download da localhost oppure prova un altro browser

Vedi **`FIX_404_ERRORS.md`** per troubleshooting completo.

---

## 🤝 Contributing

Contributions sono benvenute! 

### Setup dev
```bash
git clone https://github.com/yourusername/banco-controllo-skin.git
cd skin-checker
python -m http.server 8000
```

### Modifiche proposte
1. Fork il repo
2. Crea un branch (`git checkout -b feature/my-feature`)
3. Commit le modifiche (`git commit -m 'Add my feature'`)
4. Push al branch (`git push origin feature/my-feature`)
5. Apri una Pull Request

### Stile del codice
- JavaScript vanilla (niente transpiler)
- CSS con variabili (no preprocessor)
- Commenti chiari in italiano
- Test manuale prima di commit

---

## 📜 Licenza

MIT License — Vedi **`LICENSE`** per i dettagli.

Attribuzione:
- **SkinView3D**: [YouKnow Org](https://github.com/youknoworg/skinview3d) (LGPL)
- **JSZip**: [Stuart Knightley](https://github.com/Stuk/jszip) (MIT)

---

## 📞 Supporto

### Documentazione
- 📖 **README.md** → Guida completa (questo file)
- ⚡ **QUICKSTART.md** → Setup in 2 minuti
- 🔧 **SETUP.md** → Configurazione dettagliata
- ✨ **CHANGELOG.md** → Tutte le novità v2.0
- 🔍 **VERIFICA_INIZIALE_SPIEGAZIONE.md** → Come funziona il controllo automatico

### Issues
Se trovi un bug:
1. Controlla **`FIX_404_ERRORS.md`** prima
2. Apri una issue con:
   - Screenshot dell'errore
   - Browser e versione
   - Passi per riprodurre il bug

### Email
Per domande: contattami via GitHub Issues

---

## 🌟 Roadmap Futura

- [ ] Support per texture pack custom (.mcmeta)
- [ ] Anteprima armature sopra la skin
- [ ] Esportazione preview (PNG del modello 3D)
- [ ] Supporto per cape Minecraft
- [ ] Condivisione link di singole skin
- [ ] Dark/light theme toggle
- [ ] Multi-lingua (EN, IT, ES, FR, DE)
- [ ] Mobile app (React Native)

---

## 📊 Statistiche del Progetto

```
Linguaggi:
  JavaScript ████████████████░░ 48%
  CSS        ██████░░░░░░░░░░░░ 15%
  HTML       ████░░░░░░░░░░░░░░ 9%
  Markdown   ████████░░░░░░░░░░ 28%

Dimensioni:
  Codice applicativo: 42 KB
  Librerie:           600 KB
  Documentazione:     50 KB
  Totale:             ~650 KB

Linee di codice:
  app.js:    840 righe
  style.css: 422 righe
  index.html: 125 righe
  Totale:    1387 righe
```

---

## 🙌 Ringraziamenti

- **SkinView3D** per il visualizzatore 3D
- **JSZip** per la gestione ZIP
- **Community Minecraft** per il feedback
- **Vercel** per l'hosting gratuito

---

## 📝 Changelog

Vedi **`CHANGELOG.md`** per l'elenco completo.

### v2.0.0 (Agosto 2026)
- ✨ Controlli WASD + Frecce
- 🔍 Verifica iniziale automatica
- 🎨 Interfaccia professionale con animazioni
- 📦 ZIP doppio (Wide/Slim separati)
- 🎯 Badge slim/wide e anomalie
- 💻 Struttura modularizzata (HTML/CSS/JS)

### v1.0.0 (Gennaio 2026)
- Versione iniziale
- Visualizzatore 3D
- Caricamento ZIP/Cartella/Immagini
- Esportazione CSV

---

<div align="center">

**[↑ Back to top](#-banco-controllo-skin-minecraft)**

Made with ❤️ for Minecraft skin lovers

[![GitHub Stars](https://img.shields.io/github/stars/yourusername/banco-controllo-skin?style=social)](https://github.com/yourusername/banco-controllo-skin)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/banco-controllo-skin?style=social)](https://github.com/yourusername/banco-controllo-skin)

</div>
