// Deterministic vehicle simulation that works without persistent state.
// Uses time-based sine/cosine waves so every serverless invocation computes
// the same position for a given timestamp.

const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };
const SPREAD = 0.04; // ~4.5 km

const VEHICLES = [
  { id: 'AMB-01', name: 'Ambulancia Alpha',  type: 'ambulancia', seed: 1 },
  { id: 'AMB-02', name: 'Ambulancia Bravo',  type: 'ambulancia', seed: 2 },
  { id: 'POL-01', name: 'Viatura Sigma',     type: 'policia',    seed: 3 },
  { id: 'POL-02', name: 'Viatura Delta',     type: 'policia',    seed: 4 },
  { id: 'BOM-01', name: 'Resgate Fenix',     type: 'bombeiros',  seed: 5 },
  { id: 'BOM-02', name: 'Resgate Titan',     type: 'bombeiros',  seed: 6 },
];

// Reference epoch so elapsed time is manageable
const EPOCH = new Date('2025-01-01T00:00:00Z').getTime();

/**
 * Deterministically calculate a vehicle's position at the current moment.
 * Each vehicle traces a unique Lissajous-like loop around São Paulo using
 * different frequency ratios so paths never overlap exactly.
 */
function calculatePosition(vehicle, nowMs) {
  const elapsed = (nowMs - EPOCH) / 1000; // seconds since epoch
  const s = vehicle.seed;

  // Unique frequencies per vehicle (radians per second)
  const freqLat1 = 0.005 + s * 0.0013;
  const freqLng1 = 0.007 + s * 0.0011;
  const freqLat2 = 0.003 + s * 0.0009;
  const freqLng2 = 0.004 + s * 0.0007;

  // Phase offsets based on seed
  const phaseLat = s * 1.1;
  const phaseLng = s * 0.7;

  // Combine two sine waves for more organic movement
  const latOffset = (
    Math.sin(elapsed * freqLat1 + phaseLat) * 0.6 +
    Math.sin(elapsed * freqLat2 + phaseLat * 2) * 0.4
  ) * SPREAD;

  const lngOffset = (
    Math.cos(elapsed * freqLng1 + phaseLng) * 0.6 +
    Math.cos(elapsed * freqLng2 + phaseLng * 2) * 0.4
  ) * SPREAD;

  const lat = SAO_PAULO.lat + latOffset;
  const lng = SAO_PAULO.lng + lngOffset;

  // Compute heading from the derivative of position
  const dt = 0.5; // small time delta for derivative
  const futureElapsed = elapsed + dt;

  const futureLat = SAO_PAULO.lat + (
    Math.sin(futureElapsed * freqLat1 + phaseLat) * 0.6 +
    Math.sin(futureElapsed * freqLat2 + phaseLat * 2) * 0.4
  ) * SPREAD;

  const futureLng = SAO_PAULO.lng + (
    Math.cos(futureElapsed * freqLng1 + phaseLng) * 0.6 +
    Math.cos(futureElapsed * freqLng2 + phaseLng * 2) * 0.4
  ) * SPREAD;

  const dLat = futureLat - lat;
  const dLng = futureLng - lng;
  let heading = Math.atan2(dLng, dLat) * (180 / Math.PI);
  if (heading < 0) heading += 360;

  // Speed in km/h (approximate from derivative)
  const distKm = Math.sqrt(
    (dLat * 111.32) ** 2 +
    (dLng * 111.32 * Math.cos(lat * Math.PI / 180)) ** 2
  );
  const speed = (distKm / dt) * 3600; // km/h

  return {
    id: vehicle.id,
    name: vehicle.name,
    type: vehicle.type,
    lat,
    lng,
    heading: Math.round(heading * 10) / 10,
    speed: Math.round(Math.max(15, Math.min(90, speed)) * 10) / 10,
    status: 'normal',
    lastUpdate: nowMs,
  };
}

/**
 * Returns all 6 vehicles with their current calculated positions.
 */
function getAllVehiclePositions() {
  const now = Date.now();
  return VEHICLES.map(v => calculatePosition(v, now));
}

module.exports = { calculatePosition, getAllVehiclePositions, VEHICLES };
