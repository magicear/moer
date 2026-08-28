const DB = (() => {
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('moer-db', 1);
      r.onupgradeneeded = (e) => {
        const d = e.target.result;
        d.createObjectStore('videos', { keyPath: 'id' });
        d.createObjectStore('series', { keyPath: 'id' });
        d.createObjectStore('interactions', { keyPath: 'videoId' });
        d.createObjectStore('comments', { keyPath: 'id' }).createIndex('videoId', 'videoId');
        d.createObjectStore('notifications', { keyPath: 'id' });
        d.createObjectStore('messages', { keyPath: 'id' }).createIndex('convId', 'convId');
        d.createObjectStore('kv', { keyPath: 'key' });
      };
      r.onsuccess = () => { db = r.result; resolve(); };
      r.onerror = () => reject(r.error);
    });
  }

  function req(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  function put(store, val) { return req(db.transaction(store, 'readwrite').objectStore(store).put(val)); }
  function del(store, key) { return req(db.transaction(store, 'readwrite').objectStore(store).delete(key)); }
  function get(store, key) { return req(db.transaction(store).objectStore(store).get(key)); }
  function getAll(store) { return req(db.transaction(store).objectStore(store).getAll()); }
  function clear(store) { return req(db.transaction(store, 'readwrite').objectStore(store).clear()); }

  return { open, put, del, get, getAll, clear };
})();
