let opening;
function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("simtorcl-experiments", 1);
    request.onupgradeneeded = () => {
      for (const name of ["records", "entries"])
        request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        new Error(
          "No se pudo abrir la biblioteca local. Puedes exportar JSON.",
        ),
      );
    request.onblocked = () =>
      reject(new Error("Otra pestaña está bloqueando la biblioteca."));
  });
  return opening;
}
export async function listEntries() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("entries").objectStore("entries").getAll();
    request.onsuccess = () =>
      resolve(
        request.result.sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      );
    request.onerror = () => reject(request.error);
  });
}
export async function readEntry(id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get(id);
    request.onsuccess = () => resolve(request.result?.record);
    request.onerror = () => reject(request.error);
  });
}
export async function saveEntry(record, id = crypto.randomUUID()) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["entries", "records"], "readwrite");
    tx.objectStore("records").put({ id, record });
    tx.objectStore("entries").put({
      id,
      name: record.name,
      savedAt: new Date().toISOString(),
      kind: record.kind,
      mode: record.initial.mode,
    });
    tx.oncomplete = () => resolve(id);
    tx.onerror = tx.onabort = () =>
      reject(
        new Error(
          "No se pudo guardar: revisa el espacio del navegador o exporta JSON.",
        ),
      );
  });
}
