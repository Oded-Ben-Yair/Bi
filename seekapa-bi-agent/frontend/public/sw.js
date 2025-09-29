const CACHE_NAME = 'ceo-dashboard-v1.0.0';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  // Add other critical assets
];

const DYNAMIC_CACHE = 'ceo-dashboard-dynamic-v1.0.0';

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Service worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Service worker installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // Clone the request because it's a stream
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response because it's a stream
          const responseToCache = response.clone();

          // Cache API responses and assets
          if (shouldCache(event.request.url)) {
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                console.log('[SW] Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.error('[SW] Caching failed:', error);
              });
          }

          return response;
        }).catch((error) => {
          console.error('[SW] Fetch failed:', error);

          // Return offline fallback for navigation requests
          if (event.request.destination === 'document') {
            return caches.match('/');
          }

          // Return cached version for other requests if available
          return caches.match(event.request);
        });
      })
  );
});

// Helper function to determine if URL should be cached
function shouldCache(url) {
  // Cache API responses for dashboard data
  if (url.includes('/api/')) {
    return true;
  }

  // Cache static assets
  if (url.includes('/static/') || url.includes('/assets/')) {
    return true;
  }

  // Cache images
  if (url.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
    return true;
  }

  return false;
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'dashboard-data-sync') {
    event.waitUntil(syncDashboardData());
  }
});

// Function to sync dashboard data when back online
function syncDashboardData() {
  console.log('[SW] Syncing dashboard data');

  return fetch('/api/dashboard/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timestamp: Date.now(),
      type: 'background-sync'
    })
  })
  .then((response) => {
    if (response.ok) {
      console.log('[SW] Dashboard data synced successfully');
      // Notify all clients about the update
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'DATA_SYNC_COMPLETE',
            timestamp: Date.now()
          });
        });
      });
    } else {
      throw new Error('Sync failed');
    }
  })
  .catch((error) => {
    console.error('[SW] Dashboard data sync failed:', error);
  });
}

// Push notifications for critical alerts
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');

  const options = {
    body: 'Critical dashboard alert requires attention',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View Dashboard',
        icon: '/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icon-192x192.png'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.message || options.body;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.error('[SW] Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('CEO Dashboard Alert', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if dashboard is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes('/dashboard') && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new dashboard window
        if (self.clients.openWindow) {
          return self.clients.openWindow('/dashboard');
        }
      })
    );
  }
});

// Message handling for client communication
self.addEventListener('message', (event) => {
  console.log('[SW] Message received from client:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'REQUEST_SYNC') {
    event.waitUntil(syncDashboardData());
  }

  if (event.data && event.data.type === 'CACHE_CLEAR') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('ceo-dashboard')) {
              console.log('[SW] Clearing cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

// Periodic background sync for keeping data fresh
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);

  if (event.tag === 'dashboard-refresh') {
    event.waitUntil(syncDashboardData());
  }
});