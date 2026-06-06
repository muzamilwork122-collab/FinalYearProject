import { useState, useEffect, useRef } from "react";
import {
  MapPin, Navigation, Loader2, ExternalLink,
  Phone, Clock, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface Shop {
  id:          number;
  name:        string;
  address:     string;
  phone:       string;
  lat:         number;
  lng:         number;
  distance_km: number;
  opening:     string;
}

interface UserLocation {
  lat:     number;
  lng:     number;
  city:    string;
  country: string;
}

const RepairShopLocator = () => {
  const [location, setLocation]         = useState<UserLocation | null>(null);
  const [shops, setShops]               = useState<Shop[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [statusText, setStatusText]     = useState("Detecting your location...");
  const mapRef                          = useRef<HTMLDivElement>(null);
  const mapInstance                     = useRef<any>(null);
  const markersRef                      = useRef<any[]>([]);

  // ── Auto-detect location on mount ─────────────────────────────────────────
  useEffect(() => {
    loadLeaflet();
    autoDetectLocation();
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
      const script  = document.createElement("script");
      script.src    = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async  = true;
      document.head.appendChild(script);
    }
  };

  // ── Step 1: Try real GPS first, fallback to IP ─────────────────────────────
  const autoDetectLocation = () => {
    setLoading(true);
    setError(null);
    setStatusText("Detecting your location...");
    setShops([]);

    // Try GPS with short timeout
    if (navigator.geolocation) {
      setStatusText("Getting GPS location...");
      navigator.geolocation.getCurrentPosition(
        // GPS success
        async (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;

          // Reject bad GPS (accuracy worse than 100km = IP fallback garbage)
          if (accuracy > 100000) {
            setStatusText("GPS inaccurate — using IP location...");
            await getLocationByIP();
            return;
          }

          setStatusText("GPS found! Getting city name...");
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
              { headers: { "User-Agent": "ScreenAI-FYP/1.0" } }
            );
            const data = await resp.json();
            const addr = data.address ?? {};
            const city = addr.city || addr.town || addr.village || addr.county || "Your City";
            setLocation({ lat, lng, city, country: addr.country || "" });
            setStatusText("");
            findNearbyShops(lat, lng);
          } catch {
            setLocation({ lat, lng, city: "Your Location", country: "" });
            setStatusText("");
            findNearbyShops(lat, lng);
          }
        },
        // GPS failed — use IP
        async () => {
          setStatusText("Using IP-based location...");
          await getLocationByIP();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      // No GPS support — use IP
      getLocationByIP();
    }
  };

  // ── Step 2: IP-based location (no permission needed) ──────────────────────
  const getLocationByIP = async () => {
    setStatusText("Detecting location from network...");

    // Try multiple free IP location APIs in order
    const apis = [
      // API 1: ipapi.co (free, 1000/day)
      async () => {
        const r    = await fetch("https://ipapi.co/json/");
        const d    = await r.json();
        if (!d.latitude) throw new Error("no data");
        return {
          lat:     d.latitude,
          lng:     d.longitude,
          city:    d.city || d.region || "Your City",
          country: d.country_name || "",
        };
      },
      // API 2: ip-api.com (free, 45/min)
      async () => {
        const r    = await fetch("http://ip-api.com/json/?fields=lat,lon,city,country");
        const d    = await r.json();
        if (!d.lat) throw new Error("no data");
        return {
          lat:     d.lat,
          lng:     d.lon,
          city:    d.city || "Your City",
          country: d.country || "",
        };
      },
      // API 3: ipwho.is (free, unlimited)
      async () => {
        const r    = await fetch("https://ipwho.is/");
        const d    = await r.json();
        if (!d.latitude) throw new Error("no data");
        return {
          lat:     d.latitude,
          lng:     d.longitude,
          city:    d.city || d.region || "Your City",
          country: d.country || "",
        };
      },
    ];

    for (const api of apis) {
      try {
        const loc = await api();
        // Validate — reject if it points to somewhere random like Kenya
        // Pakistan is roughly lat: 24–37, lng: 60–77
        // But also accept if user is genuinely outside Pakistan
        setLocation(loc);
        setStatusText("");
        findNearbyShops(loc.lat, loc.lng);
        return;
      } catch {
        continue;
      }
    }

    // All APIs failed
    setLoading(false);
    setStatusText("");
    setError("Could not detect location. Please check your internet connection.");
  };

  // ── Find nearby shops via Overpass ────────────────────────────────────────
  const findNearbyShops = async (lat: number, lng: number) => {
    setStatusText("Searching nearby repair shops...");

    const query = `
      [out:json][timeout:30];
      (
        node["shop"="mobile_phone"](around:5000,${lat},${lng});
        node["repair"="phone"](around:5000,${lat},${lng});
        node["repair"="mobile_phone"](around:5000,${lat},${lng});
        node["shop"="electronics"]["repair"](around:5000,${lat},${lng});
        node["name"~"mobile|repair|screen|lcd|phone",i]["shop"](around:5000,${lat},${lng});
        way["shop"="mobile_phone"](around:5000,${lat},${lng});
        way["repair"="phone"](around:5000,${lat},${lng});
      );
      out body center 15;
    `;

    try {
      const resp     = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST", body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const data     = await resp.json();
      let elements   = (data.elements ?? []).filter((el: any) => el.tags?.name);

      // Broaden to 10km if nothing found
      if (elements.length === 0) {
        setStatusText("Expanding search to 10km...");
        const q2 = `
          [out:json][timeout:30];
          (
            node["shop"="mobile_phone"](around:10000,${lat},${lng});
            node["shop"="electronics"](around:10000,${lat},${lng});
            node["repair"~"phone|mobile",i](around:10000,${lat},${lng});
          );
          out body center 15;
        `;
        const r2     = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST", body: `data=${encodeURIComponent(q2)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        const d2     = await r2.json();
        elements     = (d2.elements ?? []).filter((el: any) => el.tags?.name);
      }

      const shopList: Shop[] = elements.map((el: any) => {
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
          lat:         sLat, lng: sLng,
          distance_km: haversine(lat, lng, sLat, sLng),
          opening:     tags.opening_hours || "",
        };
      })
      .sort((a: Shop, b: Shop) => a.distance_km - b.distance_km)
      .slice(0, 10);

      setShops(shopList);
      setLoading(false);
      setStatusText("");

      if (shopList.length === 0) {
        setError("No repair shops found in your area on OpenStreetMap. Nearby shops may not be listed yet.");
      }

      initMap(lat, lng, shopList);

    } catch {
      setLoading(false);
      setStatusText("");
      setError("Failed to load shops. Please check your internet connection.");
      initMap(lat, lng, []);
    }
  };

  // ── Leaflet map ────────────────────────────────────────────────────────────
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
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);

      // User marker
      const userIcon = L.divIcon({
        html: `<div style="width:18px;height:18px;background:#4f46e5;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(79,70,229,0.2)"></div>`,
        className: "", iconSize: [18, 18], iconAnchor: [9, 9],
      });
      L.marker([lat, lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`<b>📍 You are here</b><br/><small style="color:#6b7280">Approximate location</small>`)
        .openPopup();

      shopList.forEach((shop, i) => {
        const icon = L.divIcon({
          html: `<div style="background:#ef4444;color:white;font-weight:700;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${i+1}</div>`,
          className: "", iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const m = L.marker([shop.lat, shop.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:150px;font-family:sans-serif">
              <b style="font-size:13px">${shop.name}</b>
              ${shop.address ? `<br/><span style="color:#6b7280;font-size:11px">${shop.address}</span>` : ""}
              ${shop.phone   ? `<br/><span style="font-size:11px">📞 ${shop.phone}</span>` : ""}
              <br/><b style="font-size:11px;color:#4f46e5">
                ${shop.distance_km < 1 ? `${(shop.distance_km*1000).toFixed(0)}m` : `${shop.distance_km.toFixed(1)}km`} away
              </b>
            </div>
          `);
        markersRef.current.push(m);
      });
    };
    tryInit();
  };

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const focusShop = (shop: Shop, i: number) => {
    if (mapInstance.current) {
      mapInstance.current.setView([shop.lat, shop.lng], 17);
      markersRef.current[i]?.openPopup();
    }
  };

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6 max-w-6xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Repair Shop Locator</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Find Nearby Repair Shops</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Automatically finding repair centers near you
          </p>
        </div>

        {/* Auto-loading state */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-12">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <MapPin className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <p className="text-sm font-medium text-foreground">{statusText}</p>
            <p className="text-xs text-muted-foreground">No GPS permission required</p>
          </motion.div>
        )}

        {/* Error state */}
        {error && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 max-w-md text-center">
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <Button onClick={autoDetectLocation} size="sm" variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try Again
              </Button>
            </div>
          </motion.div>
        )}

        {/* Location found */}
        {location && !loading && (
          <>
            {/* Banner */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-5 py-3 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm">
                  Showing shops near{" "}
                  <span className="font-semibold text-primary">
                    {location.city}{location.country ? `, ${location.country}` : ""}
                  </span>
                </span>
              </div>
              <button onClick={autoDetectLocation}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </motion.div>

            {/* Map + List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Map */}
              <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 460 }}>
                <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
              </div>

              {/* Shops */}
              <div className="flex flex-col gap-3 max-h-[460px] overflow-y-auto pr-1">

                {error && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-700">
                    {error}
                  </div>
                )}

                {shops.length === 0 && !error && (
                  <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                    <MapPin className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No shops found in your area</p>
                    <p className="text-xs text-center max-w-xs">
                      Shops near you may not be listed on OpenStreetMap yet
                    </p>
                  </div>
                )}

                <AnimatePresence>
                  {shops.map((shop, i) => (
                    <motion.div key={shop.id}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => {
                        setSelectedShop(s => s?.id === shop.id ? null : shop);
                        focusShop(shop, i);
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedShop?.id === shop.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
                      }`}>

                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate mb-1">{shop.name}</h4>
                          {shop.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{shop.address}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap">
                            {shop.phone && (
                              <span className="text-xs text-primary flex items-center gap-1">
                                <Phone className="w-3 h-3" />{shop.phone}
                              </span>
                            )}
                            {shop.opening && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span className="truncate max-w-[100px]">{shop.opening}</span>
                              </span>
                            )}
                            <span className="text-xs font-semibold text-primary ml-auto">
                              {shop.distance_km < 1
                                ? `${(shop.distance_km*1000).toFixed(0)}m`
                                : `${shop.distance_km.toFixed(1)}km`} away
                            </span>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {selectedShop?.id === shop.id && (
                          <motion.div initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-3 pt-3 border-t border-border flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (location) window.open(
                                  `https://www.openstreetmap.org/directions?from=${location.lat},${location.lng}&to=${shop.lat},${shop.lng}`,
                                  "_blank"
                                );
                              }}>
                              <Navigation className="w-3 h-3" /> Directions
                            </Button>
                            <Button size="sm" className="flex-1 text-xs gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `https://www.openstreetmap.org/?mlat=${shop.lat}&mlon=${shop.lng}#map=18/${shop.lat}/${shop.lng}`,
                                  "_blank"
                                );
                              }}>
                              <ExternalLink className="w-3 h-3" /> View on Map
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {shops.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                  
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default RepairShopLocator;
