// Atlas push service worker. Deliberately minimal: no offline caching, no
// asset precaching — its only job is to turn a Web Push message into a
// system notification and route a click back into the app.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Atlas", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Atlas";
  const url = data.url || "/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/globe.svg",
      badge: "/globe.svg",
      tag: url, // a second notification to the same destination replaces the first
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => new URL(c.url).pathname === new URL(url, self.location.origin).pathname);
      if (existing) {
        await existing.focus();
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
