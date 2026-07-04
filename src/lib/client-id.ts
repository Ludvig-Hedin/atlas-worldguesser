/**
 * Stable per-device identifier persisted in localStorage under `key`. Reused by
 * the presence heartbeat (`atlas.sid`) and the guest-account identity
 * (`atlas.guestId`) — kept under distinct keys so the two never share rotation
 * semantics. Falls back to a volatile per-load id when storage is unavailable
 * (private mode / blocked storage) so callers always receive a value.
 */
export function getClientId(key: string): string {
  const generate = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = generate();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return generate();
  }
}
