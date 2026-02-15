/**
 * File System Access API Utilities
 * Chrome/Edge support for saving PDFs to local folders automatically
 */

// IndexedDB database name
const DB_NAME = 'OrientInsightDB';
const DB_VERSION = 1;
const STORE_NAME = 'folderHandles';

/**
 * Open IndexedDB database
 */
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

/**
 * Save directory handle to IndexedDB
 */
export async function saveFolderHandle(key, directoryHandle) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(directoryHandle, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get directory handle from IndexedDB
 */
export async function getFolderHandle(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported() {
  return 'showDirectoryPicker' in window;
}

/**
 * Request folder selection from user
 */
export async function selectBaseFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    // Save to IndexedDB
    await saveFolderHandle('basePdfFolder', dirHandle);

    return {
      success: true,
      folderName: dirHandle.name,
      handle: dirHandle
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'User cancelled folder selection' };
    }
    return { success: false, error: error.message };
  }
}

/**
 * Get or request permission for saved folder
 */
export async function getBaseFolderHandle() {
  const handle = await getFolderHandle('basePdfFolder');

  if (!handle) {
    return null;
  }

  // Check/request permission
  const permission = await handle.queryPermission({ mode: 'readwrite' });

  if (permission === 'granted') {
    return handle;
  }

  if (permission === 'prompt') {
    const newPermission = await handle.requestPermission({ mode: 'readwrite' });
    if (newPermission === 'granted') {
      return handle;
    }
  }

  return null;
}

/**
 * Create nested folder structure
 * Example: createFolderStructure(baseHandle, ['ER', '2026', 'ER-01', 'Hotel Zayavka'])
 */
export async function createFolderStructure(baseHandle, pathParts) {
  let currentHandle = baseHandle;

  for (const part of pathParts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }

  return currentHandle;
}

/**
 * Save PDF to local folder with automatic folder structure
 *
 * @param {Object} params
 * @param {string} params.tourType - Tour type code (ER, CO, KAS, ZA)
 * @param {string} params.bookingNumber - Booking number (e.g., ER-01)
 * @param {string} params.hotelName - Hotel name
 * @param {Blob} params.pdfBlob - PDF content as Blob
 * @param {boolean} params.isCombined - Whether this is a combined PDF
 */
export async function savePdfToFolder({ tourType, bookingNumber, hotelName, pdfBlob, isCombined = false }) {
  try {
    // Get base folder handle
    const baseHandle = await getBaseFolderHandle();

    if (!baseHandle) {
      throw new Error('No base folder configured. Please select a folder first.');
    }

    // Determine folder structure based on tour type
    let folderPath = [];
    const year = new Date().getFullYear();

    switch (tourType.toUpperCase()) {
      case 'ER':
        folderPath = [bookingNumber, 'Hotel Zayavka'];
        break;
      case 'CO':
        folderPath = [bookingNumber, 'Hotel Zayavka'];
        break;
      case 'KAS':
        folderPath = [bookingNumber, 'Hotel Zayavka'];
        break;
      case 'ZA':
        folderPath = [bookingNumber, 'Hotel Zayavka'];
        break;
      default:
        folderPath = [bookingNumber, 'Hotel Zayavka'];
    }

    // Create folder structure
    const targetFolder = await createFolderStructure(baseHandle, folderPath);

    // Generate filename
    const filename = `ЗАЯВКА ${bookingNumber} - ${hotelName}.pdf`;

    // Create file
    const fileHandle = await targetFolder.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    // Write content
    await writable.write(pdfBlob);
    await writable.close();

    return {
      success: true,
      path: `${folderPath.join('/')}/${filename}`,
      filename
    };

  } catch (error) {
    console.error('Error saving PDF to folder:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Download PDF from URL and save to folder
 */
export async function downloadAndSavePdf({ url, tourType, bookingNumber, hotelName, isCombined = false }) {
  try {
    // Fetch PDF content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    const pdfBlob = await response.blob();

    // Save to folder
    return await savePdfToFolder({
      tourType,
      bookingNumber,
      hotelName,
      pdfBlob,
      isCombined
    });

  } catch (error) {
    console.error('Error downloading and saving PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
