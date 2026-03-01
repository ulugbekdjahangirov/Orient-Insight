/**
 * File System Access API Utilities
 * Per-tour-type folder management with automatic subfolder structure
 */

const DB_NAME = 'OrientInsightDB';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandles';

// Subfolder mapping per document category
export const PDF_CATEGORIES = {
  zayavka:     'Zayavka',       // Hotel request PDF
  worldInsight:'World Insight', // Rechnung, Hotelliste
  transport:   'Transport',     // Marshrut varaqasi
  ausgaben:    'Ausgaben',      // Cost / Ausgaben
  eintritt:    'Eintritt',      // Eintritt vouchers
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function saveFolderHandle(key, directoryHandle) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(directoryHandle, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getFolderHandle(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isFileSystemAccessSupported() {
  return 'showDirectoryPicker' in window;
}

/**
 * Select folder for a specific tour type (ER, CO, KAS, ZA)
 * Saves handle to IndexedDB under key `pdfFolder_ER` etc.
 */
export async function selectTourTypeFolder(tourType) {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await saveFolderHandle(`pdfFolder_${tourType}`, dirHandle);
    return { success: true, folderName: dirHandle.name };
  } catch (error) {
    if (error.name === 'AbortError') return { success: false, cancelled: true };
    return { success: false, error: error.message };
  }
}

/**
 * Get folder handle for a tour type, checking/requesting permission
 */
export async function getTourTypeFolderHandle(tourType) {
  const handle = await getFolderHandle(`pdfFolder_${tourType}`);
  if (!handle) return null;

  const perm = await handle.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') return handle;

  if (perm === 'prompt') {
    const newPerm = await handle.requestPermission({ mode: 'readwrite' });
    if (newPerm === 'granted') return handle;
  }
  return null;
}

/**
 * Get folder name (display only) without requesting permission
 */
export async function getTourTypeFolderName(tourType) {
  try {
    const handle = await getFolderHandle(`pdfFolder_${tourType}`);
    return handle ? handle.name : null;
  } catch {
    return null;
  }
}

/**
 * Get all tour type folder statuses at once
 * Returns { ER: 'FolderName' | null, CO: ..., KAS: ..., ZA: ... }
 */
export async function getAllFolderStatuses() {
  const tourTypes = ['ER', 'CO', 'KAS', 'ZA'];
  const result = {};
  await Promise.all(
    tourTypes.map(async (tt) => {
      result[tt] = await getTourTypeFolderName(tt);
    })
  );
  return result;
}

/**
 * Create nested folder structure from a base handle
 */
async function createFolderStructure(baseHandle, pathParts) {
  let current = baseHandle;
  for (const part of pathParts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

/**
 * Save a PDF blob to the correct subfolder
 *
 * @param {Object} params
 * @param {string} params.tourType       - 'ER' | 'CO' | 'KAS' | 'ZA'
 * @param {string} params.bookingNumber  - e.g. 'ER-01'
 * @param {string} params.category       - key from PDF_CATEGORIES, or 'root'
 * @param {string} params.filename       - final file name, e.g. 'Zayavka ER-01 - Arien Plaza.pdf'
 * @param {Blob}   params.pdfBlob        - PDF content
 */
export async function savePdfToFolder({ tourType, bookingNumber, category, filename, pdfBlob }) {
  try {
    const baseHandle = await getTourTypeFolderHandle(tourType);
    if (!baseHandle) {
      return { success: false, error: 'Papka tanlanmagan. Settings → PDF Papkalari' };
    }

    // Build path: [bookingNumber] or [bookingNumber, subfolder]
    const subfolder = PDF_CATEGORIES[category];
    const pathParts = subfolder ? [bookingNumber, subfolder] : [bookingNumber];

    const targetDir = await createFolderStructure(baseHandle, pathParts);

    const fileHandle = await targetDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(pdfBlob);
    await writable.close();

    const displayPath = [...pathParts, filename].join(' / ');
    return { success: true, path: displayPath, filename };

  } catch (error) {
    console.error('savePdfToFolder error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch a PDF from URL and save to folder
 */
export async function downloadAndSavePdf({ url, tourType, bookingNumber, category, filename }) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('PDF yuklab olinmadi');
    const pdfBlob = await response.blob();
    return await savePdfToFolder({ tourType, bookingNumber, category, filename, pdfBlob });
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ── Legacy compatibility (used by older BookingDetail code) ──────────────────

export async function selectBaseFolder() {
  return selectTourTypeFolder('ER');
}

export async function getBaseFolderHandle() {
  return getTourTypeFolderHandle('ER');
}

export async function savePdfToFolderLegacy({ tourType, bookingNumber, hotelName, pdfBlob }) {
  const filename = `ZAЯВКА ${bookingNumber} - ${hotelName}.pdf`;
  return savePdfToFolder({ tourType, bookingNumber, category: 'zayavka', filename, pdfBlob });
}
