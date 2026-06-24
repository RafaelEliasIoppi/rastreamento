// Coverage / "Mapa do Medo" — pure, stateless vulnerability math.
//
// Renders the NEGATIVE space of emergency response: for every point on a grid,
// how long until the nearest *available* unit could arrive. Humans see the
// vehicles; this surfaces the holes they leave behind.

// Average urban response speed used to turn distance into time (km/h).
const RESPONSE_SPEED_KMH = 40;

// Risk thresholds in minutes → used by the frontend to pick colors.
const RISK_GOOD_MIN = 2;   // < 2 min  → verde neon
const RISK_BAD_MIN = 6;    // > 6 min  → vermelho

/**
 * Great-circle-ish distance in km between two lat/lng points.
 * Equirectangular approximation — plenty accurate at city scale and cheap.
 */
function distanceKm(aLat, aLng, bLat, bLng) {
  const meanLat = ((aLat + bLat) / 2) * Math.PI / 180;
  const dLat = (bLat - aLat) * 111.32;
  const dLng = (bLng - aLng) * 111.32 * Math.cos(meanLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Builds a cols×rows grid of points covering the given bounds.
 * @param {{south,west,north,east}} bounds
 * @returns {{lat,lng}[]}
 */
function buildGrid(bounds, cols = 12, rows = 12) {
  const points = [];
  const latStep = (bounds.north - bounds.south) / (rows - 1);
  const lngStep = (bounds.east - bounds.west) / (cols - 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      points.push({
        lat: bounds.south + latStep * r,
        lng: bounds.west + lngStep * c,
      });
    }
  }
  return points;
}

/**
 * Minutes until the nearest AVAILABLE vehicle reaches a point. Vehicles that
 * are themselves in emergency are excluded — they can't cover anyone else.
 * Returns Infinity if no unit is available.
 */
function timeToRescueMin(point, vehicles) {
  let best = Infinity;
  for (const v of vehicles) {
    if (v.status === 'emergency') continue;
    const km = distanceKm(point.lat, point.lng, v.lat, v.lng);
    const min = (km / RESPONSE_SPEED_KMH) * 60;
    if (min < best) best = min;
  }
  return best;
}

/**
 * Full risk grid: each cell with its time-to-rescue and a 0..1 risk score.
 * The frontend maps `risk` to a green→red color. Pure: no Date/DB/IO.
 */
function buildRiskGrid(bounds, vehicles, cols = 12, rows = 12) {
  return buildGrid(bounds, cols, rows).map(p => {
    const minutes = timeToRescueMin(p, vehicles);
    const clamped = Math.max(RISK_GOOD_MIN, Math.min(RISK_BAD_MIN, minutes));
    const risk = (clamped - RISK_GOOD_MIN) / (RISK_BAD_MIN - RISK_GOOD_MIN);
    return { lat: p.lat, lng: p.lng, minutes, risk };
  });
}

module.exports = {
  RESPONSE_SPEED_KMH,
  RISK_GOOD_MIN,
  RISK_BAD_MIN,
  distanceKm,
  buildGrid,
  timeToRescueMin,
  buildRiskGrid,
};
