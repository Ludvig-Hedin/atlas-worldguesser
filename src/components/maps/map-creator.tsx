"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { toast } from "sonner";
import { MapPin, Save, Trash2, X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CARTO_DARK_STYLE } from "@/lib/map-style";
import { countryAtAsync } from "@/lib/geo";
import { CountryGlyph } from "@/components/map-glyph";
import { countryName } from "@/lib/countries-meta";
import { hashString } from "@/lib/utils";

interface Point {
  id: string;
  lat: number;
  lng: number;
  countryCode: string;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const [points, setPoints] = useState<Point[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const pointsRef = useRef<Point[]>([]);
  useEffect(() => {
    pointsRef.current = points;
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_DARK_STYLE,
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
      const id = `${lat.toFixed(4)},${lng.toFixed(4)},${hashString(`${lat}${lng}`)}`;
      const next = [...pointsRef.current, { id, lat, lng, countryCode: cc }];
      const marker = new maplibregl.Marker({ element: pinEl(next.length), anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
      markersRef.current.set(id, marker);
      setPoints(next);
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
    };
  }, []);

  const removePoint = (id: string) => {
    markersRef.current.get(id)?.remove();
    markersRef.current.delete(id);
    setPoints((prev) => prev.filter((p) => p.id !== id));
  };

  const save = async () => {
    if (name.trim().length < 3) return toast.error("Name your map (3+ characters)");
    if (points.length < 5) return toast.error("Add at least 5 locations");
    setSaving(true);
    try {
      await create({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
        locations: points.map((p) => ({ lat: p.lat, lng: p.lng, countryCode: p.countryCode })),
      });
      toast.success("Map created");
      router.push("/maps");
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
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Map name"
          maxLength={40}
          className="h-10 rounded-lg border border-border bg-input px-3 text-sm font-medium outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          maxLength={200}
          rows={2}
          className="resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Public — anyone can play</span>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} />
        </label>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{points.length} locations</span>
          {points.length < 5 && <span className="text-subtle">Need {5 - points.length} more</span>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {points.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-sm">
              <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
              <CountryGlyph className="size-3.5" />
              <span className="min-w-0 flex-1 truncate">{countryName(p.countryCode)}</span>
              <button
                type="button"
                onClick={() => removePoint(p.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Remove location"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              markersRef.current.forEach((m) => m.remove());
              markersRef.current.clear();
              setPoints([]);
            }}
            disabled={points.length === 0}
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving || points.length < 5 || name.trim().length < 3}>
            <Save className="size-4" />
            Save map
          </Button>
        </div>
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
