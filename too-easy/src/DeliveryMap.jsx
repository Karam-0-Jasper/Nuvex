import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, PLACES, nearestPlace } from "./places.js";

const ZONE_COLORS = {
  central: "#bf0a30", sinkor: "#e07a00", paynesville: "#1f7a4d",
  bushrod: "#1f4fbf", gardnersville: "#7a3fbf", outside: "#6b6a66",
};

const pinIcon = L.divIcon({
  className: "map-pin",
  html: '<svg viewBox="0 0 24 32" width="30" height="40"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 20 12 20s12-11.5 12-20C24 5.4 18.6 0 12 0z" fill="#0b0b0b"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

// Map of Greater Monrovia. Tap a community dot or anywhere on the map to set the drop-off point.
export default function DeliveryMap({ value, onPick, readOnly = false, height = 280 }) {
  const box = useRef(null);
  const map = useRef(null);
  const pin = useRef(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: !readOnly, attributionControl: true, dragging: !readOnly, scrollWheelZoom: false })
      .setView(value ? [value.lat, value.lng] : MAP_CENTER, value ? 14 : 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    if (!readOnly) {
      for (const p of PLACES) {
        L.circleMarker([p.lat, p.lng], { radius: 6, weight: 2, color: "#fff", fillColor: ZONE_COLORS[p.zone], fillOpacity: 1 })
          .bindTooltip(p.name, { direction: "top", offset: [0, -6] })
          .on("click", (e) => { L.DomEvent.stopPropagation(e); pick.current({ lat: p.lat, lng: p.lng, place: p, exact: false }); })
          .addTo(m);
      }
      m.on("click", (e) => {
        const point = [e.latlng.lat, e.latlng.lng];
        pick.current({ lat: point[0], lng: point[1], place: nearestPlace(point), exact: true });
      });
    }
    map.current = m;
    return () => { m.remove(); map.current = null; pin.current = null; };
  }, [readOnly]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) { pin.current?.remove(); pin.current = null; return; }
    const at = [value.lat, value.lng];
    if (pin.current) pin.current.setLatLng(at);
    else pin.current = L.marker(at, { icon: pinIcon, interactive: false }).addTo(m);
    m.flyTo(at, Math.max(m.getZoom(), 14), { duration: 0.6 });
  }, [value?.lat, value?.lng]);

  return <div ref={box} className="delivery-map" style={{ height }} role="application" aria-label="Delivery map of Monrovia" />;
}

export { ZONE_COLORS };
