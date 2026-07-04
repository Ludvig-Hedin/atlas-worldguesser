"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { vapidPublicKey, features } from "@/lib/env";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PermissionState = "unsupported" | NotificationPermission;

/**
 * Web Push opt-in/out for the signed-in device. Mirrors the email channel
 * (convex/email.ts) — same 4 trigger events — but requires an explicit,
 * per-browser permission grant + subscription registered in
 * `pushSubscriptions`. `supported` gates on both browser APIs and
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` being configured.
 */
export function usePushNotifications() {
  const { isAuthenticated } = useConvexAuth();
  const supported =
    features.push &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined";

  const [permission, setPermission] = useState<PermissionState>(() =>
    supported ? Notification.permission : "unsupported",
  );
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const subscribeMutation = useMutation(api.push.subscribe);
  const unsubscribeMutation = useMutation(api.push.unsubscribe);
  const registeredServerSide = useQuery(
    api.push.isSubscribed,
    isAuthenticated && endpoint ? { endpoint } : "skip",
  );

  // Reflect whatever subscription the browser already holds (e.g. granted in
  // an earlier visit) so the toggle shows the right state on load.
  useEffect(() => {
    if (!supported) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setEndpoint(sub?.endpoint ?? null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      await subscribeMutation({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setEndpoint(json.endpoint);
    } finally {
      setLoading(false);
    }
  }, [supported, subscribeMutation]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await unsubscribeMutation({ endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setEndpoint(null);
    } finally {
      setLoading(false);
    }
  }, [supported, unsubscribeMutation]);

  return {
    supported,
    ready,
    permission,
    // Trust the browser subscription optimistically while the server query is
    // still loading (undefined); only flip false once the server confirms gone.
    subscribed: !!endpoint && registeredServerSide !== false,
    loading,
    enable,
    disable,
  };
}
