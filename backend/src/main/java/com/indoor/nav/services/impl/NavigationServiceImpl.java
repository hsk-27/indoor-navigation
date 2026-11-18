package com.indoor.nav.services.impl;

import com.indoor.nav.dtos.NodeResponse;
import com.indoor.nav.dtos.RouteResponse;
import com.indoor.nav.engine.model.GraphEdge;
import com.indoor.nav.engine.model.GraphNode;
import com.indoor.nav.engine.model.RoutingGraph;
import com.indoor.nav.exceptions.InvalidRouteException;
import com.indoor.nav.services.GraphCacheService;
import com.indoor.nav.services.NavigationService;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class NavigationServiceImpl implements NavigationService {

    private final GraphCacheService graphCacheService;

    public NavigationServiceImpl(GraphCacheService graphCacheService) {
        this.graphCacheService = graphCacheService;
    }

    /**
     * Calculates the shortest path between two nodes using the A* (A-Star) search algorithm.
     * 
     * Purpose:
     * Finds the optimal (shortest) path through the building graph from the source node to the destination node.
     * 
     * Inputs:
     * @param sourceNodeId The unique ID of the starting node (where the user scanned the QR).
     * @param destinationNodeId The unique ID of the target node (where the user wants to go).
     * 
     * Outputs:
     * @return RouteResponse containing the ordered list of nodes to traverse, total distance, and basic instructions.
     * 
     * Time Complexity:
     * O(E + V log V) where E is the number of edges and V is the number of nodes. 
     * The PriorityQueue operations take O(log V) time, and in the worst case we process every edge.
     */
    @Override
    public RouteResponse calculatePath(Long sourceNodeId, Long destinationNodeId, String accessProfile) {
        // 1. Fetch the immutable graph snapshot from memory (O(1))
        RoutingGraph graph = graphCacheService.getGraph();
        
        GraphNode startNode = graph.getNode(sourceNodeId);
        GraphNode targetNode = graph.getNode(destinationNodeId);
        
        if (startNode == null || targetNode == null) {
            throw new InvalidRouteException("Source or Destination node does not exist in the active graph.");
        }

        // Gather all valid target nodes (same floor and same name)
        Set<Long> validTargetIds = new HashSet<>();
        validTargetIds.add(destinationNodeId);
        String targetName = targetNode.getName();
        if (targetName != null && !targetName.trim().isEmpty()) {
            String normalizedTargetName = targetName.toLowerCase().replaceAll("[^a-z0-9]", "");
            for (GraphNode node : graph.getAllNodes().values()) {
                if (node.getFloorLevel().equals(targetNode.getFloorLevel()) && node.getName() != null) {
                    String normalizedNodeName = node.getName().toLowerCase().replaceAll("[^a-z0-9]", "");
                    if (normalizedTargetName.equals(normalizedNodeName)) {
                        validTargetIds.add(node.getId());
                    }
                }
            }
        }

        // 2. Initialize Data Structures for A*
        Map<Long, Double> gScores = new HashMap<>();
        Map<Long, Double> realDistances = new HashMap<>();
        Map<Long, Long> cameFrom = new HashMap<>();
        PriorityQueue<AStarNode> openSet = new PriorityQueue<>(Comparator.comparingDouble(AStarNode::getFScore));

        // 3. Setup the Starting Node
        gScores.put(startNode.getId(), 0.0);
        realDistances.put(startNode.getId(), 0.0);
        double initialHeuristic = calculateMultiHeuristic(startNode, validTargetIds, graph);
        openSet.add(new AStarNode(startNode.getId(), initialHeuristic));

        Set<Long> closedSet = new HashSet<>();

        // 4. Execute the A* Traversal Loop
        while (!openSet.isEmpty()) {
            Long currentId = openSet.poll().getNodeId();
            if (closedSet.contains(currentId)) continue;
            closedSet.add(currentId);
            
            // Goal check
            if (validTargetIds.contains(currentId)) {
                return reconstructPath(cameFrom, currentId, graph, realDistances, currentId);
            }
            
            GraphNode currentNode = graph.getNode(currentId);
            double currentGScore = gScores.getOrDefault(currentId, Double.MAX_VALUE);
            
            // 4. Explore Neighbors
            for (GraphEdge edge : currentNode.getEdges()) {
                
                Long neighborId = edge.getTargetNodeId();
                GraphNode neighborNode = graph.getNode(neighborId);
                
                if (neighborNode == null) continue;
                
                // Profile Constraint: Prevent students from using LIFT edges/nodes
                if ("STUDENT".equalsIgnoreCase(accessProfile)) {
                    if ("LIFT".equalsIgnoreCase(neighborNode.getType())) {
                        continue; // Students are not allowed to traverse through lifts
                    }
                }
                
                double originalEdgeDistance = edge.getDistance();
                double edgeDistance = originalEdgeDistance;
                
                // Cross-floor routing optimization: 3-tier horizontal penalty system.
                // Guides A* to find the nearest staircase, chain through connector links floor-by-floor,
                // and only walk freely on the start and destination floors.
                boolean isHorizontal = currentNode.getFloorLevel().equals(neighborNode.getFloorLevel());
                boolean isStartFloor = currentNode.getFloorLevel().equals(startNode.getFloorLevel());
                boolean isDestinationFloor = currentNode.getFloorLevel().equals(targetNode.getFloorLevel());
                
                if (isHorizontal && !isStartFloor && !isDestinationFloor) {
                    // Intermediate floor: allow tiny staircase-to-staircase connector links (2x),
                    // but massively penalize all other horizontal movement (50x).
                    boolean isBothConnector = 
                        ("STAIRCASE".equalsIgnoreCase(currentNode.getType()) || "LIFT".equalsIgnoreCase(currentNode.getType()))
                        && ("STAIRCASE".equalsIgnoreCase(neighborNode.getType()) || "LIFT".equalsIgnoreCase(neighborNode.getType()));
                    edgeDistance *= isBothConnector ? 2.0 : 50.0;
                }
                
                double tentativeGScore = currentGScore + edgeDistance;
                
                if (tentativeGScore < gScores.getOrDefault(neighborId, Double.MAX_VALUE)) {
                    cameFrom.put(neighborId, currentId);
                    gScores.put(neighborId, tentativeGScore);
                    double realTentativeG = realDistances.getOrDefault(currentId, 0.0) + originalEdgeDistance;
                    realDistances.put(neighborId, realTentativeG);
                    
                    double fScore = tentativeGScore + calculateMultiHeuristic(neighborNode, validTargetIds, graph);
                    openSet.add(new AStarNode(neighborId, fScore));
                }
            }
        }

        throw new InvalidRouteException("No path exists between the selected nodes.");
    }

    private double calculateMultiHeuristic(GraphNode current, Set<Long> validTargetIds, RoutingGraph graph) {
        double minH = Double.MAX_VALUE;
        for (Long tId : validTargetIds) {
            GraphNode t = graph.getNode(tId);
            if (t == null) continue;
            double h = calculateHeuristic(current, t, graph);
            if (h < minH) minH = h;
        }
        return minH;
    }

    /**
     * Admissible 3D Euclidean heuristic. Returns an estimate in physical metres
     * (same unit as gScore, since edge distances are stored as pixelDist/ppm).
     *
     * Same-floor: straight-line SVG pixel distance divided by PPM.
     * Cross-floor: vertical cost in metres only (horizontal pixel distance across
     * different SVG plans is meaningless and would break admissibility).
     */
    private double calculateHeuristic(GraphNode a, GraphNode b, RoutingGraph graph) {
        int floorDiff = Math.abs(a.getFloorLevel() - b.getFloorLevel());
        
        double ppm = graph.getPpm(a.getFloorLevel());
        if (ppm <= 0) ppm = 1.0;

        if (floorDiff == 0) {
            // Same floor: straight-line pixel distance converted to metres
            return Math.hypot(a.getX() - b.getX(), a.getY() - b.getY()) / ppm;
        }

        // Cross-floor: strictly vertical cost in metres
        return floorDiff * 3.5;
    }

    private RouteResponse reconstructPath(Map<Long, Long> cameFrom, Long current, RoutingGraph graph, Map<Long, Double> realDistances, Long destinationId) {
        List<NodeResponse> path = new ArrayList<>();
        path.add(mapToNodeResponse(graph.getNode(current)));
        
        while (cameFrom.containsKey(current)) {
            current = cameFrom.get(current);
            path.add(mapToNodeResponse(graph.getNode(current)));
        }
        
        Collections.reverse(path);
        
        // The gScore perfectly tracks the mathematical addition of all edge distances across the route.
        // Edge distances are already stored in the database in physical metres.
        double totalDistanceMetres = realDistances.get(destinationId);

        List<String> instructions = generateTurnByTurnInstructions(path, graph);
        
        return new RouteResponse(path, totalDistanceMetres, instructions);
    }

    private NodeResponse mapToNodeResponse(GraphNode node) {
        NodeResponse response = new NodeResponse();
        response.setId(node.getId());
        response.setX(node.getX());
        response.setY(node.getY());
        response.setType(node.getType());
        response.setFloorId(node.getFloorId() != null ? node.getFloorId() : 0L);
        response.setQrId(node.getQrId());
        response.setName(node.getName());
        return response;
    }

    private List<String> generateTurnByTurnInstructions(List<NodeResponse> path, RoutingGraph graph) {
        List<String> instructions = new ArrayList<>();
        if (path == null || path.size() < 2) {
            instructions.add("You are already at your destination.");
            return instructions;
        }

        instructions.add("Start at " + (path.get(0).getName() != null ? path.get(0).getName() : "your current location") + ".");
        
        double accumulatedDistance = 0.0;
        
        for (int i = 0; i < path.size() - 1; i++) {
            NodeResponse curr = path.get(i);
            NodeResponse next = path.get(i + 1);
            
            // Check for floor transition
            if (!curr.getFloorId().equals(next.getFloorId())) {
                if (accumulatedDistance > 0) {
                    instructions.add(String.format("Head straight for %.1fm.", accumulatedDistance));
                    accumulatedDistance = 0.0;
                }
                
                // Look ahead to merge consecutive floor transitions of the same type
                Long targetFloorId = next.getFloorId();
                int lookahead = i + 1;
                while (lookahead < path.size() - 1 && !path.get(lookahead).getFloorId().equals(path.get(lookahead + 1).getFloorId())) {
                    targetFloorId = path.get(lookahead + 1).getFloorId();
                    lookahead++;
                }
                
                String transitionType = (curr.getType() != null && curr.getType().equals("LIFT")) ? "Elevator" : "Stairs";
                // Use floor level (e.g. 1, 2, 3) instead of database primary key ID
                GraphNode targetGraphNode = graph.getNode(path.get(lookahead).getId());
                String floorLabel = targetGraphNode != null ? String.valueOf(targetGraphNode.getFloorLevel()) : String.valueOf(targetFloorId);
                instructions.add("Take " + transitionType + " to Floor " + floorLabel + ".");
                
                // Advance loop to skip intermediate floor nodes
                i = lookahead - 1;
                continue;
            }
            
            // Distance in pixels
            double pixelDist = Math.hypot(next.getX() - curr.getX(), next.getY() - curr.getY());
            GraphNode graphNode = graph.getNode(curr.getId());
            double ppm = (graphNode != null) ? graph.getPpm(graphNode.getFloorLevel()) : 1.0;
            double physicalDist = pixelDist / ppm;
            
            if (i == 0) {
                accumulatedDistance += physicalDist;
            } else {
                NodeResponse prev = path.get(i - 1);
                
                // If we just got off a floor transition, no turn calculation needed
                if (!prev.getFloorId().equals(curr.getFloorId())) {
                    accumulatedDistance += physicalDist;
                    continue;
                }
                
                double angle1 = Math.atan2(curr.getY() - prev.getY(), curr.getX() - prev.getX());
                double angle2 = Math.atan2(next.getY() - curr.getY(), next.getX() - curr.getX());
                
                double diff = Math.toDegrees(angle2 - angle1);
                while (diff > 180) diff -= 360;
                while (diff < -180) diff += 360;
                
                if (Math.abs(diff) > 20) {
                    if (accumulatedDistance > 0) {
                        instructions.add(String.format("Head straight for %.1fm.", accumulatedDistance));
                    }
                    
                    if (diff > 45) {
                        instructions.add("Turn Right.");
                    } else if (diff > 20) {
                        instructions.add("Slight Right.");
                    } else if (diff < -45) {
                        instructions.add("Turn Left.");
                    } else if (diff < -20) {
                        instructions.add("Slight Left.");
                    }
                    accumulatedDistance = physicalDist;
                } else {
                    accumulatedDistance += physicalDist;
                }
            }
        }
        
        if (accumulatedDistance > 0) {
            instructions.add(String.format("Head straight for %.1fm.", accumulatedDistance));
        }
        instructions.add("You have arrived at your destination.");
        
        return instructions;
    }

    /**
     * Helper class representing a node in the PriorityQueue.
     * Maps a Node ID to its fScore (Total Expected Cost).
     */
    private static class AStarNode {
        private final Long nodeId;
        private final double fScore;

        public AStarNode(Long nodeId, double fScore) {
            this.nodeId = nodeId;
            this.fScore = fScore;
        }

        public Long getNodeId() { return nodeId; }
        public double getFScore() { return fScore; }
    }
}
