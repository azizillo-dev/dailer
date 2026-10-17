/* Dailer service worker: push bildirishnomalar. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Dailer", body: event.data ? event.data.text() : "" };
  }
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "Dailer", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: data.kind || "dailer",
      renotify: true,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
