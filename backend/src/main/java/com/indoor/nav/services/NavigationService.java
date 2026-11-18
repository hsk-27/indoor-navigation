package com.indoor.nav.services;

import com.indoor.nav.dtos.RouteResponse;

public interface NavigationService {
    /**
     * Computes the shortest path using the A* algorithm against the In-Memory Graph Cache.
     * @param accessProfile e.g., "STUDENT" or "AUTHORIZED_LIFT_USER"
     */
    RouteResponse calculatePath(Long sourceNodeId, Long destinationNodeId, String accessProfile);
}
