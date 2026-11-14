
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyC_QPjhtpxvJzkt639rDwEmCcS2LgPJ9i8",
  authDomain: "medicycle-ai.firebaseapp.com",
  projectId: "medicycle-ai",
  storageBucket: "medicycle-ai.firebasestorage.app",
  messagingSenderId: "302054590561",
  appId: "1:302054590561:web:847553123f213516574220"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload.data?.title || "MediCycle Medicine Reminder";

  const options = {
    body:
      payload.data?.body ||
      "It is time to check your medicine reminder.",
    icon: "/medicycle.svg",
    data: {
      url: `${self.location.origin}/reminders`
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    `${self.location.origin}/reminders`;

  event.waitUntil(clients.openWindow(targetUrl));
});
