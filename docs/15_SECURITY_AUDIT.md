# 15. Security Audit Report

## 1. Authentication & Session Management
- **Status:** `IMPLEMENTED`
- **Details:** The system utilizes stateless JSON Web Tokens (JWT) for authentication. Session state is not stored on the backend, ensuring horizontal scalability. The frontend safely stores tokens and attaches them to `Authorization: Bearer` headers via Axios interceptors.
- **Administrator Provisioning:** There are no default credentials. Administrator accounts are created securely via a server-local batch script (`admin_manager.bat`) that calls a loopback-restricted `/api/local-admin/**` endpoint. Passwords are mathematically hashed via `BCryptPasswordEncoder` before being stored in PostgreSQL. The frontend never possesses the plaintext password.
- **Refresh Mechanism:** An active token refresh endpoint (`/api/v1/auth/refresh`) is implemented to prevent sudden timeouts during long-running administrator map-editing sessions.

## 2. API Authorization & Access Control
- **Status:** `IMPLEMENTED`
- **Details:** All endpoints mutating the PostgreSQL database (Graph Nodes, Edges, Floors, Buildings) are strictly fenced behind `@PreAuthorize("hasRole('ADMIN')")`. The `JwtAuthFilter` correctly builds the `SecurityContextHolder`.

## 3. Public Endpoints (Intentional Exposure)
- **Status:** `IMPLEMENTED / KNOWN RISK`
- **Details:** Endpoints governing A* routing (`/api/v1/routing/**`), graph structure consumption, and deployment URL QR generation (`/api/v1/qr`) are explicitly set to `permitAll()` in `SecurityConfig.java`. This is an intended architectural design to allow unauthenticated mobile users walking into the building to instantly scan the QR code and receive navigation without creating an account.
- **Risk Mitigation:** While public, the expensive `/api/v1/graph/reload` endpoint—which triggers a full database query and rebuilds the memory cache—is locked behind `ROLE_ADMIN` to prevent unauthenticated Denial of Service (DoS) attacks.

## 4. Cross-Origin Resource Sharing (CORS)
- **Status:** `PARTIAL`
- **Details:** `SecurityConfig.java` permits CORS from `*` (all origins) to facilitate mobile application testing on local networks. For a production deployment over the internet, this should be hardened to only accept the specific Nginx domain.

## 5. Map Uploads & Path Traversal
- **Status:** `UNVERIFIED`
- **Details:** The backend accepts raw SVG file uploads for floor plans. Further investigation is required to verify if the file upload handler protects against directory traversal attacks (e.g., uploading `../../../etc/passwd.svg`) and XML External Entity (XXE) injection vulnerabilities inherent to raw SVG parsing.

## 6. Docker & Infrastructure
- **Status:** `IMPLEMENTED`
- **Details:** The PostgreSQL database is hidden behind the Docker internal network and is not exposed to the host machine's public interface, preventing direct remote database attacks.

---
**Summary:** The application successfully implements standard Auth/JWT patterns for its zero-friction public entry use-case. However, due to the `UNVERIFIED` status of XML External Entity (XXE) injection and path traversal during raw SVG map uploads, the system's security posture cannot be certified as fully secure for production deployment until the upload parser is formally audited.
