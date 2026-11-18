import { API_BASE_URL } from '../config';
import { NodeInfo, RouteResponse } from '../context/RouteContext';
import { MockNodes, MockRouteResponse } from './MockData';

// Abstracted service layer for all backend communications
export class ApiService {
  private static USE_MOCKS = false; // Toggle to false when backend is ready

  /**
   * Validates a QR code and returns the associated node.
   */
  static async validateQR(qrId: string): Promise<NodeInfo> {
    if (this.USE_MOCKS) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const node = MockNodes.find(n => String(n.id) === qrId || n.name.replace(/\s+/g, '') === qrId);
          if (node) resolve(node);
          else reject(new Error('Unknown QR Code'));
        }, 600);
      });
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/v1/graph/nodes/qr/${encodeURIComponent(qrId)}`);
    } catch (e) {
      throw new Error('Network unavailable or server unreachable');
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error('Unknown QR Code');
      if (response.status === 401 || response.status === 403) throw new Error('Unauthorized access');
      throw new Error(`Server error (${response.status})`);
    }
    return response.json();
  }

  /**
   * Searches for destination nodes based on a query.
   */
  static async searchDestinations(query: string): Promise<NodeInfo[]> {
    if (this.USE_MOCKS) {
      return new Promise(resolve => {
        setTimeout(() => {
          const q = query.toLowerCase();
          resolve(MockNodes.filter(n => n.name.toLowerCase().includes(q) && n.type !== 'Staircase'));
        }, 300);
      });
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/v1/search?query=${encodeURIComponent(query)}`);
    } catch (e) {
      throw new Error('Network unavailable or server unreachable');
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error('No destinations found');
      throw new Error(`Search failed (${response.status})`);
    }
    return response.json();
  }

  /**
   * Computes a route between a source and destination.
   */
  static async computeRoute(sourceId: number, destId: number, accessProfile: string = 'AUTHORIZED_LIFT_USER'): Promise<RouteResponse> {
    if (this.USE_MOCKS) {
      return new Promise(resolve => {
        setTimeout(() => resolve(MockRouteResponse), 800);
      });
    }

    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/v1/navigation/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNodeId: sourceId,
          destinationNodeId: destId,
          accessProfile: accessProfile
        })
      });
    } catch (e) {
      throw new Error('Network unavailable or server unreachable');
    }
    if (!response.ok) {
      if (response.status === 404) throw new Error('No valid route found between these locations');
      if (response.status === 400) throw new Error('Invalid routing request');
      throw new Error(`Failed to compute route (${response.status})`);
    }
    return response.json();
  }
}
