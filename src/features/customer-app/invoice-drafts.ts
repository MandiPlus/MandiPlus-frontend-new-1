import type { CustomerInvoiceDraft } from "./api";

const DATABASE_NAME = "mandiplus-customer-insurance";
const DATABASE_VERSION = 1;
const STORE_NAME = "invoice-drafts";

export type StoredCustomerInvoiceStatus = "ready" | "failed";

export type StoredCustomerInvoiceDraftItem = {
  key: string;
  uploadIndex: number;
  form: CustomerInvoiceDraft;
  status: StoredCustomerInvoiceStatus;
  error?: string;
};

export type StoredCustomerInvoiceDraft = {
  id: string;
  userId: string;
  savedAt: string;
  files: File[];
  items: StoredCustomerInvoiceDraftItem[];
  activeItemKey: string | null;
  reviewView: "overview" | "detail";
};

type PersistedFile = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

type PersistedCustomerInvoiceDraft = Omit<StoredCustomerInvoiceDraft, "files"> & {
  files: PersistedFile[];
};

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Draft storage is not available in this browser."));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction?.objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (store && !store.indexNames.contains("userId")) {
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Draft storage could not open."));
    request.onblocked = () => reject(new Error("Close the other MandiPlus tab and try again."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Draft storage failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Draft storage failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Draft storage was cancelled."));
  });
}

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function persistFile(file: File): PersistedFile {
  return {
    blob: file,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
  };
}

function restoreFile(file: PersistedFile) {
  return new File([file.blob], file.name, {
    type: file.type || file.blob.type,
    lastModified: file.lastModified,
  });
}

function restoreDraft(record: PersistedCustomerInvoiceDraft): StoredCustomerInvoiceDraft {
  return {
    ...record,
    files: Array.isArray(record.files) ? record.files.map(restoreFile) : [],
    items: Array.isArray(record.items) ? record.items : [],
    reviewView: record.reviewView === "detail" ? "detail" : "overview",
  };
}

export async function listCustomerInvoiceDrafts(userId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("userId");
    const records = await requestResult(
      index.getAll(userId) as IDBRequest<PersistedCustomerInvoiceDraft[]>,
    );
    await completed;
    return records
      .map(restoreDraft)
      .filter((draft) => draft.files.length > 0)
      .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  } finally {
    database.close();
  }
}

export async function saveCustomerInvoiceDraft(
  input: Omit<StoredCustomerInvoiceDraft, "id" | "savedAt"> & {
    id?: string | null;
  },
) {
  const saved: PersistedCustomerInvoiceDraft = {
    ...input,
    id: input.id || newDraftId(),
    savedAt: new Date().toISOString(),
    files: input.files.map(persistFile),
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put(saved);
    await completed;
    return restoreDraft(saved);
  } finally {
    database.close();
  }
}

export async function deleteCustomerInvoiceDraft(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).delete(id);
    await completed;
  } finally {
    database.close();
  }
}
