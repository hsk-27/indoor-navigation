# 02. Backend Architecture

## 1. Core Stack
The backend acts as an ultra-fast routing engine and REST API provider.
- **Language**: Java 21
- **Framework**: Spring Boot 3.x
- **Build Tool**: Maven
- **Security**: Spring Security with Stateless JWTs
- **Persistence**: Spring Data JPA (Hibernate)

## 2. Package Structure & Responsibilities

### 2.1. `com.indoor.nav.controller`
Contains all REST controllers mapping HTTP requests to Service layer logic.
- `AdminController.java`: Endpoints requiring `ROLE_ADMIN` (e.g., triggering cache reloads).
- `NavigationController.java`: Public endpoints serving the A* algorithm (`calculatePath`).
- `QrController.java`: Integrates with ZXing to generate dynamic physical QR codes on demand.

### 2.2. `com.indoor.nav.engine`
The absolute core of the backend performance. Contains pure Java logic decoupled from HTTP or JPA overhead.
- **`RoutingGraph`**: The immutable, in-memory representation of the building's topology.
- **`GraphLoader`**: Responsible for querying the database on boot, pruning orphans/self-loops, and constructing the `RoutingGraph`.

### 2.3. `com.indoor.nav.services`
Handles business logic and transactional boundaries.
- **`GraphCacheService`**: Holds the `AtomicReference<RoutingGraph>`.
- **`NavigationService`**: Houses the A* algorithm logic.

## 3. Security & Authentication (JWT)
The system operates entirely statelessly. No session cookies are maintained.
- **Filter Chain**: The `JwtAuthFilter` intercepts incoming HTTP requests, extracts the Bearer token from the `Authorization` header, and validates the cryptographic signature.
- **Role Control**: Endpoints under `/api/v1/admin/*` are strictly guarded by `@PreAuthorize("hasRole('ADMIN')")`.
- **Stateless Verification**: The `JwtService` parses the token to establish the `SecurityContextHolder` identity per request, allowing the backend to horizontally scale indefinitely without shared session states.

### 3.1. Administrator Provisioning
- **No Default Credentials**: The database starts empty. There are no hardcoded default accounts (e.g., `admin/admin123`) seeded on boot.
- **Local Server Management**: Administrator accounts are created and deleted exclusively via the server-side `admin_manager.bat` script.
- **Interface Enforcement**: The script communicates with the backend via `LocalAdminController` mapped to `/api/local-admin/**`. This controller explicitly validates `HttpServletRequest.getRemoteAddr()` to ensure the caller is `127.0.0.1`, `::1`, or a Site-Local LAN address (e.g., `172.18.x.x` Docker bridge network), allowing Docker container traversal while Nginx completely blocks external proxy access to this endpoint.
- **Credential Storage**: Passwords are mathematically hashed via `BCryptPasswordEncoder` before being persisted to PostgreSQL. The frontend never stores or verifies the plaintext password.

## 4. The Memory-First Paradigm
Traditional web applications query the database on every user request. This is fundamentally incompatible with high-throughput graph traversal algorithms like A*.
- **The Rule**: The Spring Data JPA Repositories (`NodeRepository`, `EdgeRepository`) are **never** invoked during a navigation request.
- **The Execution**: A user's route request hits the `NavigationController`, passes to the `NavigationService`, which retrieves the pre-built `RoutingGraph` from the `GraphCacheService`'s RAM, and computes the path in < 1ms. The database acts merely as cold storage.
