const os = require('os');
const QRCode = require('qrcode');
const path = require('path');

// 1. Find the local network IP address (e.g. 192.168.x.x or 10.x.x.x)
const interfaces = os.networkInterfaces();
let localIp = 'localhost';

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    // Skip internal and non-IPv4 addresses
    if (!iface.internal && iface.family === 'IPv4') {
      localIp = iface.address;
      break; // Just grab the first non-internal IPv4
    }
  }
  if (localIp !== 'localhost') break;
}

// 2. Construct the frontend URL
const frontendUrl = `https://${localIp}:5173/`;

console.log('Found Local Network IP:', localIp);
console.log('Generating QR Code for URL:', frontendUrl);

// 3. Generate QR code image and save to the root project directory
const outputPath = path.join(__dirname, '..', 'app_link.png');

QRCode.toFile(outputPath, frontendUrl, {
  color: {
    dark: '#000000',
    light: '#ffffff'
  },
  width: 500,
  margin: 2
}, function (err) {
  if (err) throw err;
  console.log('Successfully generated generic App QR Code!');
  console.log('File saved at:', outputPath);
});
