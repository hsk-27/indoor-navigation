# 08. REST API Reference

The backend exposes a stateless JSON REST API. All endpoints (except public navigation endpoints) require a valid JWT Bearer token possessing `ROLE_ADMIN`.

## 1. Public Endpoints (No Auth Required)

### 1.1. Calculate Route (A*)
**`POST /api/v1/navigation/route`**
Computes the shortest path using the in-memory `RoutingGraph`.

**Request Payload:**
```json
{
  "sourceNodeId": 215,
  "destinationNodeId": 894,
  "accessProfile": "AUTHORIZED_LIFT_USER" 
}
```
*(Note: `accessProfile` is an optional string determining policy constraints. Valid values are `STUDENT` or `AUTHORIZED_LIFT_USER`. Defaults to `AUTHORIZED_LIFT_USER` if omitted.)*

**Response Payload:**
```json
{
  "totalDistance": 145.2,
  "instructions": [
    "Start at your current location.",
    "Follow the highlighted path to your destination."
  ],
  "path": [
    {
      "id": 215,
      "x": 595.5,
      "y": 421.0,
      "type": "CONNECTOR",
      "floorId": 1,
      "qrId": null
    }
  ]
}
```
*(Note: `qrId` is a legacy field for fallback redirection only and is explicitly ignored during active navigation.)*

### 1.2. Download Floor SVG Map
**`GET /api/v1/svg/{floorId}`**
Streams the raw XML of the SVG floor plan for frontend rendering.

---

### `POST /api/v1/admin/edges`
- **Auth**: Bearer Token required (`ROLE_ADMIN`).
- **Body**: Array of new edge data.
- **Action**: Bulk inserts topological edges.

### `POST /api/v1/admin/edges/delete`
- **Auth**: Bearer Token required (`ROLE_ADMIN`).
- **Body**: Array of edge IDs.
- **Action**: Bulk removes edges.

## 4. Auth API (Token Management)

### `POST /api/v1/auth/login`
- **Auth**: None
- **Body**: `{"username": "admin", "password": "..."}`
- **Response**: JWT Bearer token valid for 1 hour.

### `POST /api/v1/auth/refresh`
- **Auth**: Bearer Token required (`ROLE_ADMIN`).
- **Action**: Issues a fresh JWT token, extending the admin session indefinitely. Triggered silently every 45 minutes by the frontend React app.

## 5. QR Code API (Application Deployment)

### `GET /api/v1/qr/generate`
- **Auth**: None (Public)
- **Parameters**: `url` (String, defaults to "https://campusnav.com")
- **Response**: Returns a dynamically generated binary `image/png` stream of a QR code pointing to the provided URL. Used exclusively to generate the single application-entry deployment QR code.

## 2. Protected Endpoints (Requires `Bearer JWT` + `ROLE_ADMIN`)

### 2.1. Batch Graph Update
**`POST /api/v1/admin/graph/batch`**
Atomically saves Editor changes to PostgreSQL and triggers the `GraphUpdatedEvent` for a zero-downtime cache swap.

**Request Payload:**
```json
{
  "newNodes": [
    { "x": 100, "y": 200, "floorId": 1, "type": "DESTINATION", "name": "Lab 1" }
  ],
  "deletedNodeIds": [44, 45],
  "newEdges": [
    { "sourceId": 1, "destinationId": 2, "distance": 45.2, "direction": "BIDIRECTIONAL" }
  ],
  "deletedEdgeIds": [88]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Graph updated successfully and cache reloaded."
}
```



### 2.3. Reload Graph Cache (Manual)
**`POST /api/v1/admin/graph/reload`**
Forces the `GraphLoader` to immediately pull the latest state from the database and atomic-swap the `RoutingGraph`, bypassing the automated listener.

### 2.4. Building Management (Phase 3 Geofencing)
**`GET /api/v1/buildings`**, **`POST /api/v1/buildings`**, **`PUT /api/v1/buildings/{id}`**
Manages Building metadata including Phase 3 GPS Geofence configurations.

**Building Payload Example:**
```json
{
  "id": 1,
  "name": "GHRCE Main Campus",
  "description": "Main building campus indoor navigation",
  "latitude": 21.1066,
  "longitude": 79.0033,
  "geofenceRadius": 200.0,
  "isEnabled": true
}
```
