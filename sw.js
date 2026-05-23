const CACHE_NAME = 'lifeorganizer-cache-v5';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all static assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Network First, fallback to cache)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Make a clone of the response
        const resClone = res.clone();
        // Open cache and save the new response
        caches.open(CACHE_NAME).then((cache) => {
          // Do not cache non-http/https schemes (like chrome-extension or file://)
          if (e.request.url.startsWith('http')) {
            cache.put(e.request, resClone);
          }
        });
        return res;
      })
      .catch(() => {
        // Offline: Serve from cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If a request is for index.html, return the cached version
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Notification Click Event (Handles actions and wakes up/focuses the app)
self.addEventListener('notificationclick', (e) => {
  e.notification.close(); // Close the notification popup
  
  // Extract task ID from tag (tag format: life-reminder-ID)
  let taskId = null;
  if (e.notification.tag && e.notification.tag.startsWith('life-reminder-')) {
    taskId = e.notification.tag.replace('life-reminder-', '');
  }
  
  const action = e.action; // 'done', 'snooze', or '' (regular click)
  
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Look for an existing open tab of the app
      let client = clientList.find(c => 'focus' in c);
      
      if (client) {
        // Focus the existing tab and post a message to it
        return client.focus().then((focusedClient) => {
          if (focusedClient && focusedClient.postMessage) {
            focusedClient.postMessage({
              type: 'notification-click',
              action: action,
              taskId: taskId
            });
          }
        });
      } else {
        // Tab is closed: open a new window and pass action/taskId via URL params
        if (self.clients.openWindow) {
          let url = './';
          if (action && taskId) {
            url += `?action=${encodeURIComponent(action)}&taskId=${encodeURIComponent(taskId)}`;
          } else if (taskId) {
            url += `?action=view&taskId=${encodeURIComponent(taskId)}`;
          }
          return self.clients.openWindow(url);
        }
      }
    })
  );
});
