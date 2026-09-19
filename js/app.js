(function(){
  let items = []; // {file, url, name, displayName, category, status}
  let statusFilter = 'all';
  let categoryFilter = 'all';
  let qualityFilter = 'all';
  let categoryOrder = []; // ordine delle categorie deciso dall'utente
  let nextItemUid = 1; // id stabile per item, usato per aggiornare le card senza un re-render completo
  let currentIndex = -1;

  // ---------- tema chiaro/scuro ----------
  // Il tema iniziale è già applicato da uno script inline nell'<head>
  // (per evitare il flash del tema sbagliato); qui gestiamo solo il
  // pulsante e la persistenza della scelta.
  (function initThemeToggle(){
    const toggle = document.getElementById('themeToggle');
    const knob = document.getElementById('themeKnob');
    if(!toggle || !knob) return;

    function applyIcon(theme){
      knob.innerHTML = theme === 'light'
        ? '<span class="icon icon-sun"></span>'
        : '<span class="icon icon-moon"></span>';
    }
    applyIcon(document.documentElement.getAttribute('data-theme') || 'dark');

    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('skin-checker-theme', next); } catch(e){}
      applyIcon(next);
      if(window.gsap){
        gsap.fromTo(knob, { rotate: -90, scale: .6 }, { rotate: 0, scale: 1, duration: .4, ease: 'back.out(2)' });
      }
    });
  })();

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const folderInput = document.getElementById('folderInput');
  const zipInput = document.getElementById('zipInput');
  const addMoreInput = document.getElementById('addMoreInput');
  const addFolderInput = document.getElementById('addFolderInput');
  const addZipInput = document.getElementById('addZipInput');
  const defaultCategoryInput = document.getElementById('defaultCategoryInput');
  const zipStatus = document.getElementById('zipStatus');
  const topbar = document.getElementById('topbar');
  const catbar = document.getElementById('catbar');
  const catchips = document.getElementById('catchips');
  const grid = document.getElementById('grid');
  const footerNote = document.getElementById('footerNote');

  const IMAGE_RE = /\.(png|jpe?g|webp)$/i;

  function isPngLike(name){ return IMAGE_RE.test(name); }

  function escapeAttr(s){
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ---------- rilevamento anomalie tecniche + segnali "meme" ----------
  // IMPORTANTE: un file skin PNG non è una "foto" del personaggio: è una
  // texture UV (un atlante di parti — testa, busto, braccia, gambe —
  // disposte in una griglia fissa). Un vecchio algoritmo che analizzava
  // "quanto colore c'è in alto vs in basso" per dedurre le proporzioni
  // del corpo era quindi concettualmente sbagliato: quella metà superiore
  // NON corrisponde alla testa del personaggio renderizzato, e skin serie
  // molto sature o quasi monocromatiche (es. boss di lava, di ghiaccio,
  // mob custom) venivano segnalate come "meme" a torto.
  //
  // Il controllo combina due famiglie di segnali:
  //  A) file rotto/placeholder (oggettivo, quasi mai un falso positivo):
  //     1) texture quasi completamente trasparente
  //     2) pattern a scacchiera magenta/nero ("texture mancante")
  //     3) pochissimi colori su immagine quasi interamente opaca
  //     4) un unico colore che copre quasi tutta la texture (segnale debole)
  //  B) possibile skin scherzosa (più soft, pesati meno, pensati per NON
  //     penalizzare boss/mob legittimamente semplici o molto saturi):
  //     5) il volto (regione UV fissa 8,8-16,16) ha molti più dettagli/
  //        contrasti del resto del corpo — il classico "foto o meme
  //        incollato sulla faccia di Steve"
  //     6) tavolozza cromatica dispersa su moltissime tonalità diverse
  //        senza un filo conduttore ("confetti"/arcobaleno casuale)
  function sampleRegionStats(ctx, x, y, w, h){
    if(w <= 0 || h <= 0) return { uniqueColors: 0, entropy: 0 };
    const { data } = ctx.getImageData(x, y, w, h);
    const colors = new Set();
    let diffSum = 0, diffCount = 0;
    for(let row = 0; row < h; row++){
      for(let col = 0; col < w; col++){
        const i = (row * w + col) * 4;
        const a = data[i+3];
        if(a < 20) continue;
        const r = data[i], g = data[i+1], b = data[i+2];
        colors.add(r + ',' + g + ',' + b);
        if(col < w - 1 && data[i+7] > 20){
          diffSum += Math.abs(r-data[i+4]) + Math.abs(g-data[i+5]) + Math.abs(b-data[i+6]);
          diffCount++;
        }
        if(row < h - 1){
          const j = i + w * 4;
          if(data[j+3] > 20){
            diffSum += Math.abs(r-data[j]) + Math.abs(g-data[j+1]) + Math.abs(b-data[j+2]);
            diffCount++;
          }
        }
      }
    }
    return { uniqueColors: colors.size, entropy: diffCount ? diffSum / diffCount : 0 };
  }

  async function analyzeQuality(imageUrl){
    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = new Image();

      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const totalPixels = data.length / 4;

        const colorMap = new Map();
        let opaqueCount = 0;
        let checkerHits = 0, checkerSamples = 0;
        const hueBuckets = new Array(12).fill(0);
        let hueSamples = 0;

        for(let i = 0; i < data.length; i += 4){
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if(a > 20){
            opaqueCount++;
            const hex = `${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
            colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
            // segnale "texture mancante": alternanza magenta acceso / nero
            const isMagenta = r > 200 && g < 60 && b > 200;
            const isBlack = r < 25 && g < 25 && b < 25;
            if(isMagenta || isBlack){
              checkerSamples++;
              const pixelIndex = i / 4;
              const x = pixelIndex % canvas.width;
              const y = Math.floor(pixelIndex / canvas.width);
              const expectMagenta = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0);
              if((expectMagenta && isMagenta) || (!expectMagenta && isBlack)) checkerHits++;
            }
            // istogramma delle tonalità (per il segnale "confetti")
            const max = Math.max(r,g,b), min = Math.min(r,g,b);
            if(max !== min){
              let hue;
              if(max === r) hue = ((g-b)/(max-min)) % 6;
              else if(max === g) hue = (b-r)/(max-min) + 2;
              else hue = (r-g)/(max-min) + 4;
              hue = Math.round(hue * 60);
              if(hue < 0) hue += 360;
              hueBuckets[Math.floor(hue / 30) % 12]++;
              hueSamples++;
            }
          }
        }

        const opacityRatio = opaqueCount / totalPixels;
        const uniqueColors = colorMap.size;
        const dominantCount = colorMap.size ? Math.max(...colorMap.values()) : 0;
        const dominantRatio = opaqueCount ? dominantCount / opaqueCount : 0;
        const checkerboardRatio = checkerSamples > (totalPixels * 0.3) ? (checkerHits / checkerSamples) : 0;

        const reasons = [];
        let score = 100;

        // 1) quasi completamente trasparente → file vuoto o rotto
        if(opacityRatio < 0.05){
          score -= 75;
          reasons.push('Texture quasi completamente trasparente (file vuoto o non caricato correttamente)');
        } else if(opacityRatio < 0.15){
          score -= 30;
          reasons.push('Gran parte della texture è trasparente');
        }

        // 2) pattern a scacchiera magenta/nero → classica "texture mancante"
        if(checkerboardRatio > 0.6){
          score -= 80;
          reasons.push('Rilevato pattern a scacchiera magenta/nero tipico delle "texture mancanti"');
        }

        // 3) pochissimi colori su immagine quasi completamente opaca
        if(opacityRatio > 0.8 && uniqueColors <= 3){
          score -= 40;
          reasons.push(`Solo ${uniqueColors} colori distinti su texture quasi interamente opaca (possibile bozza/placeholder)`);
        }

        // 4) un unico colore domina quasi tutta la texture (segnale debole)
        if(dominantRatio > 0.92 && opacityRatio > 0.5){
          score -= 15;
          reasons.push('Un singolo colore copre oltre il 92% della texture');
        }

        // 5) volto molto più dettagliato/caotico del resto del corpo
        // (coordinate UV fisse: volto 8,8-16,16 · petto 20,20-28,32 —
        // valide sia per skin 64×64 che legacy 64×32, slim o wide)
        if(opacityRatio > 0.15 && canvas.width >= 64){
          const scale = canvas.width / 64;
          const head = sampleRegionStats(ctx, Math.round(8*scale), Math.round(8*scale), Math.round(8*scale), Math.round(8*scale));
          const torso = sampleRegionStats(ctx, Math.round(20*scale), Math.round(20*scale), Math.round(8*scale), Math.round(12*scale));
          if(head.entropy > 26 && torso.entropy > 4 && head.entropy > torso.entropy * 2.2){
            score -= 25;
            reasons.push('Il volto ha molti più dettagli/contrasti del resto del corpo (tipico di una foto o un meme incollato sulla faccia)');
          } else if(head.entropy > 42 && head.uniqueColors > 30){
            score -= 12;
            reasons.push('Il volto presenta un pattern insolitamente denso e caotico');
          }
        }

        // 6) tavolozza cromatica molto dispersa ("confetti"/arcobaleno casuale)
        if(hueSamples > 60){
          const usedBuckets = hueBuckets.filter(n => (n / hueSamples) > 0.02).length;
          if(usedBuckets >= 9){
            score -= 12;
            reasons.push('Tavolozza cromatica molto eterogenea, con moltissime tonalità diverse usate in modo sparso');
          }
        }

        score = Math.max(0, Math.min(100, Math.round(score)));

        let quality = 'seria'; // = "OK, nessun segnale sospetto"
        if(score < 40) quality = 'meme';           // = "sospetta"
        else if(score < 75) quality = 'discutibile'; // = "da verificare"

        resolve({ qualityScore: score, quality, reasons });
      };

      img.onerror = () => resolve({ qualityScore: 0, quality: 'meme', reasons: ['Immagine non leggibile o file corrotto'] });
      img.src = imageUrl;
    });
  }

  // ---------- tooltip (hover su qualsiasi elemento con data-tooltip) ----------
  // Sui dispositivi touch non esiste un vero hover: un tap genera comunque
  // un evento "mouseover" simulato ma non arriva mai un "mouseout" reale
  // finché non si tocca altrove, quindi il tooltip resterebbe appiccicato
  // sullo schermo. Li mostriamo solo se il dispositivo ha un hover fine
  // vero (mouse/trackpad); su touch il tap esegue subito l'azione, punto.
  const supportsHover = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  let tooltipEl = null;
  let tooltipTimer = null;
  let tooltipTarget = null;

  function ensureTooltipEl(){
    if(tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'app-tooltip';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(target){
    const el = ensureTooltipEl();
    const rect = target.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    let top = rect.top - elRect.height - 10;
    let bottom = false;
    if(top < 8){ top = rect.bottom + 10; bottom = true; }
    let left = rect.left + rect.width / 2 - elRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - elRect.width - 8));
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.classList.toggle('tooltip-bottom', bottom);
  }

  function showTooltip(target){
    if(!supportsHover) return;
    const text = target.getAttribute('data-tooltip');
    if(!text) return;
    const el = ensureTooltipEl();
    el.textContent = text;
    el.classList.add('visible');
    requestAnimationFrame(() => positionTooltip(target));
  }

  function hideTooltip(){
    if(tooltipEl) tooltipEl.classList.remove('visible');
    tooltipTarget = null;
  }

  if(supportsHover){
    document.addEventListener('mouseover', e => {
      const target = e.target.closest('[data-tooltip]');
      if(!target || target === tooltipTarget) return;
      tooltipTarget = target;
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => showTooltip(target), 350);
    });
    document.addEventListener('mouseout', e => {
      const target = e.target.closest('[data-tooltip]');
      if(!target) return;
      if(e.relatedTarget && target.contains(e.relatedTarget)) return;
      clearTimeout(tooltipTimer);
      hideTooltip();
    });
  }
  document.addEventListener('mousedown', hideTooltip);
  document.addEventListener('touchstart', hideTooltip, { passive: true });
  document.addEventListener('focusin', e => {
    const target = e.target.closest('[data-tooltip]');
    if(target) showTooltip(target);
  });
  document.addEventListener('focusout', hideTooltip);
  window.addEventListener('scroll', hideTooltip, true);
  window.addEventListener('resize', hideTooltip);

  // ---------- toast (notifiche non bloccanti) ----------
  let toastStack = null;
  function ensureToastStack(){
    if(toastStack) return toastStack;
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    document.body.appendChild(toastStack);
    return toastStack;
  }

  function showToast(kind, title, message, duration = 4200){
    const stack = ensureToastStack();
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    const iconName = kind === 'success' ? 'icon-check' : kind === 'warning' ? 'icon-warning' : kind === 'error' ? 'icon-x' : 'icon-info';
    toast.innerHTML = `
      <span class="toast-icon"><span class="icon ${iconName}"></span></span>
      <div class="toast-body">
        <div class="toast-title">${escapeAttr(title)}</div>
        ${message ? `<div class="toast-msg">${escapeAttr(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Chiudi notifica"><span class="icon icon-x"></span></button>
    `;
    stack.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
    let dismissed = false;
    const remove = () => {
      if(dismissed) return;
      dismissed = true;
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 320);
    };
    toast.querySelector('.toast-close').addEventListener('click', remove);
    if(duration) setTimeout(remove, duration);
    return remove;
  }

  function revealApp(){
    dropzone.style.display = 'none';
    topbar.style.display = 'flex';
    footerNote.style.display = 'block';
    grid.style.display = 'grid';
  }

  // Aggiungi i campi qualità agli item quando vengono creati
  function addItems(newItems){
    if(newItems.length === 0) return;
    const wasEmpty = items.length === 0;
    items.push(...newItems);
    if(items.length > 0) revealApp();
    renderCategoryBar();
    renderGrid(true); // qui sì: sono item davvero nuovi, l'ingresso a scaglioni ha senso
    queueThumbnails(newItems); // genera le anteprime 3D in background, una alla volta
    if(!wasEmpty){
      showToast('success', 'Skin aggiunte', `${newItems.length} nuove skin aggiunte alla sessione.`);
    }
  }

  // ---------- loose image files ----------
  function handleFiles(fileList){
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/') || isPngLike(f.name));
    if(arr.length === 0) return;
    const category = (defaultCategoryInput.value || '').trim() || 'Senza categoria';
    addItems(arr.map(file => ({
      file, url: URL.createObjectURL(file), name: file.name, displayName: file.name,
      category, status: 'unreviewed', modelType: null, issues: [], checked: false, qualityScore: undefined, qualityType: undefined, uid: nextItemUid++, previewUrl: null, previewFailed: false
    })));
  }
  fileInput.addEventListener('change', e => { handleFiles(e.target.files); e.target.value=''; });
  addMoreInput.addEventListener('change', e => { handleFiles(e.target.files); e.target.value=''; });

  // ---------- folder picker (webkitdirectory) ----------
  function handleFolder(fileList){
    const arr = Array.from(fileList).filter(f => f.type.startsWith('image/') || isPngLike(f.name));
    if(arr.length === 0) return;
    const newItems = arr.map(file => {
      const rel = file.webkitRelativePath || file.name;
      const parts = rel.split('/');
      // parts[0] è la cartella radice selezionata: la categoria è tutto ciò che sta in mezzo
      const middle = parts.slice(1, -1);
      const category = middle.length ? middle.join(' / ') : 'Senza categoria';
      return {
        file, url: URL.createObjectURL(file), name: file.name, displayName: file.name,
        category, status: 'unreviewed', modelType: null, issues: [], checked: false, qualityScore: undefined, qualityType: undefined, uid: nextItemUid++, previewUrl: null, previewFailed: false
      };
    });
    addItems(newItems);
  }
  folderInput.addEventListener('change', e => { handleFolder(e.target.files); e.target.value=''; });
  addFolderInput.addEventListener('change', e => { handleFolder(e.target.files); e.target.value=''; });

  // ---------- zip upload ----------
  async function handleZip(file){
    if(!file) return;
    zipStatus.textContent = 'Apertura dello ZIP…';
    try{
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(e => !e.dir && isPngLike(e.name));
      if(entries.length === 0){
        zipStatus.textContent = 'Nessuna immagine trovata nello ZIP.';
        return;
      }
      const newItems = [];
      for(let i = 0; i < entries.length; i++){
        const entry = entries[i];
        zipStatus.textContent = `Estrazione ${i+1} / ${entries.length}…`;
        const blob = await entry.async('blob');
        const cleanPath = entry.name.replace(/^\/+/, '');
        const parts = cleanPath.split('/');
        const filename = parts[parts.length - 1];
        const middle = parts.slice(0, -1);
        const category = middle.length ? middle.join(' / ') : 'Senza categoria';
        newItems.push({
          file: blob, url: URL.createObjectURL(blob), name: filename, displayName: filename,
          category, status: 'unreviewed', modelType: null, issues: [], checked: false, qualityScore: undefined, qualityType: undefined, uid: nextItemUid++, previewUrl: null, previewFailed: false
        });
      }
      zipStatus.textContent = `Caricate ${newItems.length} skin dallo ZIP.`;
      addItems(newItems);
      setTimeout(() => { zipStatus.textContent = ''; }, 4000);
    }catch(err){
      console.error('Errore ZIP:', err);
      zipStatus.textContent = 'Impossibile leggere questo file ZIP.';
    }
  }
  zipInput.addEventListener('change', e => { handleZip(e.target.files[0]); e.target.value=''; });
  addZipInput.addEventListener('change', e => { handleZip(e.target.files[0]); e.target.value=''; });

  // ---------- import CSV (ripristina stato e nome da un report esportato in precedenza) ----------
  function parseCSV(text){
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for(let i = 0; i < text.length; i++){
      const c = text[i];
      if(inQuotes){
        if(c === '"'){
          if(text[i+1] === '"'){ field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else {
        if(c === '"') inQuotes = true;
        else if(c === ','){ row.push(field); field = ''; }
        else if(c === '\n' || c === '\r'){
          if(c === '\r' && text[i+1] === '\n') i++;
          row.push(field); field = '';
          if(row.length > 1 || row[0] !== '') rows.push(row);
          row = [];
        } else field += c;
      }
    }
    if(field !== '' || row.length){ row.push(field); rows.push(row); }
    return rows;
  }

  const importCsvInput = document.getElementById('importCsvInput');
  importCsvInput.addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if(!file) return;
    if(items.length === 0){
      showToast('warning', 'Nessuna skin caricata', 'Carica prima le skin (ZIP, cartella o immagini), poi importa il CSV per riabbinare stato e nomi.');
      return;
    }
    const text = await file.text();
    const rows = parseCSV(text);
    if(rows.length < 2){ showToast('error', 'CSV non valido', 'Il file sembra vuoto o non valido.'); return; }
    const header = rows[0].map(h => h.trim().toLowerCase());
    const idxCat = header.indexOf('categoria');
    const idxOrig = header.indexOf('nome_originale');
    const idxCurr = header.indexOf('nome_attuale');
    const idxStat = header.indexOf('stato');
    if(idxStat === -1 || (idxOrig === -1 && idxCurr === -1)){
      showToast('error', 'CSV non valido', 'Mancano le colonne attese (categoria, nome_originale, nome_attuale, stato).');
      return;
    }

    // indicizzo le skin caricate ora per un riabbinamento veloce
    const byCatAndName = new Map();
    items.forEach((it, i) => {
      byCatAndName.set(it.category + '||' + it.name.toLowerCase(), i);
    });

    let matched = 0;
    for(let r = 1; r < rows.length; r++){
      const row = rows[r];
      if(!row || row.length < header.length) continue;
      const cat = idxCat !== -1 ? row[idxCat] : '';
      const nameCurr = idxCurr !== -1 ? row[idxCurr] : '';
      const nameOrig = idxOrig !== -1 ? row[idxOrig] : '';
      const stato = (row[idxStat] || '').trim().toLowerCase();

      // primo tentativo: nome file attuale nello zip riesportato = nome_attuale del CSV precedente
      let idx = byCatAndName.get(cat + '||' + String(nameCurr).toLowerCase());
      // secondo tentativo: nome file originale (utile se hai ricaricato le immagini con i nomi di partenza)
      if(idx === undefined) idx = byCatAndName.get(cat + '||' + String(nameOrig).toLowerCase());
      if(idx === undefined) continue;

      const it = items[idx];
      if(stato === 'approved') it.status = 'approved';
      else if(stato === 'flagged') it.status = 'flagged';
      else it.status = 'unreviewed';
      if(nameCurr) it.displayName = nameCurr;
      matched++;
    }

    renderCategoryBar();
    renderGrid();
    showToast('success', 'CSV importato', `Riabbinate ${matched} skin su ${items.length} caricate.`);
  });

  // ---------- drag & drop (immagini sciolte) ----------
  ['dragenter','dragover'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.add('drag');
  }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => {
    e.preventDefault(); dropzone.classList.remove('drag');
  }));
  dropzone.addEventListener('drop', e => {
    if(!e.dataTransfer.files) return;
    const dropped = Array.from(e.dataTransfer.files);
    const zipFile = dropped.find(f => f.name.toLowerCase().endsWith('.zip'));
    if(zipFile){ handleZip(zipFile); return; }
    handleFiles(e.dataTransfer.files);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if(!confirm('Ricominciare da capo? Tutti gli stati verranno persi.')) return;
    items.forEach(it => {
      URL.revokeObjectURL(it.url);
      if(it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    });
    items = [];
    statusFilter = 'all';
    categoryFilter = 'all';
    qualityFilter = 'all';
    categoryOrder = [];
    thumbQueue = [];
    grid.innerHTML = '';
    catchips.innerHTML = '';
    catbar.style.display = 'none';
    dropzone.style.display = 'block';
    topbar.style.display = 'none';
    footerNote.style.display = 'none';
    grid.style.display = 'none';
    fileInput.value = '';
    zipStatus.textContent = '';
  });

  function statusLabel(s){
    return s === 'approved' ? 'approved' : s === 'flagged' ? 'flagged' : 'unreviewed';
  }

  function getCategories(){
    syncCategoryOrder();
    return categoryOrder.slice();
  }

  // L'ordine delle categorie è deciso dall'utente (Organizza Cartelle),
  // non più solo alfabetico: questa funzione tiene l'elenco allineato
  // aggiungendo eventuali categorie nuove comparse tra gli item, senza
  // però rimuovere quelle create manualmente ma ancora vuote.
  function syncCategoryOrder(){
    const present = new Set(items.map(it => it.category));
    present.forEach(cat => {
      if(!categoryOrder.includes(cat)) categoryOrder.push(cat);
    });
  }

  function renameCategory(oldName, newName){
    newName = newName.trim();
    if(!newName || newName === oldName) return false;

    const merging = categoryOrder.includes(newName) || items.some(it => it.category === newName);

    items.forEach(it => { if(it.category === oldName) it.category = newName; });

    const idx = categoryOrder.indexOf(oldName);
    if(idx !== -1){
      if(categoryOrder.includes(newName)){
        categoryOrder.splice(idx, 1);
      } else {
        categoryOrder[idx] = newName;
      }
    } else if(!categoryOrder.includes(newName)){
      categoryOrder.push(newName);
    }

    if(categoryFilter === oldName) categoryFilter = newName;

    renderCategoryBar();
    renderGrid();
    if(viewer.classList.contains('open')) populateCategorySelect();

    return merging;
  }

  function moveCategoryOrder(name, dir){
    syncCategoryOrder();
    const idx = categoryOrder.indexOf(name);
    if(idx === -1) return;
    const swapWith = idx + dir;
    if(swapWith < 0 || swapWith >= categoryOrder.length) return;
    const tmp = categoryOrder[idx];
    categoryOrder[idx] = categoryOrder[swapWith];
    categoryOrder[swapWith] = tmp;
    renderCategoryBar();
  }

  function createEmptyCategory(name){
    name = String(name || '').trim();
    if(!name) return false;
    syncCategoryOrder();
    if(categoryOrder.includes(name)){
      showToast('warning', 'Cartella già esistente', `"${name}" c'è già.`);
      return false;
    }
    categoryOrder.push(name);
    renderCategoryBar();
    if(viewer.classList.contains('open')) populateCategorySelect();
    return true;
  }

  function renderCategoryBar(){
    const cats = getCategories();
    if(cats.length <= 1){ catbar.style.display = 'none'; return; }
    catbar.style.display = 'flex';
    catchips.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.className = 'cat-chip' + (categoryFilter === 'all' ? ' active' : '');
    allChip.innerHTML = `Tutte <span class="count">${items.length}</span>`;
    allChip.addEventListener('click', () => { categoryFilter = 'all'; renderCategoryBar(); renderGrid(); });
    catchips.appendChild(allChip);
    cats.forEach(cat => {
      const count = items.filter(it => it.category === cat).length;
      const chip = document.createElement('button');
      chip.className = 'cat-chip' + (categoryFilter === cat ? ' active' : '');
      chip.innerHTML = `${cat} <span class="count">${count}</span>`;
      chip.addEventListener('click', () => { categoryFilter = cat; renderCategoryBar(); renderGrid(); });
      catchips.appendChild(chip);
    });
  }

  function visibleIndices(){
    const out = [];
    items.forEach((it, i) => {
      if(statusFilter !== 'all' && it.status !== statusFilter) return;
      if(categoryFilter !== 'all' && it.category !== categoryFilter) return;
      if(qualityFilter === 'quality-seria' && (it.qualityScore === undefined || it.qualityScore < 75)) return;
      if(qualityFilter === 'quality-discutibile' && (it.qualityScore === undefined || it.qualityScore < 40 || it.qualityScore >= 75)) return;
      if(qualityFilter === 'quality-meme' && (it.qualityScore === undefined || it.qualityScore >= 40)) return;
      out.push(i);
    });
    return out;
  }

  // animate=true SOLO quando compaiono item nuovi (dopo un import): un
  // filtro cliccato, un check completato o un rename di categoria non
  // aggiungono nulla di nuovo, quindi non serve far ripartire l'ingresso
  // a scaglioni su centinaia di card — è il motivo più concreto di lag
  // percepito su collezioni grandi, perché il costo non è l'animazione
  // in sé ma il fatto che venga richiesta su tutte le card insieme.
  function renderGrid(animate = false){
    grid.innerHTML = '';
    visibleIndices().forEach((i, pos) => {
      const it = items[i];
      const card = document.createElement('div');
      card.className = animate ? 'card' : 'card no-anim';
      card.dataset.status = it.status;
      card.dataset.uid = it.uid;
      if(animate) card.style.setProperty('--card-delay', `${Math.min(pos, 24) * 14}ms`);
      const hasIssues = it.issues && it.issues.length > 0;

      // Badge affidabilità (esito del controllo anomalie)
      let qualityBadge = '';
      if(it.qualityScore !== undefined){
        let qualityClass = 'quality-seria';
        let qualityText = 'OK';
        if(it.qualityScore < 40){
          qualityClass = 'quality-meme';
          qualityText = 'Sospetta';
        } else if(it.qualityScore < 75){
          qualityClass = 'quality-discutibile';
          qualityText = 'Da verificare';
        }
        const reasonText = (it.qualityReasons && it.qualityReasons.length)
          ? it.qualityReasons.join(' • ')
          : 'Nessuna anomalia tecnica rilevata';
        qualityBadge = `<span class="quality-badge ${qualityClass}" data-tooltip="${escapeAttr(`Affidabilità: ${it.qualityScore}/100 — ${reasonText}`)}">${qualityText}</span>`;
      }

      card.innerHTML = `
        <img src="${it.previewUrl || it.url}" alt="${it.displayName}" loading="lazy">
        <span class="cat-badge">${it.category}</span>
        <span class="status-pip"></span>
        ${hasIssues ? `<span class="issue-pip" data-tooltip="${escapeAttr(it.issues.join(' • '))}"><span class="icon icon-warning"></span></span>` : ''}
        <span class="idx">${String(i+1).padStart(3,'0')}</span>
        <span class="fname">${it.displayName}</span>
        ${it.modelType ? `<span class="model-pip ${it.modelType}">${it.modelType === 'slim' ? 'Slim' : 'Wide'}</span>` : ''}
        ${qualityBadge}
      `;
      card.addEventListener('click', () => openViewer(i));
      grid.appendChild(card);
    });
    updateProgress();
    updateControlCenterMeta();
  }

  // Tiene sincronizzati il badge sul pulsante e il riepilogo nel menu
  // del Centro Controlli con l'ultimo stato noto delle skin caricate.
  function updateControlCenterMeta(){
    const badge = document.getElementById('ccbBadge');
    const footer = document.getElementById('ccmFooter');
    if(!badge && !footer) return;

    const problemCount = items.filter(it => (it.issues && it.issues.length) || it.qualityType === 'meme').length;

    if(badge){
      if(problemCount > 0){
        badge.textContent = problemCount > 99 ? '99+' : String(problemCount);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    if(footer){
      if(items.length === 0){
        footer.textContent = '';
      } else {
        const checkedCount = items.filter(it => it.checked).length;
        const modelDetected = items.filter(it => it.modelType).length;
        if(checkedCount === 0 && modelDetected === 0){
          footer.textContent = 'Nessuna verifica ancora eseguita su questa sessione.';
        } else {
          const parts = [];
          parts.push(`${checkedCount}/${items.length} dimensioni verificate`);
          parts.push(`${modelDetected}/${items.length} modello rilevato`);
          parts.push(problemCount ? `${problemCount} con anomalie/segnalazioni` : 'nessuna anomalia rilevata');
          footer.textContent = `Ultimo stato: ${parts.join(' · ')}.`;
        }
      }
    }
  }

  function updateProgress(){
    const inScope = categoryFilter === 'all' ? items : items.filter(it => it.category === categoryFilter);
    const done = inScope.filter(it => it.status !== 'unreviewed').length;
    document.getElementById('progressLabel').textContent = `${done} / ${inScope.length} controllate`;
    document.getElementById('progressFill').style.width = inScope.length ? `${(done/inScope.length)*100}%` : '0%';
  }

  document.querySelectorAll('#filters button').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterValue = btn.dataset.filter;
      
      // Se è un filtro di qualità
      if(filterValue.startsWith('quality-')){
        document.querySelectorAll('#filters button[data-filter^="quality-"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        qualityFilter = filterValue;
      } else {
        // Se è un filtro di stato
        document.querySelectorAll('#filters button:not([data-filter^="quality-"])').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        statusFilter = filterValue;
      }
      
      renderGrid();
    });
  });

  // ---------- viewer ----------
  const viewer = document.getElementById('viewer');
  const stageCanvas = document.getElementById('stageCanvas');
  const stageFrame = document.getElementById('stageFrame');
  const modelBadge = document.getElementById('modelBadge');
  const renameInput = document.getElementById('renameInput');
  const viewerCatSelect = document.getElementById('viewerCatSelect');
  const viewerIndex = document.getElementById('viewerIndex');
  const filmstrip = document.getElementById('filmstrip');
  const approveBtn = document.getElementById('approveBtn');
  const flagBtn = document.getElementById('flagBtn');
  const uploadCatalogBtn = document.getElementById('uploadCatalogBtn');
  const rotateToggle = document.getElementById('rotateToggle');

  // ---------- Carica nel catalogo (solo admin) ----------
  // Il pulsante è marcato .admin-only e nascosto via CSS finché non
  // confermiamo, tramite /api/me, che l'utente collegato al Control Center
  // (index.html) è un admin. Se il revisore è aperto senza sessione admin
  // (es. index-all-in-one.html locale, senza server), resta nascosto.
  fetch('/api/me').then(r => r.ok ? r.json() : null).then(data => {
    if (data && data.user && data.user.role === 'admin') document.body.classList.add('is-admin');
  }).catch(() => {});

  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossibile leggere il file'));
      reader.readAsDataURL(file);
    });
  }

  if(uploadCatalogBtn){
    uploadCatalogBtn.addEventListener('click', async () => {
      const it = items[currentIndex];
      if(!it) return;
      uploadCatalogBtn.disabled = true;
      const originalLabel = uploadCatalogBtn.innerHTML;
      uploadCatalogBtn.innerHTML = '<span class="icon icon-archive"></span> Carico…';
      try{
        const imageDataUrl = await fileToDataUrl(it.file);
        const res = await fetch('/api/admin/catalog/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: it.displayName || it.name,
            model: it.modelType === 'slim' ? 'slim' : 'wide',
            tags: it.category ? [it.category] : [],
            imageDataUrl,
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if(!res.ok) throw new Error(payload.error || `Errore ${res.status}`);
        showToast('success', 'Skin caricata', `"${it.displayName || it.name}" è ora nel catalogo del Control Center.`);
      }catch(err){
        showToast('error', 'Caricamento non riuscito', err instanceof Error ? err.message : 'Riprova.');
      }finally{
        uploadCatalogBtn.disabled = false;
        uploadCatalogBtn.innerHTML = originalLabel;
      }
    });
  }

  let skinViewer = null;
  let currentAnim = 'idle';
  let renderToken = 0;

  function makeAnimation(kind){
    switch(kind){
      case 'walk': { const a = new skinview3d.WalkingAnimation(); a.speed = 1.4; return a; }
      case 'run': { const a = new skinview3d.RunningAnimation(); a.speed = 1.4; return a; }
      case 'wave': { const a = new skinview3d.WaveAnimation(); return a; }
      default: { const a = new skinview3d.IdleAnimation(); return a; }
    }
  }

  function ensureSkinViewer(){
    if(skinViewer) return skinViewer;
    const rect = stageFrame.getBoundingClientRect();
    skinViewer = new skinview3d.SkinViewer({
      canvas: stageCanvas,
      width: Math.max(280, Math.round(rect.width)),
      height: Math.max(320, Math.round(rect.height)),
    });
    skinViewer.fov = 55;
    skinViewer.zoom = 0.82;
    skinViewer.background = 0x0f1216;
    skinViewer.animation = makeAnimation(currentAnim);
    window.addEventListener('resize', () => {
      const r = stageFrame.getBoundingClientRect();
      skinViewer.width = Math.max(280, Math.round(r.width));
      skinViewer.height = Math.max(320, Math.round(r.height));
    });
    return skinViewer;
  }

  // ---------- anteprime 3D nella griglia ----------
  // Invece del PNG piatto, ogni card mostra uno screenshot renderizzato
  // in 3D della skin. Un solo canvas nascosto e riusato in sequenza per
  // tutte le skin (mai uno per card: con centinaia di skin si esaurirebbero
  // i contesti WebGL che il browser concede). Ogni scatto viene fatto una
  // sola volta e messo in cache su it.previewUrl; se WebGL non è
  // disponibile, si ricade silenziosamente sul PNG piatto di sempre.
  let thumbViewer = null;
  let thumbCanvas = null;
  let thumbGenerationDisabled = false;

  function ensureThumbViewer(){
    if(thumbViewer) return thumbViewer;
    thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 176;
    thumbCanvas.height = 176;
    thumbCanvas.style.cssText = 'position:fixed; left:-9999px; top:-9999px; pointer-events:none;';
    document.body.appendChild(thumbCanvas);
    thumbViewer = new skinview3d.SkinViewer({
      canvas: thumbCanvas,
      width: 176,
      height: 176,
      preserveDrawingBuffer: true, // necessario per poter catturare il canvas con toBlob
    });
    thumbViewer.fov = 50;
    thumbViewer.zoom = 0.64; // più "zoomato indietro" del viewer principale: qui la figura è intera, non solo il busto
    thumbViewer.background = null; // trasparente, si fonde con lo sfondo della card
    thumbViewer.playerObject.rotation.y = -0.5; // leggero 3/4 invece di un frontale piatto
    return thumbViewer;
  }

  function waitTwoFrames(){
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function renderSkinThumbnail(it){
    if(thumbGenerationDisabled) return null;
    let tv;
    try{
      tv = ensureThumbViewer();
    }catch(err){
      console.error('Anteprime 3D non disponibili (WebGL mancante?):', err);
      thumbGenerationDisabled = true;
      return null;
    }
    try{
      await tv.loadSkin(it.url, { model: 'auto-detect' });
      await waitTwoFrames();
      const blob = await new Promise(resolve => thumbCanvas.toBlob(resolve, 'image/png'));
      return blob ? URL.createObjectURL(blob) : null;
    }catch(err){
      console.error('Errore generazione anteprima 3D per', it.name, err);
      return null;
    }
  }

  function updateCardImage(it){
    if(!it.previewUrl) return;
    const img = grid.querySelector(`.card[data-uid="${it.uid}"] img`);
    if(img){
      img.classList.add('swap');
      img.src = it.previewUrl;
      img.onload = () => img.classList.remove('swap');
    }
    const filmImg = filmstrip.querySelector(`img[data-uid="${it.uid}"]`);
    if(filmImg) filmImg.src = it.previewUrl;
  }

  // coda: le skin passano una alla volta sull'unico canvas condiviso,
  // così più import consecutivi (o import mentre uno precedente è ancora
  // in corso) non si accavallano sulla stessa istanza
  let thumbQueue = [];
  let thumbQueueRunning = false;

  function queueThumbnails(newItems){
    if(thumbGenerationDisabled) return;
    thumbQueue.push(...newItems);
    if(!thumbQueueRunning) runThumbQueue();
  }

  async function runThumbQueue(){
    thumbQueueRunning = true;
    while(thumbQueue.length){
      const it = thumbQueue.shift();
      if(it.previewUrl || it.previewFailed || thumbGenerationDisabled) continue;
      const url = await renderSkinThumbnail(it);
      if(url){
        it.previewUrl = url;
        updateCardImage(it);
      } else {
        it.previewFailed = true;
      }
    }
    thumbQueueRunning = false;
  }


  // Usa lo stesso rilevatore integrato in skinview3d (analisi dei pixel
  // trasparenti sulle braccia) così il risultato coincide sempre con
  // quello mostrato nel visualizzatore 3D quando apri una singola skin.
  async function detectModelType(url){
    const sv = ensureSkinViewer();
    try{
      await sv.loadSkin(url, { model: 'auto-detect', makeVisible: false });
      const mt = sv.playerObject?.skin?.modelType;
      return mt === 'slim' ? 'slim' : 'wide';
    }catch(err){
      console.error('Errore rilevamento modello skin:', err);
      return 'wide'; // fallback prudente: modello classico
    }
  }

  async function ensureModelsDetected(onProgress){
    const targets = items.filter(it => !it.modelType);
    for(let i = 0; i < targets.length; i++){
      if(onProgress) onProgress(i + 1, targets.length);
      targets[i].modelType = await detectModelType(targets[i].url);
    }
    return targets.length;
  }

  function checkImageDimensions(url){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, ok: true });
      img.onerror = () => resolve({ width: 0, height: 0, ok: false });
      img.src = url;
    });
  }

  function evaluateSkinIssues(dim){
    const issues = [];
    if(!dim.ok){
      issues.push('Immagine non leggibile o file corrotto');
      return issues;
    }
    const w = dim.width, h = dim.height;
    const isSquare = w === h;
    const isLegacy = w === h * 2;
    if(!isSquare && !isLegacy){
      issues.push(`Dimensioni non valide (${w}×${h}px) — attese quadrate o 2:1`);
    } else if(w % 64 !== 0){
      issues.push(`Risoluzione non multipla di 64px (${w}×${h}px)`);
    }
    if(isLegacy){
      issues.push('Formato legacy 64×32 (senza secondo layer/braccia complete)');
    }
    return issues;
  }

  // ============================================================
  // I tre controlli sono funzioni indipendenti e riusabili: ognuna
  // può girare da sola (pulsante dedicato) oppure essere incatenata
  // da runAllChecks() con opts.silent per evitare notifiche doppie.
  // ============================================================

  async function runDimensionCheck(progressBtn, opts = {}){
    if(items.length === 0) return 0;
    const originalLabel = progressBtn ? progressBtn.textContent : null;
    if(progressBtn && !opts.silent) progressBtn.disabled = true;
    let problemCount = 0;
    for(let i = 0; i < items.length; i++){
      const it = items[i];
      if(progressBtn) progressBtn.textContent = `Verifico dimensioni ${i+1} / ${items.length}…`;
      const dim = await checkImageDimensions(it.url);
      const issues = evaluateSkinIssues(dim);
      it.issues = issues;
      it.checked = true;
      if(issues.length){
        problemCount++;
        if(it.status === 'unreviewed') it.status = 'flagged';
      }
    }
    if(progressBtn && !opts.silent){
      progressBtn.disabled = false;
      progressBtn.textContent = originalLabel;
    }
    if(!opts.skipRender){ renderGrid(); updateProgress(); }
    if(!opts.silent){
      if(problemCount === 0) showToast('success', 'Dimensioni verificate', `Tutte le ${items.length} skin hanno un formato valido.`);
      else showToast('warning', 'Dimensioni verificate', `${problemCount} skin su ${items.length} hanno dimensioni/formato non validi.`);
    }
    return problemCount;
  }

  async function runModelCheck(progressBtn, opts = {}){
    if(items.length === 0) return { slimCount: 0, wideCount: 0 };
    const originalLabel = progressBtn ? progressBtn.textContent : null;
    if(progressBtn && !opts.silent) progressBtn.disabled = true;
    const missing = items.filter(it => !it.modelType).length;
    if(missing === 0 && !opts.silent){
      // già tutto rilevato: un click diretto sul pulsante ri-rileva da zero
      items.forEach(it => { it.modelType = null; });
    }
    await ensureModelsDetected((done, tot) => {
      if(progressBtn) progressBtn.textContent = `Rilevo modello ${done} / ${tot}…`;
    });
    if(progressBtn && !opts.silent){
      progressBtn.disabled = false;
      progressBtn.textContent = originalLabel;
    }
    if(!opts.skipRender) renderGrid();
    const slimCount = items.filter(it => it.modelType === 'slim').length;
    const wideCount = items.length - slimCount;
    if(!opts.silent){
      showToast('success', 'Modelli rilevati', `${slimCount} slim, ${wideCount} wide su ${items.length} skin totali.`);
    }
    return { slimCount, wideCount };
  }

  async function runAnomalyCheck(progressBtn, opts = {}){
    if(items.length === 0) return { suspectCount: 0, reviewCount: 0, okCount: 0 };
    const originalLabel = progressBtn ? progressBtn.textContent : null;
    if(progressBtn && !opts.silent) progressBtn.disabled = true;
    let suspectCount = 0, reviewCount = 0, okCount = 0;
    for(let i = 0; i < items.length; i++){
      const it = items[i];
      if(progressBtn) progressBtn.textContent = `Analizzo anomalie ${i+1} / ${items.length}…`;
      const result = await analyzeQuality(it.url);
      it.qualityScore = result.qualityScore;
      it.qualityType = result.quality;
      it.qualityReasons = result.reasons;
      if(result.quality === 'meme') suspectCount++;
      else if(result.quality === 'discutibile') reviewCount++;
      else okCount++;
    }
    if(progressBtn && !opts.silent){
      progressBtn.disabled = false;
      progressBtn.textContent = originalLabel;
    }
    if(!opts.skipRender) renderGrid();
    if(!opts.silent){
      if(suspectCount === 0 && reviewCount === 0){
        showToast('success', 'Anomalie verificate', `Nessun segnale sospetto su ${items.length} skin.`);
      } else {
        showToast('warning', 'Anomalie verificate', `${okCount} OK, ${reviewCount} da verificare, ${suspectCount} sospette.`);
      }
    }
    return { suspectCount, reviewCount, okCount };
  }

  async function runAllChecks(progressBtn){
    if(items.length === 0) return;
    const originalLabel = progressBtn ? progressBtn.textContent : null;
    if(progressBtn) progressBtn.disabled = true;

    if(progressBtn) progressBtn.textContent = 'Controllo dimensioni…';
    const problemCount = await runDimensionCheck(progressBtn, { silent: true, skipRender: true });

    if(progressBtn) progressBtn.textContent = 'Rilevo slim/wide…';
    await runModelCheck(progressBtn, { silent: true, skipRender: true });

    if(progressBtn) progressBtn.textContent = 'Cerco anomalie…';
    const { suspectCount, reviewCount } = await runAnomalyCheck(progressBtn, { silent: true, skipRender: true });

    if(progressBtn){
      progressBtn.disabled = false;
      progressBtn.textContent = originalLabel;
    }
    renderGrid();
    updateProgress();

    const parts = [];
    if(problemCount) parts.push(`${problemCount} con formato non valido`);
    if(suspectCount) parts.push(`${suspectCount} sospette`);
    if(reviewCount) parts.push(`${reviewCount} da verificare`);

    if(parts.length === 0){
      showToast('success', 'Controllo completo', `Tutte le ${items.length} skin hanno superato tutti i controlli.`);
    } else {
      showToast('warning', 'Controllo completo', `Su ${items.length} skin: ${parts.join(', ')}.`);
    }
  }

  // ---------- overlay/pannello condivisi (Centro Controlli + Organizza Cartelle) ----------
  function openAppPanel(overlay, panel, staggerItems){
    overlay.style.display = 'flex';
    if(window.gsap){
      const targets = (staggerItems && staggerItems.length) ? staggerItems : [];
      gsap.killTweensOf([overlay, panel, ...targets]);
      gsap.set(overlay, { opacity: 0 });
      gsap.set(panel, { opacity: 0, scale: 0.92, y: 18 });
      if(targets.length) gsap.set(targets, { opacity: 0, y: 14 });
      gsap.to(overlay, { opacity: 1, duration: 0.2, ease: 'power2.out' });
      gsap.to(panel, { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: 'back.out(1.7)' });
      if(targets.length) gsap.to(targets, { opacity: 1, y: 0, duration: 0.28, stagger: 0.05, delay: 0.08, ease: 'power2.out' });
    } else {
      overlay.classList.add('visible');
    }
  }

  function closeAppPanel(overlay, panel, onDone){
    if(window.gsap){
      gsap.to(panel, { opacity: 0, scale: 0.94, y: 10, duration: 0.15, ease: 'power1.in' });
      gsap.to(overlay, {
        opacity: 0, duration: 0.16, ease: 'power1.in',
        onComplete: () => { overlay.style.display = 'none'; if(onDone) onDone(); }
      });
    } else {
      overlay.style.display = 'none';
      if(onDone) onDone();
    }
  }

  function isAnyPanelOpen(){
    return controlCenterOverlay.style.display === 'flex' || folderManagerOverlay.style.display === 'flex';
  }

  // ---------- Centro Controlli: menu animato con GSAP ----------
  const controlCenterBtn = document.getElementById('controlCenterBtn');
  const controlCenterOverlay = document.getElementById('controlCenterOverlay');
  const controlCenterMenu = document.getElementById('controlCenterMenu');
  const ccmItems = Array.from(document.querySelectorAll('.ccm-item'));

  controlCenterBtn.addEventListener('click', () => {
    if(items.length === 0){
      showToast('warning', 'Nessuna skin caricata', 'Carica prima delle skin, poi apri il centro controlli.');
      return;
    }
    openAppPanel(controlCenterOverlay, controlCenterMenu, ccmItems);
  });
  document.getElementById('ccmClose').addEventListener('click', () => closeAppPanel(controlCenterOverlay, controlCenterMenu));
  controlCenterOverlay.addEventListener('click', e => {
    if(e.target === controlCenterOverlay) closeAppPanel(controlCenterOverlay, controlCenterMenu);
  });
  ccmItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const check = btn.dataset.check;
      closeAppPanel(controlCenterOverlay, controlCenterMenu, () => {
        if(check === 'dimension') runDimensionCheck(controlCenterBtn);
        else if(check === 'model') runModelCheck(controlCenterBtn);
        else if(check === 'anomaly') runAnomalyCheck(controlCenterBtn);
        else if(check === 'all') runAllChecks(controlCenterBtn);
      });
    });
  });

  // ---------- Organizza Cartelle: rinomina / unisci / riordina categorie ----------
  const folderManagerBtn = document.getElementById('folderManagerBtn');
  const folderManagerOverlay = document.getElementById('folderManagerOverlay');
  const folderManagerPanel = document.getElementById('folderManagerPanel');
  const folderList = document.getElementById('folderList');

  function renderFolderManager(){
    syncCategoryOrder();
    folderList.innerHTML = '';
    categoryOrder.forEach((cat, idx) => {
      const count = items.filter(it => it.category === cat).length;
      const row = document.createElement('div');
      row.className = 'folder-row';
      row.innerHTML = `
        <div class="folder-order">
          <button type="button" data-dir="-1" ${idx === 0 ? 'disabled' : ''} data-tooltip="Sposta su">▲</button>
          <button type="button" data-dir="1" ${idx === categoryOrder.length - 1 ? 'disabled' : ''} data-tooltip="Sposta giù">▼</button>
        </div>
        <span class="folder-icon"><span class="icon icon-folder"></span></span>
        <input type="text" value="${escapeAttr(cat)}" data-tooltip="Rinomina questa cartella (Invio per applicare)">
        <span class="folder-count">${count}</span>
        <button type="button" class="folder-apply" data-tooltip="Applica la rinomina"><span class="icon icon-check"></span></button>
      `;
      const input = row.querySelector('input');
      const applyBtn = row.querySelector('.folder-apply');
      const original = cat;
      const markDirty = () => row.classList.toggle('dirty', input.value.trim() !== '' && input.value.trim() !== original);
      input.addEventListener('input', markDirty);
      input.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); applyRename(); } });
      function applyRename(){
        const newName = input.value.trim();
        if(!newName || newName === original) return;
        const merged = renameCategory(original, newName);
        renderFolderManager();
        showToast('success', merged ? 'Cartelle unite' : 'Cartella rinominata',
          merged ? `"${original}" è stata unita a "${newName}".` : `Ora si chiama "${newName}".`);
      }
      applyBtn.addEventListener('click', applyRename);
      row.querySelectorAll('.folder-order button').forEach(btn => {
        btn.addEventListener('click', () => moveCategoryOrder(original, parseInt(btn.dataset.dir, 10)));
      });
      folderList.appendChild(row);
    });
  }

  folderManagerBtn.addEventListener('click', () => {
    if(items.length === 0){
      showToast('warning', 'Nessuna skin caricata', 'Carica prima delle skin, poi organizza le cartelle.');
      return;
    }
    renderFolderManager();
    openAppPanel(folderManagerOverlay, folderManagerPanel, Array.from(folderList.querySelectorAll('.folder-row')));
  });
  document.getElementById('fmClose').addEventListener('click', () => closeAppPanel(folderManagerOverlay, folderManagerPanel));
  folderManagerOverlay.addEventListener('click', e => {
    if(e.target === folderManagerOverlay) closeAppPanel(folderManagerOverlay, folderManagerPanel);
  });

  const folderNewInput = document.getElementById('folderNewInput');
  const folderNewBtn = document.getElementById('folderNewBtn');
  folderNewBtn.addEventListener('click', () => {
    if(createEmptyCategory(folderNewInput.value)){
      const created = folderNewInput.value.trim();
      folderNewInput.value = '';
      renderFolderManager();
      showToast('success', 'Cartella creata', `"${created}" è pronta: assegnale delle skin dal visualizzatore.`);
    }
  });
  folderNewInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); folderNewBtn.click(); } });

  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(controlCenterOverlay.style.display === 'flex') closeAppPanel(controlCenterOverlay, controlCenterMenu);
    else if(folderManagerOverlay.style.display === 'flex') closeAppPanel(folderManagerOverlay, folderManagerPanel);
  });

  function openViewer(index){
    currentIndex = index;
    viewer.classList.add('open');
    requestAnimationFrame(() => { ensureSkinViewer(); renderStage(); });
    renderFilmstrip();
  }

  function populateCategorySelect(){
    const cats = getCategories();
    const current = items[currentIndex].category;
    viewerCatSelect.innerHTML = '';
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      if(cat === current) opt.selected = true;
      viewerCatSelect.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Nuova categoria…';
    viewerCatSelect.appendChild(newOpt);
  }

  viewerCatSelect.addEventListener('change', () => {
    if(currentIndex < 0) return;
    if(viewerCatSelect.value === '__new__'){
      const name = prompt('Nome della nuova categoria:');
      if(name && name.trim()){
        items[currentIndex].category = name.trim();
      }
    } else {
      items[currentIndex].category = viewerCatSelect.value;
    }
    populateCategorySelect();
    renderCategoryBar();
  });

  renameInput.addEventListener('change', () => {
    if(currentIndex < 0) return;
    const val = renameInput.value.trim();
    items[currentIndex].displayName = val || items[currentIndex].name;
    renameInput.value = items[currentIndex].displayName;
    renderFilmstrip();
  });
  renameInput.addEventListener('keydown', e => { if(e.key === 'Enter') renameInput.blur(); });

  async function renderStage(){
    const it = items[currentIndex];
    const myToken = ++renderToken;
    renameInput.value = it.displayName;
    populateCategorySelect();
    viewerIndex.textContent = `${currentIndex+1} / ${items.length}`;
    approveBtn.classList.toggle('active', it.status === 'approved');
    flagBtn.classList.toggle('active', it.status === 'flagged');
    document.getElementById('prevBtn').disabled = currentIndex === 0;
    document.getElementById('nextBtn').disabled = currentIndex === items.length - 1;
    modelBadge.textContent = '—';
    stageFrame.classList.add('loading');

    const sv = ensureSkinViewer();
    try{
      await sv.loadSkin(it.url);
      if(myToken !== renderToken) return; // navigazione più recente nel frattempo
      const modelType = sv.playerObject?.skin?.modelType;
      it.modelType = modelType === 'slim' ? 'slim' : 'wide';
      modelBadge.textContent = modelType === 'slim' ? 'Modello slim' : 'Modello classic';
      stageFrame.classList.remove('loading');
      const old = stageFrame.querySelector('.scanline');
      if(old) old.remove();
      const sl = document.createElement('div');
      sl.className = 'scanline';
      stageFrame.insertBefore(sl, stageFrame.firstChild.nextSibling);
      setTimeout(() => sl.remove(), 1200);
    }catch(err){
      if(myToken !== renderToken) return;
      stageFrame.classList.remove('loading');
      modelBadge.textContent = 'Texture non valida';
      console.error('Errore caricamento skin:', err);
    }
  }

  document.querySelectorAll('.chip.anim').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip.anim').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentAnim = btn.dataset.anim;
      if(skinViewer) skinViewer.animation = makeAnimation(currentAnim);
    });
  });

  rotateToggle.addEventListener('click', () => {
    rotateToggle.classList.toggle('active');
    if(skinViewer) skinViewer.autoRotate = rotateToggle.classList.contains('active');
  });

  function renderFilmstrip(){
    filmstrip.innerHTML = '';
    items.forEach((it, i) => {
      const img = document.createElement('img');
      img.src = it.previewUrl || it.url;
      img.dataset.uid = it.uid;
      img.className = i === currentIndex ? 'active' : '';
      img.dataset.tooltip = `${it.displayName} · ${it.category}`;
      img.addEventListener('click', () => { currentIndex = i; renderStage(); renderFilmstrip(); });
      filmstrip.appendChild(img);
    });
    const activeThumb = filmstrip.querySelector('.active');
    if(activeThumb) activeThumb.scrollIntoView({inline:'center', block:'nearest'});
  }

  function setStatus(status){
    const it = items[currentIndex];
    const newStatus = (it.status === status) ? 'unreviewed' : status;
    it.status = newStatus;
    renderStage();
    updateProgress();

    // feedback visivo immediato: pulsante che "pulsa" + bagliore sul frame
    const btn = status === 'approved' ? approveBtn : flagBtn;
    btn.classList.remove('pulse');
    void btn.offsetWidth; // riavvia l'animazione anche su click ravvicinati
    btn.classList.add('pulse');

    stageFrame.classList.remove('flash-approve', 'flash-flag');
    if(newStatus === 'approved'){
      void stageFrame.offsetWidth;
      stageFrame.classList.add('flash-approve');
    } else if(newStatus === 'flagged'){
      void stageFrame.offsetWidth;
      stageFrame.classList.add('flash-flag');
    }
  }

  approveBtn.addEventListener('click', () => setStatus('approved'));
  flagBtn.addEventListener('click', () => setStatus('flagged'));

  function goTo(delta){
    const next = currentIndex + delta;
    if(next < 0 || next >= items.length) return;
    currentIndex = next;
    renderStage();
    renderFilmstrip();
  }
  document.getElementById('prevBtn').addEventListener('click', () => goTo(-1));
  document.getElementById('nextBtn').addEventListener('click', () => goTo(1));

  function closeViewer(){
    viewer.classList.remove('open');
    renderCategoryBar();
    renderGrid();
  }
  document.getElementById('closeViewer').addEventListener('click', closeViewer);
  viewer.addEventListener('click', e => { if(e.target === viewer) closeViewer(); });

  // ---------- controlli da tastiera: frecce e WASD ----------
  // W / ↑  → approvata        S / ↓  → da correggere
  // A / ←  → skin precedente  D / →  → skin successiva
  document.addEventListener('keydown', e => {
    if(!viewer.classList.contains('open')) return;
    const typing = document.activeElement === renameInput || document.activeElement === viewerCatSelect;
    if(e.key === 'Escape'){ closeViewer(); return; }
    if(typing) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if(key === 'ArrowRight' || key === 'd'){ e.preventDefault(); goTo(1); }
    else if(key === 'ArrowLeft' || key === 'a'){ e.preventDefault(); goTo(-1); }
    else if(key === 'ArrowUp' || key === 'w'){ e.preventDefault(); setStatus('approved'); }
    else if(key === 'ArrowDown' || key === 's'){ e.preventDefault(); setStatus('flagged'); }
  });

  // ---------- export ----------
  function buildReportCSV(onlyApproved = false){
    const lines = ['categoria,nome_originale,nome_attuale,stato,modello,affidabilita,affidabilita_score'];
    const toExport = onlyApproved ? items.filter(it => it.status === 'approved') : items;
    const affidabilitaLabel = it => {
      if(it.qualityScore === undefined) return 'non controllata';
      if(it.qualityScore < 40) return 'sospetta';
      if(it.qualityScore < 75) return 'da verificare';
      return 'ok';
    };
    toExport.forEach(it => {
      const esc = s => `"${String(s).replace(/"/g,'""')}"`;
      lines.push([esc(it.category), esc(it.name), esc(it.displayName), statusLabel(it.status), esc(it.modelType || 'sconosciuto'), esc(affidabilitaLabel(it)), esc(it.qualityScore ?? 'N/D')].join(','));
    });
    return lines.join('\n');
  }

  document.getElementById('exportBtn').addEventListener('click', async () => {
    if(items.length === 0) return;
    const btn = document.getElementById('exportBtn');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    await ensureModelsDetected((done, total) => {
      btn.textContent = `Rilevo modello ${done} / ${total}…`;
    });
    btn.textContent = originalLabel;
    const blob = new Blob([buildReportCSV()], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'report_controllo_skin.csv';
    a.click();
    URL.revokeObjectURL(url);
    btn.disabled = false;
    renderGrid();
    showToast('success', 'Report esportato', 'Il file CSV è stato scaricato.');
  });

  document.getElementById('exportZipBtn').addEventListener('click', async () => {
    if(items.length === 0) return;
    const btn = document.getElementById('exportZipBtn');
    const originalLabel = btn.textContent;
    btn.disabled = true;

    // rileva slim/wide per le skin non ancora analizzate, prima di comprimere
    await ensureModelsDetected((done, total) => {
      btn.textContent = `Rilevo modello ${done} / ${total}…`;
    });

    const zip = new JSZip();
    const usedNames = {}; // per cartella (radice modello + categoria), per evitare sovrascritture di nomi duplicati

    function extOf(filename){
      const m = filename.match(/\.[a-zA-Z0-9]+$/);
      return m ? m[0] : '.png';
    }
    function baseName(filename){
      return filename.replace(/\.[a-zA-Z0-9]+$/, '');
    }
    function safeSegment(s){
      return String(s).replace(/[\\/:*?"<>|]/g, '_').trim() || 'senza-nome';
    }

    // Esporta SOLO le skin approvate
    const approvedItems = items.filter(it => it.status === 'approved');
    if(approvedItems.length === 0){
      showToast('warning', 'Nessuna skin approvata', 'Approva almeno una skin prima di esportare.');
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }

    for(let i = 0; i < approvedItems.length; i++){
      const it = approvedItems[i];
      btn.textContent = `Comprimo ${i+1} / ${approvedItems.length}…`;

      // radice separata per modello: stesse categorie, ma Wide e Slim non si mescolano mai
      const modelRoot = it.modelType === 'slim' ? 'Slim' : 'Wide';
      const folderPath = modelRoot + '/' + it.category.split('/').map(p => safeSegment(p.trim())).join('/');
      // il nome scelto dall'utente potrebbe già avere un'estensione o no
      const hasExt = /\.[a-zA-Z0-9]+$/.test(it.displayName);
      let finalName = hasExt ? safeSegment(it.displayName) : safeSegment(baseName(it.displayName)) + extOf(it.name);

      const key = folderPath + '/' + finalName.toLowerCase();
      if(usedNames[key] !== undefined){
        usedNames[key]++;
        const n = usedNames[key];
        finalName = (hasExt ? safeSegment(baseName(finalName)) : safeSegment(baseName(it.displayName))) + `_${n}` + extOf(finalName);
      } else {
        usedNames[key] = 0;
      }

      const fullPath = folderPath + '/' + finalName;
      zip.file(fullPath, it.file);
    }

    // includo anche il report (solo approvate) come promemoria dentro allo zip
    zip.file('report_controllo_skin.csv', buildReportCSV(true));

    btn.textContent = 'Genero lo ZIP…';
    try{
      const blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE', compressionOptions: {level: 6}});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'skin-approvate.zip';
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'ZIP generato', `${approvedItems.length} skin approvate esportate nelle cartelle Wide/ e Slim/.`);
    }catch(err){
      console.error('Errore generazione ZIP:', err);
      showToast('error', 'Errore ZIP', 'Non sono riuscito a generare lo ZIP. Riprova.');
    }finally{
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
})();
