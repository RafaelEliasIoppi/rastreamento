const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- Vehicle simulation data ---

const VEHICLE_TYPES = ['ambulancia', 'policia', 'bombeiros'];
const TYPE_NAMES = {
  ambulancia: 'Ambulancia',
  policia: 'Policia',
  bombeiros: 'Bombeiros'
};

const SAO_PAULO_CENTER = { lat: -23.5505, lng: -46.6333 };
const SPREAD = 0.045; // roughly 5 km spread

function randomInRange(center, spread) {
  return center + (Math.random() - 0.5) * 2 * spread;
}

function createVehicles() {
  const names = [
    { id: 'AMB-01', name: 'Ambulancia Alpha', type: 'ambulancia' },
    { id: 'AMB-02', name: 'Ambulancia Bravo', type: 'ambulancia' },
    { id: 'POL-01', name: 'Viatura Sigma', type: 'policia' },
    { id: 'POL-02', name: 'Viatura Delta', type: 'policia' },
    { id: 'BOM-01', name: 'Resgate Fenix', type: 'bombeiros' },
    { id: 'BOM-02', name: 'Resgate Titan', type: 'bombeiros' }
  ];

  return names.map(v => ({
    ...v,
    lat: randomInRange(SAO_PAULO_CENTER.lat, SPREAD),
    lng: randomInRange(SAO_PAULO_CENTER.lng, SPREAD),
    speed: 30 + Math.random() * 50, // km/h
    heading: Math.random() * 360,
    status: 'normal',
    lastUpdate: Date.now()
  }));
}

const vehicles = createVehicles();
const emergencyLog = [];

// --- Realistic movement simulation ---

function moveVehicle(v) {
  // Slight random heading change to simulate driving
  v.heading += (Math.random() - 0.5) * 30;
  if (v.heading < 0) v.heading += 360;
  if (v.heading >= 360) v.heading -= 360;

  // Speed variation
  v.speed += (Math.random() - 0.5) * 10;
  v.speed = Math.max(15, Math.min(90, v.speed));

  const dt = 2; // seconds between updates
  const distKm = (v.speed / 3600) * dt;
  const dLat = (distKm / 111.32) * Math.cos((v.heading * Math.PI) / 180);
  const dLng = (distKm / (111.32 * Math.cos((v.lat * Math.PI) / 180))) * Math.sin((v.heading * Math.PI) / 180);

  v.lat += dLat;
  v.lng += dLng;

  // Keep within bounds of Sao Paulo area
  const latMin = SAO_PAULO_CENTER.lat - SPREAD * 1.2;
  const latMax = SAO_PAULO_CENTER.lat + SPREAD * 1.2;
  const lngMin = SAO_PAULO_CENTER.lng - SPREAD * 1.2;
  const lngMax = SAO_PAULO_CENTER.lng + SPREAD * 1.2;

  if (v.lat < latMin || v.lat > latMax) {
    v.heading = 180 - v.heading;
    v.lat = Math.max(latMin, Math.min(latMax, v.lat));
  }
  if (v.lng < lngMin || v.lng > lngMax) {
    v.heading = 360 - v.heading;
    v.lng = Math.max(lngMin, Math.min(lngMax, v.lng));
  }

  v.lastUpdate = Date.now();
}

// Update positions every 2 seconds
setInterval(() => {
  vehicles.forEach(moveVehicle);
  io.emit('vehicles-update', vehicles);
}, 2000);

// --- Socket.IO events ---

io.on('connection', (socket) => {
  console.log(`[CONNECT] Cliente conectado: ${socket.id}`);

  // Send initial data
  socket.emit('vehicles-update', vehicles);
  socket.emit('emergency-log', emergencyLog.slice(-20));

  // Handle emergency button press
  socket.on('emergency', (data) => {
    const vehicle = vehicles.find(v => v.id === data.vehicleId);
    if (vehicle) {
      vehicle.status = 'emergency';
      const entry = {
        id: Date.now().toString(),
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        vehicleType: vehicle.type,
        lat: vehicle.lat,
        lng: vehicle.lng,
        timestamp: Date.now(),
        message: data.message || 'Solicitacao de apoio!'
      };
      emergencyLog.push(entry);
      console.log(`[EMERGENCIA] ${vehicle.name} solicitou apoio em (${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)})`);
      io.emit('emergency-alert', entry);

      // Auto-reset status after 15 seconds
      setTimeout(() => {
        vehicle.status = 'normal';
      }, 15000);
    }
  });

  // Handle clear emergency
  socket.on('clear-emergency', (data) => {
    const vehicle = vehicles.find(v => v.id === data.vehicleId);
    if (vehicle) {
      vehicle.status = 'normal';
      console.log(`[LIMPAR] Emergencia de ${vehicle.name} encerrada`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[DESCONECTAR] Cliente desconectado: ${socket.id}`);
  });
});

// --- Start ---

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  RASTREAMENTO DE EMERGENCIA`);
  console.log(`  Servidor rodando na porta ${PORT}`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`${vehicles.length} veiculos simulados ativos.`);
});
