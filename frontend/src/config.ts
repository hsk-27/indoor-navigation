/// <reference types="vite/client" />
/**
 * Deployment Configuration — Zero-Rebuild Dynamic Server Resolution
 * 
 * Browser/WebView: Automatically derives the backend URL from the host that
 * served the page (same-origin), so switching WiFi/laptop never requires a
 * code change or rebuild.
 * 
 * Native APK: Uses localStorage (set via QR deep link, clipboard, or manual
 * CapacitorServerConfig entry) as the authoritative source. Falls back to
 * same-origin detection if the WebView was loaded from a LAN server.
 */
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
    return Capacitor.isNativePlatform();
};

/**
 * Derives the backend API URL from the current page's origin.
 * If the page was served from http://192.168.1.5:5173 (Nginx frontend),
 * the backend is at http://192.168.1.5:8080.
 * If served from localhost, returns http://localhost:8080.
 */
const deriveBackendFromOrigin = (): string | null => {
    try {
        const { protocol, hostname, port, origin } = window.location;
        // Only derive if we're on a real network host (not file:// or capacitor://)
        if (protocol === 'http:' || protocol === 'https:') {
            // Standard HTTP (80) or HTTPS (443), or domain name without port:
            // Route through Nginx reverse-proxy on same-origin (e.g. https://nav.ghrce.edu.in).
            // Nginx proxies /api/ internally to backend:8080, avoiding firewall blocks and mixed-content SSL errors.
            if (!port || port === '80' || port === '443') {
                return origin;
            }
            // Port 5173 is standard Vite dev or local Docker container mapping on LAN IP.
            // Direct browser to backend on port 8080 for LAN development.
            if (port === '5173') {
                return `${protocol}//${hostname}:8080`;
            }
            // Default to same origin for any custom reverse-proxy port
            return origin;
        }
    } catch (_) { /* ignore */ }
    return null;
};

const getBaseUrl = () => {
    // 1. Native APK
    if (isNativePlatform()) {
        // Build-time URL always wins — build_apk.ps1 bakes the current LAN IP,
        // so a fresh APK always points to the right server regardless of stale localStorage.
        if (import.meta.env.VITE_BACKEND_URL) {
            return import.meta.env.VITE_BACKEND_URL;
        }

        // Fallback: user-configured URL via CapacitorServerConfig (only used
        // when no URL was baked at build time).
        let stored = localStorage.getItem('APP_DEPLOYMENT_URL');
        if (stored) {
            if (!stored.startsWith('http://') && !stored.startsWith('https://')) {
                stored = 'http://' + stored;
            }
            return stored;
        }

        // No URL at all → show the CapacitorServerConfig screen
        return ''; 
    }

    // 2. Vite env override (for custom dev setups)
    if (import.meta.env.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL;
    }

    // 3. Auto-detect: derive from the host that served this page
    const derived = deriveBackendFromOrigin();
    if (derived) return derived;

    // 4. Last resort fallback (should rarely be reached)
    return 'http://localhost:8080';
};

export const API_BASE_URL = getBaseUrl();

