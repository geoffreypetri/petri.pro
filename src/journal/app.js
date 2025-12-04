// Configuration IndexedDB
const DB_NAME = "flux";
const DB_VERSION = 1;
const STORE_NAME = "entries";

let db = null;

// Ouverture / création de la base IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Erreur d'ouverture IndexedDB :", event.target.error);
      reject(event.target.error);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by_createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
  });
}

// Ajout d'une entrée
function addEntry(text) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("DB non initialisée"));
      return;
    }

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const now = new Date();

    const entry = {
      text,
      createdAt: now.toISOString(),
    };

    const request = store.add(entry);

    request.onsuccess = () => {
      resolve({ ...entry, id: request.result });
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Mise à jour d'une entrée (sans toucher à createdAt)
function updateEntry(id, newText) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("DB non initialisée"));
      return;
    }

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onerror = (event) => {
      reject(event.target.error);
    };

    getReq.onsuccess = (event) => {
      const entry = event.target.result;
      if (!entry) {
        reject(new Error("Entrée introuvable"));
        return;
      }
      entry.text = newText;

      const putReq = store.put(entry);
      putReq.onsuccess = () => resolve(entry);
      putReq.onerror = (e) => reject(e.target.error);
    };
  });
}

// Récupération de toutes les entrées
function getAllEntries() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("DB non initialisée"));
      return;
    }

    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("by_createdAt");

    const entries = [];
    const request = index.openCursor(null, "prev"); // plus récent d'abord

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        entries.push(cursor.value);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/* ----- UI helpers ----- */

const form = document.getElementById("entry-form");
const textarea = document.getElementById("thought");
const mainSendBtn = form.querySelector(".journal-send");
const statusEl = document.getElementById("form-status");
const entriesContainer = document.getElementById("entries-container");
const exportBtn = document.getElementById("export-btn");

function setStatus(message) {
  statusEl.textContent = message || "";
}

// Auto-resize d’un textarea
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

/**
 * Comportement commun d’un éditeur :
 * - auto-resize
 * - Enter = submit, Shift+Enter = nouvelle ligne
 * - clic sur la flèche = submit (si sendButton fourni)
 */
function attachEditorBehavior(textareaEl, sendButtonEl, onSubmit, options = {}) {
  const { initialAutoResize = false } = options;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const value = textareaEl.value.trim();
      if (!value) return;
      onSubmit(value);
    }
    // Shift+Enter => comportement natif (nouvelle ligne)
  };

  const handleInput = () => {
    autoResize(textareaEl);
  };

  textareaEl.addEventListener("keydown", handleKeyDown);
  textareaEl.addEventListener("input", handleInput);

  let handleClick;
  if (sendButtonEl) {
    handleClick = () => {
      const value = textareaEl.value.trim();
      if (!value) return;
      onSubmit(value);
    };
    sendButtonEl.addEventListener("click", handleClick);
  }

  if (initialAutoResize) {
    autoResize(textareaEl);
  }

  // Fonction de nettoyage
  return () => {
    textareaEl.removeEventListener("keydown", handleKeyDown);
    textareaEl.removeEventListener("input", handleInput);
    if (sendButtonEl && handleClick) {
      sendButtonEl.removeEventListener("click", handleClick);
    }
  };
}

/* Groupement par jour */

function groupEntriesByDay(entries) {
  const groups = new Map();

  for (const entry of entries) {
    const dayKey = entry.createdAt.slice(0, 10); // YYYY-MM-DD
    if (!groups.has(dayKey)) {
      groups.set(dayKey, []);
    }
    groups.get(dayKey).push(entry);
  }

  const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
    a < b ? 1 : a > b ? -1 : 0
  );

  return { groups, sortedKeys };
}

function formatDayHeader(dateString) {
  const d = new Date(dateString);
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTime(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/* Rendu */

function renderEntries(entries) {
  entriesContainer.innerHTML = "";

  if (!entries || entries.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Aucune entrée pour l’instant.";
    empty.className = "entries-empty";
    entriesContainer.appendChild(empty);
    return;
  }

  const { groups, sortedKeys } = groupEntriesByDay(entries);

  for (const dayKey of sortedKeys) {
    const dayEntries = groups.get(dayKey);

    const daySection = document.createElement("section");
    daySection.className = "day-group";

    const header = document.createElement("div");
    header.className = "day-group-header";

    const title = document.createElement("div");
    title.className = "day-group-title";
    title.textContent = formatDayHeader(dayKey);

    const meta = document.createElement("div");
    meta.className = "day-group-meta";
    meta.textContent =
      dayEntries.length === 1
        ? "1 entrée"
        : `${dayEntries.length} entrées`;

    header.appendChild(title);
    header.appendChild(meta);

    const list = document.createElement("ul");
    list.className = "entry-list";

    for (const entry of dayEntries) {
      const li = document.createElement("li");
      li.className = "entry-item";
      li.dataset.entryId = entry.id;

      const timeEl = document.createElement("time");
      timeEl.className = "entry-time";
      timeEl.dateTime = entry.createdAt;
      timeEl.textContent = formatTime(entry.createdAt);

      const content = document.createElement("p");
      content.className = "entry-content";
      content.textContent = entry.text;

      li.appendChild(timeEl);
      li.appendChild(content);
      list.appendChild(li);
    }

    daySection.appendChild(header);
    daySection.appendChild(list);
    entriesContainer.appendChild(daySection);
  }
}

/* ----- Export Markdown ----- */

function buildMarkdown(entries) {
  if (!entries || entries.length === 0) {
    return "# Journal\n\n(Aucune entrée)\n";
  }

  const { groups, sortedKeys } = groupEntriesByDay(entries);
  const lines = [];

  for (const dayKey of sortedKeys) {
    lines.push(`## ${dayKey}`, "");

    const dayEntries = groups.get(dayKey);
    for (const entry of dayEntries) {
      const timeStr = formatTime(entry.createdAt);
      lines.push(`${timeStr} ${entry.text}`, "");
    }
  }

  return lines.join("\n");
}

async function handleExportClick() {
  try {
    const entries = await getAllEntries();
    if (!entries || entries.length === 0) {
      setStatus("Aucune entrée à exporter.");
      return;
    }

    const markdown = buildMarkdown(entries);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);

    const a = document.createElement("a");
    a.href = url;
    a.download = `journal-${today}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus("Export Markdown généré.");
  } catch (error) {
    console.error(error);
    setStatus("Erreur lors de l’export.");
  }
}

/* ----- Édition inline ----- */

async function startInlineEdit(li, entryId, initialText) {
  if (li.dataset.editing === "true") return;
  li.dataset.editing = "true";

  const contentEl = li.querySelector(".entry-content");
  if (!contentEl) return;

  const wrapper = document.createElement("div");
  wrapper.className = "journal-row entry-edit-row";

  const textareaEdit = document.createElement("textarea");
  textareaEdit.className = "journal-input entry-edit-input";
  textareaEdit.value = initialText;

  // Caler la hauteur initiale sur le paragraphe existant
  const previousHeight = contentEl.offsetHeight;
  if (previousHeight > 0) {
    textareaEdit.style.height = previousHeight + "px";
  }

  wrapper.appendChild(textareaEdit);
  contentEl.replaceWith(wrapper);

  textareaEdit.focus();
  textareaEdit.setSelectionRange(
    textareaEdit.value.length,
    textareaEdit.value.length
  );

  let finished = false;
  let detach = null;

  const finish = async (saveChanges) => {
    if (finished) return;
    finished = true;

    if (detach) detach();

    li.removeAttribute("data-editing");

    if (!saveChanges) {
      const entries = await getAllEntries();
      renderEntries(entries);
      return;
    }

    try {
      const newText = textareaEdit.value;
      await updateEntry(entryId, newText);
      const entries = await getAllEntries();
      renderEntries(entries);
      setStatus("Entrée mise à jour.");
    } catch (error) {
      console.error(error);
      setStatus("Erreur lors de la mise à jour.");
    }
  };

  // Comportement commun (Enter / Shift+Enter / auto-resize à partir de la saisie)
  detach = attachEditorBehavior(textareaEdit, null, async () => {
    await finish(true);
  }, { initialAutoResize: false });

  // Blur = enregistrement (après un petit délai pour laisser Enter finir)
  textareaEdit.addEventListener("blur", () => {
    setTimeout(() => finish(true), 0);
  });
}

// Délégation de clic : clic sur le texte => édition
entriesContainer.addEventListener("click", (event) => {
  const content = event.target.closest(".entry-content");
  if (!content) return;

  const li = content.closest(".entry-item");
  if (!li) return;

  const id = Number(li.dataset.entryId);
  if (!Number.isFinite(id)) return;

  const currentText = content.textContent || "";
  startInlineEdit(li, id, currentText);
});

/* ----- Initialisation & création ----- */

async function init() {
  try {
    await openDatabase();
    const entries = await getAllEntries();
    renderEntries(entries);
  } catch (error) {
    console.error(error);
    setStatus("Impossible d’ouvrir la base locale.");
  }
}

// Création d'entrée (champ principal)
attachEditorBehavior(
  textarea,
  mainSendBtn,
  async (value) => {
    try {
      await addEntry(value);
      setStatus("Entrée enregistrée.");
      textarea.value = "";
      autoResize(textarea);
      textarea.focus();

      const entries = await getAllEntries();
      renderEntries(entries);
    } catch (error) {
      console.error(error);
      setStatus("Erreur lors de l’enregistrement.");
    }
  },
  { initialAutoResize: true }
);

// Empêcher le submit natif de recharger la page
form.addEventListener("submit", (event) => {
  event.preventDefault();
});

// Export
if (exportBtn) {
  exportBtn.addEventListener("click", handleExportClick);
}

// Go
init();
