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
} else {
  console.warn('[firebase-messaging-sw.js] Falta la configuración de Firebase en los parámetros del Service Worker.');
}
