/* Leaflet is loaded from a CDN at runtime (no npm package / @types installed),
   and Overpass returns untyped JSON — so `any` is unavoidable for those values. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import {
  MapPin, Navigation, Loader2, ExternalLink,
  Phone, Clock, RefreshCw, Sparkles, AlertTriangle, ShieldCheck, MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/** fetch() with a hard timeout so a stalled map/IP service can't hang the UI. */
async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface Shop {
  id:           string | number;
  name:         string;
  address:      string;
  phone:        string;
  lat:          number;
  lng:          number;
  distance_km:  number;
  opening:      string;
  verified?:    boolean;
  /** Shopkeeper UUID — present on verified partners; enables live chat. */
  shopkeeperId?: string;
}

interface VerifiedShop {
  id:          string;
  name:        string;
  address:     string;
  phone:       string;
  opening:     string;
  lat:         number | null;
  lng:         number | null;
  distance_km: number | null;
}

/** Fetch approved partner shops from our backend (shown ahead of OSM results). */
async function fetchVerifiedShops(lat: number, lng: number): Promise<Shop[]> {
  try {
    const resp = await fetchWithTimeout(
      `${API_BASE}/api/shops/nearby?lat=${lat}&lng=${lng}`,
      {},
      8000,
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.shops ?? [])
      .filter((shop: VerifiedShop) => shop.lat != null && shop.lng != null)
      .map((shop: VerifiedShop) => ({
        id:           `verified-${shop.id}`,
        name:         shop.name,
        address:      shop.address ?? "",
        phone:        shop.phone ?? "",
        lat:          shop.lat as number,
        lng:          shop.lng as number,
        distance_km:  shop.distance_km ?? 0,
        opening:      shop.opening ?? "",
        verified:     true,
        shopkeeperId: shop.id,
      }));
  } catch {
    return [];
  }
}

interface UserLocation {
  lat:     number;
  lng:     number;
  city:    string;
  country: string;
}

interface AIInsights {
  suggestions: string[];
  cautions:    string[];
  summary:     string;
}

const RepairShopLocator = () => {
  const { requireAuth } = useAuth();
  const navigate = useNavigate();
  const [location, setLocation]         = useState<UserLocation | null>(null);
  const [shops, setShops]               = useState<Shop[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [statusText, setStatusText]     = useState("Detecting your location...");
  const [insights, setInsights]         = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const mapRef                          = useRef<HTMLDivElement>(null);
  const mapInstance                     = useRef<any>(null);
  const markersRef                      = useRef<any[]>([]);

  useEffect(() => {
    loadLeaflet();
    autoDetectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeaflet = () => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id    = "leaflet-css";
      link.rel   = "stylesheet";
      link.href  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
    }
  };

  const autoDetectLocation = () => {
    setLoading(true);
    setError(null);
    setStatusText("Detecting your location...");
    setShops([]);
    setInsights(null);

    if (navigator.geolocation) {
      setStatusText("Getting GPS location...");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          if (accuracy > 100000) {
            setStatusText("GPS inaccurate — using IP location...");
            await getLocationByIP();
            return;
          }
          setStatusText("GPS found! Getting city name...");
          try {
            const resp = await fetchWithTimeout(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
              { headers: { "User-Agent": "ScreenAI-FYP/1.0" } },
              8000,
            );
            const data = await resp.json();
            const addr = data.address ?? {};
            const city = addr.city || addr.town || addr.village || addr.county || "Your City";
            const loc  = { lat, lng, city, country: addr.country || "" };
            setLocation(loc);
            setStatusText("");
            findNearbyShops(lat, lng, loc);
          } catch {
            const loc = { lat, lng, city: "Your Location", country: "" };
            setLocation(loc);
            setStatusText("");
            findNearbyShops(lat, lng, loc);
          }
        },
        async () => {
          setStatusText("Using IP-based location...");
          await getLocationByIP();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      getLocationByIP();
    }
  };

  const getLocationByIP = async () => {
    setStatusText("Detecting location from network...");
    const apis = [
      async () => {
        const r = await fetchWithTimeout("https://ipapi.co/json/", {}, 6000);
        const d = await r.json();
        if (!d.latitude) throw new Error("no data");
        return { lat: d.latitude, lng: d.longitude, city: d.city || d.region || "Your City", country: d.country_name || "" };
      },
      async () => {
        const r = await fetchWithTimeout("https://ipapi.is/json/", {}, 6000);
        const d = await r.json();
        if (!d.location?.latitude) throw new Error("no data");
        return { lat: d.location.latitude, lng: d.location.longitude, city: d.location.city || "Your City", country: d.location.country || "" };
      },
      async () => {
        const r = await fetchWithTimeout("https://ipwho.is/", {}, 6000);
        const d = await r.json();
        if (!d.latitude) throw new Error("no data");
        return { lat: d.latitude, lng: d.longitude, city: d.city || d.region || "Your City", country: d.country || "" };
      },
      async () => {
        const r = await fetchWithTimeout("https://freeipapi.com/api/json", {}, 6000);
        const d = await r.json();
        if (!d.latitude) throw new Error("no data");
        return { lat: d.latitude, lng: d.longitude, city: d.cityName || "Your City", country: d.countryName || "" };
      },
    ];

    for (const api of apis) {
      try {
        const loc = await api();
        setLocation(loc);
        setStatusText("");
        findNearbyShops(loc.lat, loc.lng, loc);
        return;
      } catch { continue; }
    }

    setLoading(false);
    setStatusText("");
    setError("Could not detect location. Please check your internet connection.");
  };

  const findNearbyShops = async (lat: number, lng: number, loc: UserLocation) => {
    setStatusText("Searching nearby repair shops...");

    const OVERPASS_ENDPOINTS = [
      "https://overpass.kumi.systems/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.openstreetmap.ru/api/interpreter",
    ];

    // Only phone-specific OSM tags. We avoid the bare "repair" name keyword
    // because it also matches "Auto Repair" / "Car Repair" shops.
    const buildQuery = (radius: number) => `
      [out:json][timeout:25];
      (
        node["shop"="mobile_phone"](around:${radius},${lat},${lng});
        node["repair"="phone"](around:${radius},${lat},${lng});
        node["repair"="mobile_phone"](around:${radius},${lat},${lng});
        node["shop"="electronics"]["repair"="phone"](around:${radius},${lat},${lng});
        node["name"~"mobile|smartphone|cell ?phone|cellphone|screen repair|lcd|gsm|iphone|samsung",i]["shop"](around:${radius},${lat},${lng});
        way["shop"="mobile_phone"](around:${radius},${lat},${lng});
        way["repair"="phone"](around:${radius},${lat},${lng});
      );
      out body center 15;
    `;

    // Defensive guard: drop anything that looks like a vehicle/auto business
    // (covers stray matches the OSM tags may still return).
    const AUTO_PATTERN = /\b(auto|car|motor|vehicle|tyre|tire|bike|truck|automobile|workshop|garage|rickshaw|spare ?parts)\b/i;
    const PHONE_PATTERN = /\b(mobile|phone|cell|smartphone|screen|lcd|gsm|iphone|samsung|huawei|oppo|vivo|xiaomi|tecno|infinix)\b/i;
    const isPhoneShop = (tags: any): boolean => {
      if (tags.shop === "mobile_phone" || tags.repair === "phone" || tags.repair === "mobile_phone") return true;
      const name = tags.name ?? "";
      if (AUTO_PATTERN.test(name) && !PHONE_PATTERN.test(name)) return false;
      return true;
    };

    const tryFetch = async (query: string): Promise<any[] | null> => {
      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const resp = await fetchWithTimeout(
            endpoint,
            {
              method:  "POST",
              body:    `data=${encodeURIComponent(query)}`,
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            },
            8000,
          );
          if (!resp.ok) continue;
          const data = await resp.json();
          return (data.elements ?? []).filter((el: any) => el.tags?.name);
        } catch { continue; }
      }
      return null;
    };

    try {
      let elements = await tryFetch(buildQuery(5000));
      if (elements && elements.length === 0) {
        setStatusText("Expanding search to 10km...");
        elements = await tryFetch(buildQuery(10000));
      }

      // Our approved partner shops always take priority over OSM results.
      const verifiedShops = (await fetchVerifiedShops(lat, lng)).sort(
        (a: Shop, b: Shop) => a.distance_km - b.distance_km,
      );

      if (elements === null) {
        setShops(verifiedShops);
        setLoading(false);
        setStatusText("");
        if (verifiedShops.length === 0) {
          setError(`Map service temporarily unavailable. Try searching on Google Maps: "mobile phone repair near me"`);
        }
        initMap(lat, lng, verifiedShops);
        // Still fetch insights even if no map shops found
        loadInsights(loc.city, loc.country, verifiedShops);
        return;
      }

      const osmShops: Shop[] = elements
        .filter((el: any) => isPhoneShop(el.tags ?? {}))
        .map((el: any) => {
        const tags  = el.tags ?? {};
        const sLat  = el.lat ?? el.center?.lat ?? 0;
        const sLng  = el.lon ?? el.center?.lon ?? 0;
        const parts = [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"] || tags["addr:suburb"],
        ].filter(Boolean);
        return {
          id:          el.id,
          name:        tags.name,
          address:     parts.join(", ") || tags["addr:full"] || "",
          phone:       tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "",
          lat:         sLat,
          lng:         sLng,
          distance_km: haversine(lat, lng, sLat, sLng),
          opening:     tags.opening_hours || "",
        };
      })
        .sort((a: Shop, b: Shop) => a.distance_km - b.distance_km);

      // Verified partners first, then OSM shops, capped for a tidy list.
      const shopList: Shop[] = [...verifiedShops, ...osmShops].slice(0, 12);

      setShops(shopList);
      setLoading(false);
      setStatusText("");
      if (shopList.length === 0) {
        setError("No repair shops found in your area on OpenStreetMap.");
      }
      initMap(lat, lng, shopList);

      // ── Fetch OpenAI insights after shops are found ───────────
      loadInsights(loc.city, loc.country, shopList);

    } catch {
      setLoading(false);
      setStatusText("");
      setError("Failed to load shops. Please try again.");
      initMap(lat, lng, []);
    }
  };

  // ── Fetch insights from backend → OpenAI ──────────────────────────────────
  const loadInsights = async (city: string, country: string, shopList: Shop[]) => {
    setInsightsLoading(true);
    try {
      const shopNames = shopList.slice(0, 5).map(s => s.name).filter(Boolean);

      const response = await fetchWithTimeout(`${API_BASE}/api/repair-insights`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ city, country, shops: shopNames }),
      }, 20000);

      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch {
      // Silently fail — insights are a bonus feature
    }
    setInsightsLoading(false);
  };

  const initMap = (lat: number, lng: number, shopList: Shop[]) => {
    const tryInit = (attempts = 0) => {
      const L = (window as any).L;
      if (!L || !mapRef.current) {
        if (attempts < 25) setTimeout(() => tryInit(attempts + 1), 300);
        return;
      }
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
      markersRef.current = [];

      const map = L.map(mapRef.current).setView([lat, lng], 14);
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);

      const userIcon = L.divIcon({
        html: `<div style="width:18px;height:18px;background:#0f172a;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(37,99,235,0.20)"></div>`,
        className: "", iconSize: [18, 18], iconAnchor: [9, 9],
      });
      L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup(`<b>You are here</b>`).openPopup();

      shopList.forEach((shop, i) => {
        // CSS custom properties cascade to Leaflet's injected markers, so the
        // brand tokens resolve here too. Verified partners get the deeper accent.
        const markerColor = shop.verified ? "hsl(var(--accent-strong))" : "hsl(var(--accent))";
        const icon = L.divIcon({
          html: `<div style="background:${markerColor};color:#ffffff;font-weight:700;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${shop.verified ? "★" : i + 1}</div>`,
          className: "", iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const m = L.marker([shop.lat, shop.lng], { icon }).addTo(map).bindPopup(`
          <div style="min-width:150px;font-family:sans-serif">
            ${shop.verified ? `<span style="display:inline-block;margin-bottom:4px;background:hsl(var(--accent-soft));color:hsl(var(--accent-strong));font-size:10px;font-weight:700;padding:1px 6px;border-radius:9999px">★ Verified partner</span><br/>` : ""}
            <b style="font-size:13px">${shop.name}</b>
            ${shop.address ? `<br/><span style="color:#6b7280;font-size:11px">${shop.address}</span>` : ""}
            ${shop.phone   ? `<br/><span style="font-size:11px">${shop.phone}</span>` : ""}
            <br/><b style="font-size:11px;color:${markerColor}">${shop.distance_km < 1 ? `${(shop.distance_km * 1000).toFixed(0)}m` : `${shop.distance_km.toFixed(1)}km`} away</b>
          </div>
        `);
        markersRef.current.push(m);
      });
    };
    tryInit();
  };

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const focusShop = (shop: Shop, i: number) => {
    if (mapInstance.current) {
      mapInstance.current.setView([shop.lat, shop.lng], 17);
      markersRef.current[i]?.openPopup();
    }
  };

  const retryBtn =
    "inline-flex items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary";

  return (
    <section className="border-b border-border bg-background py-20 lg:py-24">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <p className="label-mono">Repair-shop locator</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Find repair shops near you.
          </h2>
          <p className="mt-3 text-muted-foreground">
            We detect your area and pull mobile-repair shops from OpenStreetMap no GPS permission required.
          </p>
        </div>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-2 border-border border-t-foreground" />
              <MapPin className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{statusText}</p>
          </motion.div>
        )}

        {error && !loading && !location && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-8">
            <div className="surface max-w-md p-5 text-center">
              <p className="mb-3 text-sm text-muted-foreground">{error}</p>
              <button onClick={autoDetectLocation} className={retryBtn}>
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </div>
          </motion.div>
        )}

        {location && !loading && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface mb-6 flex items-center justify-between px-5 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
                <span className="text-sm text-muted-foreground">
                  Showing shops near{" "}
                  <span className="font-semibold text-foreground">
                    {location.city}{location.country ? `, ${location.country}` : ""}
                  </span>
                </span>
              </div>
              <button
                onClick={autoDetectLocation}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </motion.div>

            <AnimatePresence>
              {(insightsLoading || insights) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="surface mb-6 overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-5 py-3">
                    <Sparkles className="h-4 w-4 text-accent" />
                    <span className="text-sm font-semibold text-foreground">
                      Local repair insights — {location.city}
                    </span>
                    {insightsLoading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>

                  {insightsLoading && !insights && (
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">Gathering local repair tips…</span>
                    </div>
                  )}

                  {insights && (
                    <div className="space-y-4 px-5 py-4">
                      {insights.summary && <p className="text-sm font-medium text-foreground">{insights.summary}</p>}

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {insights.suggestions?.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-1.5">
                              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
                              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--success))]">
                                Tips
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {insights.suggestions.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success)/0.15)] text-[10px] font-bold text-[hsl(var(--success))]">
                                    {i + 1}
                                  </span>
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {insights.cautions?.length > 0 && (
                          <div>
                            <div className="mb-2 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                              <span className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--warning))]">
                                Watch out
                              </span>
                            </div>
                            <ul className="space-y-1.5">
                              {insights.cautions.map((caution, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                                  <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--warning)/0.15)] text-[10px] font-bold text-[hsl(var(--warning))]">
                                    !
                                  </span>
                                  {caution}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-[var(--radius)] border border-border" style={{ height: 460 }}>
                <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
              </div>

              <div className="flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
                {error && (
                  <div
                    className="rounded-[var(--radius)] border p-4"
                    style={{ borderColor: "hsl(var(--warning) / 0.3)", background: "hsl(var(--warning) / 0.07)" }}
                  >
                    <p className="mb-2 text-sm text-muted-foreground">{error}</p>
                    <a
                      href={`https://www.google.com/maps/search/mobile+phone+repair/@${location.lat},${location.lng},14z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Search on Google Maps instead
                    </a>
                  </div>
                )}

                {shops.length === 0 && !error && (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <MapPin className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No shops found in your area</p>
                    <a
                      href={`https://www.google.com/maps/search/mobile+phone+repair/@${location.lat},${location.lng},14z`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-foreground underline underline-offset-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Try Google Maps
                    </a>
                  </div>
                )}

                {shops.length > 0 && (
                  <div className="flex items-center justify-between px-1 pb-1">
                    <span className="text-xs font-semibold text-foreground">
                      {shops.length} shop{shops.length > 1 ? "s" : ""} nearby
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Nearest{" "}
                      {shops[0].distance_km < 1
                        ? `${(shops[0].distance_km * 1000).toFixed(0)}m`
                        : `${shops[0].distance_km.toFixed(1)}km`}{" "}
                      away
                    </span>
                  </div>
                )}

                <AnimatePresence>
                  {shops.map((shop, i) => (
                    <motion.div
                      key={shop.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        setSelectedShop((s) => (s?.id === shop.id ? null : shop));
                        focusShop(shop, i);
                      }}
                      className={`cursor-pointer rounded-[var(--radius)] border p-4 transition-colors ${
                        shop.verified
                          ? "border-[hsl(var(--accent)/0.5)] bg-[hsl(var(--accent)/0.06)] hover:bg-[hsl(var(--accent)/0.1)]"
                          : selectedShop?.id === shop.id
                            ? "border-accent bg-secondary/60"
                            : "border-border bg-card hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            shop.verified ? "bg-[hsl(var(--accent-strong))] text-accent-foreground" : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {shop.verified ? "★" : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="truncate text-sm font-semibold text-foreground">{shop.name}</h4>
                            {shop.verified && (
                              <span className="flex-shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-strong">
                                Verified partner
                              </span>
                            )}
                          </div>
                          {shop.address && (
                            <p className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{shop.address}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3">
                            {shop.phone && (
                              <span className="flex items-center gap-1 text-xs text-foreground">
                                <Phone className="h-3 w-3" />
                                {shop.phone}
                              </span>
                            )}
                            {shop.opening && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className="max-w-[100px] truncate">{shop.opening}</span>
                              </span>
                            )}
                            <span className="ml-auto font-mono text-xs font-semibold text-foreground">
                              {shop.distance_km < 1
                                ? `${(shop.distance_km * 1000).toFixed(0)}m`
                                : `${shop.distance_km.toFixed(1)}km`}{" "}
                              away
                            </span>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {selectedShop?.id === shop.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 flex gap-2 border-t border-border pt-3"
                          >
                            {shop.phone && (
                              <a
                                href={`tel:${shop.phone.replace(/\s+/g, "")}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius)] border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                              >
                                <Phone className="h-3 w-3" /> Call
                              </a>
                            )}
                            <button
                              className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius)] border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (location)
                                  window.open(
                                    `https://www.google.com/maps/dir/${location.lat},${location.lng}/${shop.lat},${shop.lng}`,
                                    "_blank",
                                  );
                              }}
                            >
                              <Navigation className="h-3 w-3" /> Directions
                            </button>
                            {shop.verified && shop.shopkeeperId ? (
                              <button
                                className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius)] bg-primary py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requireAuth(() => navigate(`/messages?shop=${shop.shopkeeperId}`));
                                }}
                              >
                                <MessageCircle className="h-3 w-3" /> Message
                              </button>
                            ) : (
                              <button
                                className="flex flex-1 items-center justify-center gap-1 rounded-[var(--radius)] bg-primary py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(
                                    `https://www.openstreetmap.org/?mlat=${shop.lat}&mlon=${shop.lng}#map=18/${shop.lat}/${shop.lng}`,
                                    "_blank",
                                  );
                                }}
                              >
                                <ExternalLink className="h-3 w-3" /> View on map
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default RepairShopLocator;
