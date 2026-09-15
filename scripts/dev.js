#!/usr/bin/env node
/**
 * Host de desarrollo de EcoWheel que NO se rompe si el puerto ya esta ocupado.
 *
 *   - Si ya hay un host sirviendo EcoWheel en el puerto: lo reutiliza y avisa
 *     (evita el clasico "Error: listen EADDRINUSE: address already in use").
 *   - Si el puerto lo ocupa otro programa que no responde EcoWheel: lo explica
 *     y sugiere otro puerto, sin lanzar el error crudo de Node.
 *   - Si el puerto esta libre: arranca http-server en primer plano.
 *
 * Usa solo modulos nativos de Node (sin dependencias extra).
 */
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8080);

/** true si en el puerto ya responde el EcoWheel (HTTP 200 en /index.html). */
function ecoWheelResponde(port, timeout = 2500) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/index.html', timeout }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

/** true si podemos escuchar en ese puerto (nadie mas lo tiene tomado). */
function puertoLibre(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

/** IPv4 de la red local (para abrir desde el celular / proyector). */
function ipsLan() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const nombre of Object.keys(ifaces)) {
    for (const info of ifaces[nombre] || []) {
      if (info.family === 'IPv4' && !info.internal) out.push({ nombre, ip: info.address });
    }
  }
  return out;
}

function imprimirEnlaces() {
  console.log('');
  console.log(`  Wheel ........ http://localhost:${PORT}/`);
  console.log(`  Admin ........ http://localhost:${PORT}/admin.html`);
  for (const { nombre, ip } of ipsLan()) {
    console.log(`  Red local .... http://${ip}:${PORT}/   (${nombre})`);
  }
}

(async () => {
  if (await ecoWheelResponde(PORT)) {
    console.log(`[OK] El host de EcoWheel YA esta encendido en el puerto ${PORT}.`);
    console.log('     No hace falta arrancar otro (por eso npm run dev daba EADDRINUSE).');
    imprimirEnlaces();
    console.log('');
    console.log('  Abre el navegador en esos enlaces. Para reiniciar el host:');
    console.log(`     cierra la ventana minimizada "EcoWheel host ${PORT}" o ejecuta`);
    console.log('     Get-Process node | Stop-Process -Force');
    console.log('');
    return; // sale con codigo 0: no es un error
  }

  if (!(await puertoLibre(PORT))) {
    console.error(`[XX] El puerto ${PORT} lo esta usando OTRO programa (no responde EcoWheel).`);
    console.error('     Cierra ese programa, o arranca EcoWheel en otro puerto:');
    console.error(`        $env:PORT=8090; npm run dev     (PowerShell)`);
    console.error(`        set PORT=8090 && npm run dev    (CMD)`);
    process.exit(1);
  }

  const bin = path.join(ROOT, 'node_modules', 'http-server', 'bin', 'http-server');
  if (!fs.existsSync(bin)) {
    console.error('[XX] Falta http-server. Ejecuta primero:  npm install');
    process.exit(1);
  }

  console.log(`[..] Arrancando http-server en el puerto ${PORT}...`);
  imprimirEnlaces();
  console.log('     Ctrl+C para detenerlo.');
  console.log('');

  const hijo = spawn(process.execPath, [bin, '.', '-p', String(PORT), '-c-1'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  hijo.on('exit', (code) => process.exit(typeof code === 'number' ? code : 0));
})();