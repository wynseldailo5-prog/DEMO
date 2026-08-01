import { useEffect, useRef } from "react";
import { LAGUNA_CENTER } from "@/lib/laguna";

export default function MapPicker({ value, onChange, height = 260 }) {
  const ref = useRef();
  const markerRef = useRef();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!window.L || !ref.current) return;
    const has = value?.lat != null;
    const center = has ? [value.lat, value.lng] : [LAGUNA_CENTER.lat, LAGUNA_CENTER.lng];
    const map = window.L.map(ref.current, { scrollWheelZoom: false }).setView(center, has ? 14 : 11);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 19,
    }).addTo(map);
    if (has) markerRef.current = window.L.marker(center).addTo(map);
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      else markerRef.current = window.L.marker([lat, lng]).addTo(map);
      onChangeRef.current({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
    });
    const invalidateTimer = setTimeout(() => { try { map.invalidateSize(); } catch (_) {} }, 250);
    return () => { clearTimeout(invalidateTimer); map.remove(); };
    // eslint-disable-next-line
  }, []);

  return <div ref={ref} data-testid="map-picker" style={{ height }} className="rounded-xl overflow-hidden border border-border relative" />;
}
