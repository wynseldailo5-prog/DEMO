import { useEffect, useRef, useState } from "react";
import { LAGUNA_CENTER } from "@/lib/laguna";
import { LocateFixed, Loader2 } from "lucide-react";

async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { "Accept-Language": "en" },
    });
    const d = await r.json();
    return d.display_name || "";
  } catch { return ""; }
}

export default function MapPicker({ value, onChange, height = 260 }) {
  const ref = useRef();
  const mapRef = useRef();
  const markerRef = useRef();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [locating, setLocating] = useState(false);

  const setPin = async (lat, lng, zoom) => {
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current);
    if (zoom) mapRef.current.setView([lat, lng], zoom);
    const address = await reverseGeocode(lat, lng);
    onChangeRef.current({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)), address });
  };

  useEffect(() => {
    if (!window.L || !ref.current) return;
    const has = value?.lat != null;
    const center = has ? [value.lat, value.lng] : [LAGUNA_CENTER.lat, LAGUNA_CENTER.lng];
    const map = window.L.map(ref.current, { scrollWheelZoom: false }).setView(center, has ? 15 : 11);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    if (has) markerRef.current = window.L.marker(center).addTo(map);
    map.whenReady(() => map.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng)));
    setTimeout(() => map.invalidateSize(), 250);
    return () => map.remove();
    // eslint-disable-next-line
  }, []);

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await setPin(pos.coords.latitude, pos.coords.longitude, 16); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="relative">
      <div ref={ref} data-testid="map-picker" style={{ height }} className="rounded-xl overflow-hidden border border-border" />
      <button type="button" onClick={locate} data-testid="locate-me-btn"
        className="absolute bottom-3 right-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-background border border-border shadow px-3 py-1.5 text-xs font-medium hover:bg-secondary">
        {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />} Use my location
      </button>
    </div>
  );
}
