// Runs in the original Yaprak tab or in the app.
async function exportYaprakNotebook() {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('yaprak-notebook', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const entries = await new Promise((resolve, reject) => {
      const query = database.transaction('pages').objectStore('pages').getAll();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    for (const entry of entries) {
      for (const block of entry.blocks) {
        if (!(block.value instanceof Blob)) continue;
        const file = block.value;
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        block.value = {data, mime: file.type, name: file.name || ''};
      }
    }
    return new Blob([JSON.stringify({format:'yaprak-1', pages:entries})], {type:'application/json'});
  } finally {
    database.close();
  }
}
