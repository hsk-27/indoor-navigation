# 🏢 GHRCE Indoor Navigation System

A production-grade indoor navigation platform subject to pending publication. Provides real-time turn-by-turn pedestrian routing inside multi-floor buildings using sensor fusion, graph-based pathfinding, and an interactive administrative map editor — all accessible instantly via a single QR code scan.

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat&logo=spring-boot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?style=flat&logo=docker&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor_5-119EFF?style=flat&logo=capacitor&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Zero-Friction Entry** | Users scan a single QR code — no app store download needed. The web app launches instantly; an APK is available for enhanced sensor access. |
| **Pedestrian Dead Reckoning (PDR)** | Real-time step detection via EMA-filtered accelerometer data, Weinberg step-length estimation, and device orientation heading. |
| **Graph-Snapped Localization** | Orthogonal vector projection continuously snaps the user's noisy PDR position onto the nearest valid corridor edge. |
| **A\* Multi-Floor Routing** | Server-side pathfinding with 3D Euclidean heuristics and a 3-tier intermediate floor penalty system for optimal cross-floor routes. |
| **Turn-by-Turn Voice Guidance** | Angular deflection analysis generates contextual instructions ("Turn Left", "Take Stairs to Floor 3") delivered via Web Speech API. |
| **Visual Graph Editor** | Administrators draw nodes and edges directly on SVG floor plans with undo/redo, real-time validation, and PPM calibration tools. |
| **Multi-Floor Navigation** | Automatic route segmentation at staircase/lift nodes with floor transition checkpoints and predictive voice announcements. |
| **Containerized Deployment** | Single `docker compose up` boots the entire stack: PostgreSQL, Spring Boot API, Nginx reverse proxy, and automated database backups. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT TIER                                                         │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ Android APK         │  │ Web Browser (React 18 SPA)             │ │
│  │ (Capacitor 5)       │  │  ├── PDR Engine (EMA + Weinberg)       │ │
│  │ Accelerometer       │──│  ├── Graph Snapper (Vector Projection) │ │
│  │ Gyroscope           │  │  ├── SVG Map Viewer (CSS GPU Accel.)   │ │
│  │ Magnetometer        │  │  └── Voice Guidance (Web Speech API)   │ │
│  └─────────────────────┘  └──────────────┬─────────────────────────┘ │
└──────────────────────────────────────────┼───────────────────────────┘
                                           │ HTTP/REST
┌──────────────────────────────────────────┼───────────────────────────┐
│  SERVER TIER (Docker Compose)            │                           │
│  ┌────────────────┐  ┌───────────────────▼─────────────────────────┐ │
│  │ Nginx          │  │ Spring Boot 3.x (Java 21)                   │ │
│  │ Reverse Proxy  │──│  ├── JWT Authentication                     │ │
│  │ Port :5173     │  │  ├── In-Memory Graph Cache (Atomic Swap)    │ │
│  └────────────────┘  │  ├── A* Routing Engine (3D Heuristic)       │ │
│                      │  └── Turn-by-Turn Instruction Generator     │ │
│                      └──────────────────┬──────────────────────────┘ │
│                      ┌──────────────────▼──────────────────────────┐ │
│                      │ PostgreSQL 15 (Port :5432)                   │ │
│                      │  buildings → floors → nodes → edges          │ │
│                      │  graph_metadata (PPM, north offset)          │ │
│                      └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose)
- **For APK rebuilds only**: Node.js 20+, Android SDK, JDK 21+

### 1. Clone & Configure

```bash
git clone https://github.com/<your-username>/indoor-navigation.git
cd indoor-navigation
cp .env.example .env
```

Edit `.env` to set your database credentials and JWT secret:

```env
POSTGRES_DB=indoor_nav
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_64_char_hex_secret
```

### 2. Launch (One Command)

**Windows (Recommended):**
```
start.bat
```
This automatically detects your network IP, boots all Docker containers, restores the database, updates the deployment QR code, and rebuilds the APK if the network changed.

**Linux/macOS:**
```bash
chmod +x start.sh
./start.sh
```

**Manual Docker:**
```bash
docker compose up -d --build
```

### 3. Access

| Service | URL |
|---|---|
| **Web Dashboard** | `http://localhost:5173` |
| **Admin Panel** | `http://localhost:5173/admin/login` |
| **REST API** | `http://localhost:8080/api/v1/` |
| **APK Download** | `http://<your-ip>:5173` (scan QR) |

Default admin credentials: `admin` / `admin123`

---

## 📂 Project Structure

```
indoor-navigation/
├── frontend/                   # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── components/         # Reusable UI components (SVGViewer, RouteOverlay, etc.)
│   │   ├── context/            # React Context providers (Auth, Localization, Route)
│   │   ├── localization/       # Client-side navigation engine
│   │   │   ├── pdr/            # Step detection (EMA filter) + step length estimation
│   │   │   ├── graph/          # Graph snapping, projection, off-route detection
│   │   │   ├── navigation/     # Multi-floor manager, voice guidance, camera control
│   │   │   └── sensors/        # Device motion sensor abstraction layer
│   │   ├── pages/              # Route pages (Home, MapPage, GraphEditor, etc.)
│   │   └── services/           # API service layer
│   ├── android/                # Capacitor Android project (APK generation)
│   ├── Dockerfile              # Multi-stage Nginx production build
│   └── package.json
│
├── backend/                    # Spring Boot 3.x + Java 21
│   ├── src/main/java/com/indoor/nav/
│   │   ├── controller/         # REST endpoints (Navigation, Admin, Auth)
│   │   ├── services/           # Business logic + A* routing engine
│   │   ├── models/             # JPA entities (Building, Floor, Node, Edge)
│   │   └── security/           # JWT filter chain
│   ├── uploads/                # Runtime file storage (SVG maps, APK, QR codes)
│   │   └── svgs/               # Uploaded SVG floor plan files
│   ├── Dockerfile              # Multi-stage Maven + Alpine JRE build
│   └── pom.xml
│
├── database/
│   ├── schema.sql              # PostgreSQL DDL (tables, constraints, indexes)
│   └── backups/                # Seed data and graph snapshots
│
├── deployment/
│   └── app_link.png            # Deployment QR code
│
├── docs/                       # 15 comprehensive technical documents
│
├── docker-compose.yml          # 4-container orchestration
├── .env.example                # Environment variable template
│
├── start.bat / start.ps1       # Windows smart startup (auto IP, DB restore, APK rebuild)
├── start.sh                    # Linux/macOS equivalent
├── build_apk.ps1 / build_apk.sh  # Standalone APK rebuild scripts
└── README.md
```

---

## 🔧 Core Technologies

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, TypeScript, Vite | Single Page Application |
| Styling | Tailwind CSS, Framer Motion | Responsive UI with animations |
| Mobile | Capacitor 5 (Android) | Native sensor access + APK packaging |
| Localization | Custom PDR Engine | Step detection, heading estimation, graph snapping |
| Backend | Spring Boot 3, Java 21 | REST API, JWT auth, in-memory graph routing |
| Routing | Custom A\* Implementation | Multi-floor pathfinding with floor penalties |
| Database | PostgreSQL 15 | Normalized relational schema (3NF) |
| Proxy | Nginx | Reverse proxy, static asset serving |
| DevOps | Docker Compose | 4-container orchestrated deployment |
| Voice | Web Speech API | Turn-by-turn audio guidance |

---

## 📖 Documentation

The [`docs/`](docs/) directory contains 15 detailed technical documents:

| # | Document | Scope |
|---|---|---|
| 01 | [Frontend Architecture](docs/01_FRONTEND_ARCHITECTURE.md) | React contexts, Vite config, Capacitor setup |
| 02 | [Backend Architecture](docs/02_BACKEND_ARCHITECTURE.md) | Spring Boot structure, JWT security, service layer |
| 03 | [Database Schema](docs/03_DATABASE_SCHEMA.md) | PostgreSQL 3NF normalized tables |
| 04 | [Routing Engine](docs/04_ROUTING_ENGINE.md) | A\* algorithm, floor penalties, graph cache |
| 05 | [Localization Pipeline](docs/05_LOCALIZATION_PIPELINE.md) | PDR + FLP sensor fusion + graph snapping |
| 06 | [Navigation System](docs/06_NAVIGATION_SYSTEM.md) | Multi-floor segments, voice guidance, checkpoints |
| 07 | [Graph Editor Manual](docs/07_GRAPH_EDITOR_MANUAL.md) | Admin visual editing, calibration, validation |
| 08 | [API Reference](docs/08_API_REFERENCE.md) | Complete REST endpoint documentation |
| 09 | [Deployment Guide](docs/09_DEPLOYMENT_GUIDE.md) | Docker Compose and Nginx configuration |
| 10 | [Map Calibration](docs/10_MAP_COORDINATE_AND_CALIBRATION.md) | Coordinate systems, PPM, affine transforms |
| 11 | [Upgrade Changelog](docs/11_SYSTEM_UPGRADE_CHANGELOG.md) | Architectural evolution log |
| 12 | [Map UX Details](docs/12_MAP_UX_DETAILS.md) | Blue dot tracking, floor selector, route panels |
| 13 | [AI Reconstruction](docs/13_AI_RECONSTRUCTION_MANUAL.md) | Technical constraints for LLM agents |
| 14 | [Document Roster](docs/14_DOCUMENT_ROSTER.md) | Documentation index |
| 15 | [Security Audit](docs/15_SECURITY_AUDIT.md) | Protected vs public endpoint analysis |

---

## 🛡️ Security Notes

- **JWT Authentication**: Stateless Bearer token validation on all admin endpoints.
- **Admin-Fenced Mutations**: Graph editing, cache reloads, and deployment operations require `ROLE_ADMIN`.
- **Silent Token Refresh**: Frontend auto-refreshes JWT every 45 minutes to prevent session loss during long editing sessions.
- **Public Read-Only API**: Navigation and map data endpoints are intentionally public for zero-friction mobile access.

> ⚠️ **Before deploying to production**: Change the default admin password, rotate the JWT secret in `.env`, and set a strong `POSTGRES_PASSWORD`.

---

## 👥 Team

**G.H. Raisoni College of Engineering, Nagpur** — Department of Computer Science & Engineering

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the [LICENSE](LICENSE) file for details.
Developed as part of an academic program at GHRCE, Nagpur.
