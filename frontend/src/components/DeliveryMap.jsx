import { useEffect, useRef } from "react";
import { LAGUNA_CENTER, matchCoords } from "@/lib/laguna";

function pin(color, label) {
  return window.L.divIcon({
    className: "",
    html: `<div style="position:relative"><span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);color:#fff;font-size:13px;font-weight:700">${label}</span></span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30],
  });
}

export default function DeliveryMap({ order, height = 260 }) {
  const ref = useRef();
  const rafRef = useRef();

  useEffect(() => {
    if (!window.L || !ref.current) return;
    const isPickup = order.fulfillment_type === "pickup";
    const dropoff = order.delivery_lat != null
      ? { lat: order.delivery_lat, lng: order.delivery_lng }
      : matchCoords(order.delivery_address);
    const pickupCoord = matchCoords(order.pickup_location || order.items?.[0]?.location);

    const focus = isPickup ? pickupCoord : dropoff;
    const map = window.L.map(ref.current, { scrollWheelZoom: false, zoomControl: true }).setView([focus.lat, focus.lng], 12);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 19,
    }).addTo(map);

    if (isPickup) {
      window.L.marker([pickupCoord.lat, pickupCoord.lng], { icon: pin("#2D5A40", "P") })
        .addTo(map).bindPopup(`Pickup point<br>${order.pickup_location || "Farm location"}`);
      map.setView([pickupCoord.lat, pickupCoord.lng], 13);
    } else {
      window.L.marker([dropoff.lat, dropoff.lng], { icon: pin("#E07A5F", "H") }).addTo(map).bindPopup("Delivery address");
      const origin = order.rider?.lat != null ? { lat: order.rider.lat, lng: order.rider.lng } : LAGUNA_CENTER;
      if (order.rider) {
        const line = window.L.polyline([[origin.lat, origin.lng], [dropoff.lat, dropoff.lng]], { color: "#2D5A40", weight: 3, dashArray: "6 8", opacity: 0.7 }).addTo(map);
        map.fitBounds(line.getBounds().pad(0.3));
        const riderMarker = window.L.marker([origin.lat, origin.lng], { icon: pin("#2D5A40", "R") }).addTo(map).bindPopup(`${order.rider.name}<br>${order.rider.vehicle}`);

        if (order.status === "out_for_delivery") {
          let t = 0;
          const step = () => {
            t += 0.004;
            const p = (Math.sin(t * Math.PI - Math.PI / 2) + 1) / 2; // ease loop 0->1->0
            const lat = origin.lat + (dropoff.lat - origin.lat) * p;
            const lng = origin.lng + (dropoff.lng - origin.lng) * p;
            riderMarker.setLatLng([lat, lng]);
            rafRef.current = requestAnimationFrame(step);
          };
          rafRef.current = requestAnimationFrame(step);
        } else if (order.status === "delivered") {
          riderMarker.setLatLng([dropoff.lat, dropoff.lng]);
        }
      }
    }
    const invalidateTimer = setTimeout(() => { try { map.invalidateSize(); } catch (_) {} }, 250);
    return () => { clearTimeout(invalidateTimer); if (rafRef.current) cancelAnimationFrame(rafRef.current); map.remove(); };
    // eslint-disable-next-line
  }, [order.id, order.status, order.rider?.id]);

  return <div ref={ref} data-testid="delivery-map" style={{ height }} className="rounded-xl overflow-hidden border border-border relative" />;
}
