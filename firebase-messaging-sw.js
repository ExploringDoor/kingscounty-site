importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBf7_qvDDBF9Ey3oM_TlRp_XpPgeaYOJ64",
  authDomain: "kcsl-softball.firebaseapp.com",
  projectId: "kcsl-softball",
  storageBucket: "kcsl-softball.firebasestorage.app",
  messagingSenderId: "544013787699",
  appId: "1:544013787699:web:481da4e82b59ede47cb946"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = payload.notification?.title || 'DVSL Update';
  const options = {
    body: payload.notification?.body || '',
    icon: '/dvsl-logo-dark.png',
    badge: '/dvsl-logo-dark.png',
    data: payload.data
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
