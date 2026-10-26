// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Parsear credenciales desde los parámetros de búsqueda de la URL
const params = new URLSearchParams(location.search);
const firebaseConfig = {
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId')
};

// Verificar que las credenciales obligatorias existen
if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Personalizar cómo se muestran las notificaciones en segundo plano (cuando la app está cerrada)
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Recibido mensaje en segundo plano: ', payload);
    
    if (payload.notification) {
      const notificationTitle = payload.notification.title || 'Nuevo Mensaje';
      const notificationOptions = {
        body: payload.notification.body || '',
        icon: '/logo.png', // Icono público
        data: payload.data || {}
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    }
  });

  // Manejar el clic en la notificación para abrir o enfocar la app
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        // Si ya hay una ventana abierta, enfocarla
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url && 'focus' in client) {
            if ('navigate' in client && urlToOpen !== '/') {
              client.navigate(urlToOpen);
            }
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  });
} else {
  console.warn('[firebase-messaging-sw.js] Falta la configuración de Firebase en los parámetros del Service Worker.');
}
