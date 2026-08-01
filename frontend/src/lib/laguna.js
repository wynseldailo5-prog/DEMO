export const LAGUNA_CENTER = { lat: 14.17, lng: 121.33 };

export const MUNICIPALITIES = {
  "Calamba": { lat: 14.2117, lng: 121.1653 },
  "Los Baños": { lat: 14.1699, lng: 121.2415 },
  "Santa Cruz": { lat: 14.2813, lng: 121.4162 },
  "San Pablo": { lat: 14.0683, lng: 121.3256 },
  "Paete": { lat: 14.365, lng: 121.484 },
  "Nagcarlan": { lat: 14.136, lng: 121.417 },
  "Liliw": { lat: 14.129, lng: 121.435 },
  "Bay": { lat: 14.184, lng: 121.283 },
  "Cabuyao": { lat: 14.275, lng: 121.124 },
  "Biñan": { lat: 14.337, lng: 121.081 },
  "Santa Rosa": { lat: 14.312, lng: 121.111 },
  "San Pedro": { lat: 14.359, lng: 121.048 },
};

export function matchCoords(str) {
  if (!str) return LAGUNA_CENTER;
  for (const [name, c] of Object.entries(MUNICIPALITIES)) {
    if (str.toLowerCase().includes(name.toLowerCase())) return c;
  }
  return LAGUNA_CENTER;
}
