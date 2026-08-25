# Changelog - Banco Controllo Skin v2.0

## 🆕 Novità principali

### Controlli Avanzati
- ✅ **WASD + Frecce direzionali**: navigazione e valutazione completa da tastiera
  - **W / ↑** → Approva skin
  - **S / ↓** → Segnala come da correggere  
  - **A / ←** → Skin precedente
  - **D / →** → Skin successiva
- ✅ Supporto completo **mouse** (click sui pulsanti)
- ✅ **Esc** per chiudere il visualizzatore

### Verifica Automatica Iniziale
- ✅ **🔍 Pulsante "Verifica iniziale"**: un click per controllare tutto
  - Valida dimensioni (64×64, 128×128, 256×256, etc.)
  - Rileva modello slim/wide automaticamente
  - Segnala skin corrotte o in formato legacy 64×32
  - Segnala automaticamente le anomalie (flagga le skin difettose)
- ✅ Messaggi di feedback immediati (toast notifications)

### Interfaccia Professionale e Animazioni
- ✅ **Tooltip intelligenti**: passa il mouse su qualsiasi pulsante
  - Compaiono dopo 350ms (non intrusive)
  - Posizionati intelligentemente (sopra o sotto il pulsante)
  - Disabilitati durante la digitazione
- ✅ **Toast notifications** (no-blocking):
  - Successo (verde) per operazioni completate
  - Avviso (giallo) per anomalie rilevate
  - Errore (rosso) per problemi critici
  - Appaiono in basso a destra, scompaiono dopo 4.2 secondi
- ✅ **Animazioni fluide**:
  - Ingresso a cascata delle card della griglia (sfasate di 16ms)
  - Hover della card: traslazione verso l'alto + zoom
  - Pulsanti verdict: effetto pulse quando attivati
  - Flash del stage frame: bagliore mint (approva) o coral (segnala)
  - Dropzone: animazione di ingresso smooth

### Organizzazione Skin
- ✅ **Badge slim/wide** su ogni card dopo il rilevamento
  - Verde (mint) = Slim
  - Giallo (amber) = Wide/Classic
- ✅ **Badge anomalie** (⚠) su skin segnalate con tooltip
- ✅ **Rilevamento modello durante ispezionamento**: il model-type viene salvato quando apri una skin

### Esportazione Intelligente
- ✅ **Doppia organizzazione ZIP**:
  - Cartella `Wide/` per modello classic
  - Cartella `Slim/` per modello slim
  - Stesse categorie in entrambe (mai mescolate)
- ✅ **Report CSV arricchito** con colonna `modello`
- ✅ **Report auto-inclusos nello ZIP**
- ✅ **Toast di conferma** dopo ogni esportazione con statistiche

### Struttura Modularizzata
- ✅ **HTML separato**: `index.html` (125 righe, pulito)
- ✅ **CSS separato**: `css/style.css` (422 righe, tutte le animazioni)
- ✅ **JS separato**: `js/app.js` (840 righe, logica dell'app)
- ✅ **Librerie separate**: skinview3d.min.js, jszip.min.js

### UX/UI Miglioramenti
- ✅ **Footer dinamico**: mostra gli hint dei controlli attuali
- ✅ **Animazione scanline** su caricamento skin (effetto cinematico)
- ✅ **Stato ripristinabile**: importa CSV precedenti per continuare il lavoro
- ✅ **Filmstrip tattile**: hover/click sui thumb nella lista a destra
- ✅ **Filmstrip con tooltip**: info skin su hover (dataset-tooltip)

### Ottimizzazioni
- ✅ Rilevamento slim/wide unificato (stesso algoritmo skinview3d)
- ✅ Batch processing per verifica iniziale (senza blocchi)
- ✅ Caricamento lazy delle immagini (performance su molti file)
- ✅ Gestione intelligente dei nomi di file duplicati

---

## 📊 Prima vs Dopo

| Feature | Prima | Dopo |
|---------|-------|------|
| Controllo da tastiera | ←/→ + A/F | WASD + ←/→/↑/↓ |
| Verifica formato | Manuale | Automatica |
| Rilevamento slim/wide | Solo con bottone | Automatico + bottone |
| Tooltip pulsanti | NO | Sì (350ms delay) |
| Feedback azioni | Nessuno/Alert | Toast non-bloccanti |
| Animazioni | Minime | Fluide + polish |
| Organizzazione ZIP | Una cartella | Wide/ e Slim/ |
| Anomalie rilevate | NO | Sì, segnalate e flaggate |
| Struttura file | Tutto in index.html | Modulare (HTML/CSS/JS) |

---

## 🐛 Correzioni e miglioramenti
- Perfezionato il CSS per mobile (scrollbar, toast stack, dropdown)
- Migliorato l'accesso da tastiera (preventDefault su WASD)
- Ottimizzato il rilevamento della finestra browser per il canvas 3D
- Risolti edge-case su nomi di file duplicati in ZIP

---

## 📈 Performance
- **Bundle size**: ~650KB (mantenuto compatto)
- **Tempo di caricamento**: <1s (tutto locale)
- **Memory usage**: Ottimizzato per centinaia di skin
- **Batch processing**: Non blocca l'interfaccia

---

**Data rilascio**: Agosto 2026  
**Autore**: Skin Inspector Team
