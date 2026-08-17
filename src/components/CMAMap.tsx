import { useEffect, useRef, useState } from "react";

/* ── Types ── */

export interface MapPin {
  label: string;
  address: string;
  detail?: string;
  isSubject?: boolean;
  fallback?: string; // e.g. "City, ST" to try if full address fails
}

interface GeocodedPin extends MapPin {
  lat: number;
  lng: number;
}

/* ── Geocoding via OpenStreetMap Nominatim (free, no key) ── */

async function geocodeOnce(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`,
      { headers: { "User-Agent": "BTR-CMA-Workbench/1.0" } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

// Try the full address first; if that fails, fall back to city + state.
async function geocode(pin: MapPin): Promise<{ lat: number; lng: number } | null> {
  const primary = await geocodeOnce(pin.address);
  if (primary) return primary;
  // Fallback: pull "City, ST" out of the address and try just that
  if (pin.fallback) {
    await delay(1100);
    return geocodeOnce(pin.fallback);
  }
  return null;
}

// Rate-limit: Nominatim asks for max 1 req/second
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAll(
  pins: MapPin[],
  onProgress: (done: number, total: number) => void
): Promise<GeocodedPin[]> {
  const results: GeocodedPin[] = [];
  for (let i = 0; i < pins.length; i++) {
    onProgress(i, pins.length);
    const coords = await geocode(pins[i]);
    if (coords) {
      results.push({ ...pins[i], ...coords });
    }
    if (i < pins.length - 1) await delay(1100);
  }
  onProgress(pins.length, pins.length);
  return results;
}

/* ── Map rendering ── */

// Load Leaflet CSS + JS dynamically (avoids needing it in package.json)
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    // CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    // JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function createIcon(L: any, color: string, size: number = 12) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size * 2}px;height:${size * 2}px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -size],
  });
}

/* ── Component ── */

export default function CMAMap({
  pins,
  onClose,
}: {
  pins: MapPin[];
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "geocoding" | "ready" | "error">("loading");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const L = await loadLeaflet();
        if (cancelled) return;

        setStatus("geocoding");
        const geocoded = await geocodeAll(pins, (done, total) => {
          if (!cancelled) setProgress({ done, total });
        });
        if (cancelled) return;

        setFailedCount(pins.length - geocoded.length);

        if (geocoded.length === 0) {
          setStatus("error");
          return;
        }

        setStatus("ready");

        // Wait for next tick so the container is visible
        await delay(50);
        if (cancelled || !mapRef.current) return;

        // Clean up any existing map
        if (mapInstance.current) {
          mapInstance.current.remove();
          mapInstance.current = null;
        }

        const map = L.map(mapRef.current, { scrollWheelZoom: true });
        mapInstance.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);

        const subjectIcon = createIcon(L, "#2E5D4B", 14);
        const compIcon = createIcon(L, "#42457A", 10);

        const bounds: any[] = [];

        geocoded.forEach((pin) => {
          const icon = pin.isSubject ? subjectIcon : compIcon;
          const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);

          const popupHtml = `
            <div style="font-family:'Inter',sans-serif;font-size:13px;line-height:1.4;min-width:160px">
              <div style="font-weight:600;color:#1A1D1A;margin-bottom:2px">
                ${pin.isSubject ? "★ " : ""}${pin.label}
              </div>
              <div style="font-size:11px;color:#6E6D64">${pin.address}</div>
              ${pin.detail ? `<div style="font-size:11.5px;color:#2E5D4B;margin-top:3px;font-family:'JetBrains Mono',monospace">${pin.detail}</div>` : ""}
            </div>
          `;
          marker.bindPopup(popupHtml);
          bounds.push([pin.lat, pin.lng]);
        });

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 13);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [pins]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
    >
      <div
        onClick={(e: any) => e.stopPropagation()}
        className="flex h-[80vh] w-full max-w-[900px] flex-col rounded-2xl bg-paper shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div>
            <div className="font-display text-[16px] font-semibold text-ink">CMA Map</div>
            <div className="mt-0.5 flex items-center gap-4 text-[11.5px] text-[#8A897F]">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full border-2 border-white shadow"
                  style={{ background: "#2E5D4B" }}
                />
                Subject
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white shadow"
                  style={{ background: "#42457A" }}
                />
                Comps
              </span>
              {failedCount > 0 && (
                <span className="text-[#B45309]">
                  {failedCount} address{failedCount > 1 ? "es" : ""} couldn't be located
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[#DDD9CF] px-3 py-1.5 text-[13px] text-[#5A594F]"
          >
            Close
          </button>
        </div>

        {/* Map area */}
        <div className="relative flex-1">
          {(status === "loading" || status === "geocoding") && (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="mb-3 font-display text-[15px] font-medium text-ink">
                {status === "loading" ? "Loading map…" : "Locating addresses…"}
              </div>
              {status === "geocoding" && (
                <div className="w-48">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#EDEBE4]">
                    <div
                      className="h-full rounded-full bg-pine transition-all"
                      style={{
                        width: progress.total > 0 ? (progress.done / progress.total) * 100 + "%" : "0%",
                      }}
                    />
                  </div>
                  <div className="mt-1.5 text-center text-[11px] text-[#8A897F]">
                    {progress.done} of {progress.total} addresses
                  </div>
                </div>
              )}
            </div>
          )}
          {status === "error" && (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="text-[14px] text-[#8A3A3A]">
                Couldn't locate any addresses on the map.
              </div>
              <div className="mt-1 text-[12px] text-[#8A897F]">
                Make sure the addresses include city and state.
              </div>
            </div>
          )}
          {status === "ready" && (
            <div ref={mapRef} className="h-full w-full rounded-b-2xl" />
          )}
        </div>
      </div>
    </div>
  );
}
