"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Loader2,
  MapPin,
  Play,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { mapStyleFor } from "@/lib/map-style";
import { countryAtAsync } from "@/lib/geo";
import { CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
import { usePreferences } from "@/hooks/use-preferences";
import { cn, hashString } from "@/lib/utils";

interface Point {
  id: string;
  lat: number;
  lng: number;
  countryCode: string;
}

const MAX_LOCATIONS = 200;

function pinEl(n: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px 9999px 9999px 2px;background:#0a84ff;color:#ffffff;font:600 11px/1 ui-sans-serif,system-ui;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.5)";
  el.textContent = String(n);
  return el;
}

function Creator() {
  const router = useRouter();
  const create = useMutation(api.maps.create);
  const { mapType } = usePreferences();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const styleInitRef = useRef(false);

  const [points, setPoints] = useState<Point[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ mapId: string; slug: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasting, setPasting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const pointsRef = useRef<Point[]>([]);
  useEffect(() => {
    pointsRef.current = points;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleFor(mapType),
      center: [10, 25],
      zoom: 1.4,
      attributionControl: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      const cc = await countryAtAsync({ lat, lng });
      if (!cc) {
        toast.error("Pick a spot on land");
        return;
      }
      // Re-check AFTER the await: two quick clicks resolve against the same
      // stale ref otherwise, and the click path must respect the cap too.
      if (pointsRef.current.length >= MAX_LOCATIONS) {
        toast.error(`Map is full (${MAX_LOCATIONS} locations)`);
        return;
      }
      const id = `${lat.toFixed(4)},${lng.toFixed(4)},${hashString(`${lat}${lng}`)}`;
      if (markersRef.current.has(id)) return; // same spot clicked twice
      const next = [...pointsRef.current, { id, lat, lng, countryCode: cc }];
      // Sync the ref immediately so overlapping click handlers see this point.
      pointsRef.current = next;
      const marker = new maplibregl.Marker({ element: pinEl(next.length), anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.set(id, marker);
      setPoints(next);
    });
    mapRef.current = map;
    // The Map instance in the ref is never reassigned, so capturing it here
    // is safe and keeps the cleanup off ref.current (react-hooks rule).
    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the basemap when the map-type preference changes. DOM markers survive
  // setStyle, so nothing needs re-adding. Skip the first run (init already used
  // the current type).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!styleInitRef.current) {
      styleInitRef.current = true;
      return;
    }
    map.setStyle(mapStyleFor(mapType));
  }, [mapType]);

  /** Append a batch of locations, creating a numbered marker for each. Skips ids already on the map. */
  const addPoints = (locs: { lat: number; lng: number; countryCode: string }[]) => {
    const map = mapRef.current;
    if (!map || locs.length === 0) return;
    const arr = [...pointsRef.current];
    for (const loc of locs) {
      const id = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)},${hashString(`${loc.lat}${loc.lng}`)}`;
      if (markersRef.current.has(id)) continue;
      const marker = new maplibregl.Marker({ element: pinEl(arr.length + 1), anchor: "bottom" })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map);
      markersRef.current.set(id, marker);
      arr.push({ id, lat: loc.lat, lng: loc.lng, countryCode: loc.countryCode });
    }
    pointsRef.current = arr;
    setPoints(arr);
  };

  /** Re-label every on-map pin to match the sidebar's index-based numbering. */
  const renumberMarkers = (arr: Point[]) => {
    arr.forEach((p, i) => {
      const el = markersRef.current.get(p.id)?.getElement();
      if (el) el.textContent = String(i + 1);
    });
  };

  const removePoint = (id: string) => {
    markersRef.current.get(id)?.remove();
    markersRef.current.delete(id);
    const next = pointsRef.current.filter((p) => p.id !== id);
    pointsRef.current = next;
    renumberMarkers(next);
    setPoints(next);
  };

  const clearAll = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    pointsRef.current = [];
    setPoints([]);
  };

  const undo = useCallback(() => {
    const arr = pointsRef.current;
    const last = arr[arr.length - 1];
    if (!last) return;
    markersRef.current.get(last.id)?.remove();
    markersRef.current.delete(last.id);
    const next = arr.filter((p) => p.id !== last.id);
    pointsRef.current = next;
    setPoints(next);
  }, []);

  // Cmd/Ctrl+Z undoes the last point, unless the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (t?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const addPasted = async () => {
    const valid: { lat: number; lng: number }[] = [];
    let skipped = 0;
    for (const line of pasteText.split("\n")) {
      const raw = line.trim();
      if (!raw) continue; // ignore blank lines
      const parts = raw.split(/[\s,]+/).filter(Boolean);
      if (parts.length !== 2) {
        skipped++;
        continue;
      }
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        skipped++;
        continue;
      }
      valid.push({ lat, lng });
    }

    if (valid.length === 0) {
      toast.error(
        skipped
          ? `No valid coordinates — skipped ${skipped} line${skipped === 1 ? "" : "s"}`
          : "Add one “lat, lng” per line",
      );
      return;
    }

    setPasting(true);
    try {
      // Derive countryCode the same way the map click does.
      const derived = await Promise.all(
        valid.map(async (c) => ({ ...c, cc: await countryAtAsync({ lat: c.lat, lng: c.lng }) })),
      );
      const existing = new Set(pointsRef.current.map((p) => p.id));
      const seen = new Set<string>();
      const capacity = Math.max(0, MAX_LOCATIONS - pointsRef.current.length);
      const toAdd: { lat: number; lng: number; countryCode: string }[] = [];
      for (const d of derived) {
        if (!d.cc) {
          skipped++; // ocean / no country → cannot place
          continue;
        }
        const id = `${d.lat.toFixed(4)},${d.lng.toFixed(4)},${hashString(`${d.lat}${d.lng}`)}`;
        if (existing.has(id) || seen.has(id) || toAdd.length >= capacity) {
          skipped++;
          continue;
        }
        seen.add(id);
        toAdd.push({ lat: d.lat, lng: d.lng, countryCode: d.cc });
      }

      if (toAdd.length === 0) {
        toast.error(
          capacity === 0
            ? `Map is full (${MAX_LOCATIONS} locations)`
            : `No new locations — skipped ${skipped} line${skipped === 1 ? "" : "s"}`,
        );
        return;
      }

      addPoints(toAdd);
      setPasteText("");
      toast.success(
        `Added ${toAdd.length} location${toAdd.length === 1 ? "" : "s"}` +
          (skipped ? `, skipped ${skipped} invalid line${skipped === 1 ? "" : "s"}` : ""),
      );
    } finally {
      setPasting(false);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/maps/${created.mapId}/play`);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  const save = async () => {
    if (name.trim().length < 3) return toast.error("Name your map (3+ characters)");
    if (points.length < 5) return toast.error("Add at least 5 locations");
    setSaving(true);
    try {
      const res = await create({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        locations: points.map((p) => ({ lat: p.lat, lng: p.lng, countryCode: p.countryCode })),
      });
      toast.success("Map created");
      setCreated({ mapId: res.mapId, slug: res.slug });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      setSaving(false);
    }
  };

  return (
    <div className="grid h-[calc(100dvh-64px)] grid-cols-1 lg:grid-cols-[1fr_340px]">
      <div className="relative">
        <div ref={containerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur">
          <MapPin className="mr-1 inline size-3" />
          Click the map to add locations
        </div>
      </div>

      <aside className="flex flex-col gap-4 overflow-y-auto border-t border-border p-5 lg:border-l lg:border-t-0">
        {created ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Map created</h2>
              <p className="mx-auto max-w-[15rem] truncate text-sm text-muted-foreground">
                {name.trim()}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Button onClick={() => router.push(`/maps/${created.mapId}/play`)}>
                <Play className="size-4" />
                Play now
              </Button>
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
              <Link
                href="/maps"
                className="mt-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to maps
              </Link>
            </div>
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Map name"
              maxLength={40}
              className="h-10 rounded-lg border border-border bg-input px-3 text-sm font-medium transition-colors placeholder:text-subtle hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={200}
              rows={2}
              className="resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm transition-colors placeholder:text-subtle hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Public — anyone can play</span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </label>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{points.length} locations</span>
              {points.length < 5 && <span className="text-subtle">Need {5 - points.length} more</span>}
            </div>

            <div className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setShowPaste((v) => !v)}
                aria-expanded={showPaste}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <ClipboardPaste className="size-3.5" />
                  Paste coordinates
                </span>
                <ChevronDown className={cn("size-3.5 transition-transform", showPaste && "rotate-180")} />
              </button>
              {showPaste && (
                <div className="space-y-2 border-t border-border p-2.5">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={"One per line:\n48.8584, 2.2945\n40.7128 -74.0060"}
                    rows={4}
                    className="w-full resize-none rounded-md border border-border bg-input px-2.5 py-2 font-mono text-xs transition-colors placeholder:text-subtle hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-subtle">lat, lng · comma, space or tab</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={addPasted}
                      disabled={pasting || !pasteText.trim()}
                    >
                      {pasting ? "Adding…" : "Add"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {points.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-2 text-sm"
                >
                  <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                  <CountryGlyph className="size-3.5" />
                  <span className="min-w-0 flex-1 truncate">{countryName(p.countryCode)}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => removePoint(p.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Remove location"
                      >
                        <X className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Remove</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={undo}
                    disabled={points.length === 0}
                    aria-label="Undo last location"
                  >
                    <Undo2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo last (⌘Z)</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(true)}
                disabled={points.length === 0}
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
              <Button
                className="flex-1"
                onClick={save}
                disabled={saving || points.length < 5 || name.trim().length < 3}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? "Saving…" : "Save map"}
              </Button>
            </div>

            <ConfirmDialog
              open={confirmClear}
              onOpenChange={setConfirmClear}
              title="Clear all locations?"
              description="This removes every pin you've added. This can't be undone."
              confirmLabel="Clear all"
              destructive
              onConfirm={() => {
                clearAll();
                setConfirmClear(false);
              }}
            />
          </TooltipProvider>
        )}
      </aside>
    </div>
  );
}

export function MapCreator() {
  return (
    <>
      <Authenticated>
        <Creator />
      </Authenticated>
      <Unauthenticated>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Sign in to create a custom map.</p>
          <SignInButton mode="modal">
            <Button>Sign in</Button>
          </SignInButton>
        </div>
      </Unauthenticated>
    </>
  );
}
