# 09. Deployment & Operations Guide

## 1. Zero-Infrastructure Methodology
The Indoor Navigation Framework requires exactly zero physical infrastructure beyond standard printed QR codes. There is no Bluetooth beacon calibration, no UWB array installations, and no localized server racks required on-site.

## 2. Server Migration & The "Single QR" Architecture
The most critical operational failure point in legacy indoor navigation was hardcoded server IPs requiring thousands of room QRs to be reprinted upon migration. 

### 2.1. The Entry Point
- The architecture utilizes **one** single application-entry QR code (`app_link.png`) displayed at the building entrance.
- **Migration Procedure**:
  1. The administrator moves the server to a new IP or Domain.
  2. The administrator logs into the Web Dashboard.
  3. Navigates to **Deployment Settings**.
  4. Enters the new URL and clicks "Regenerate Entry QR".
  5. The backend (`QrController.java`) generates a new `app_link.png`.
  6. The facility manager prints *only this single QR code* and replaces the one at the entrance.

## 3. Environment Configuration
The backend looks for standard environment variables to connect to PostgreSQL. A `.env` file must be present in the project root for `docker-compose` to function correctly:
```env
POSTGRES_DB=indoor_nav
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
JWT_SECRET=yoursecretkey
```

### 3.1 Administrator Provisioning (Fresh Deployment)
Upon fresh deployment, the database contains zero administrator accounts. 
- The server owner must explicitly execute `admin_manager.bat` on the host machine to provision the initial administrator account.
- The `admin_manager.bat` tool communicates exclusively with the server's loopback or Site-Local LAN interface. Due to Docker Bridge NAT masquerading, the backend natively authorizes Docker Gateway IPs while ensuring external proxies (Nginx) explicitly block public traversal via `return 403;`.
- Once created via `admin_manager.bat`, the administrator must log into the web Dashboard using those credentials.

## 4. Dockerization (Implemented)
The deployment is fully containerized. A `docker-compose.yml` orchestrates the PostgreSQL persistence layer, the Spring Boot backend, and the Nginx reverse-proxy serving the built React static files.

## 5. Capacitor Native Build
To compile the React web application into a native Android APK:
1. `npm run build` (Compiles React to `/dist`).
2. `npx cap sync android` (Copies `/dist` into the native Android wrapper).
3. Compile via Android Studio / Gradle.
4. *Important*: If the native app cannot reach the server on boot, `CapacitorServerConfig.tsx` uses Admin Deployment Settings/runtime configurations to recover, bypassing the need for users to scan QR codes for native configuration.
