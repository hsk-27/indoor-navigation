package com.indoor.nav.dtos;

import java.util.List;

public class RouteResponse {
    private List<NodeResponse> path;
    private double totalDistance;
    private List<String> instructions;

    public RouteResponse(List<NodeResponse> path, double totalDistance, List<String> instructions) {
        this.path = path;
        this.totalDistance = totalDistance;
        this.instructions = instructions;
    }

    public List<NodeResponse> getPath() { return path; }
    public double getTotalDistance() { return totalDistance; }
    public List<String> getInstructions() { return instructions; }
}
