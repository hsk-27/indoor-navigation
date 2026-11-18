package com.indoor.nav.engine.core;

import com.indoor.nav.engine.model.GraphNode;
import com.indoor.nav.engine.model.RoutingGraph;
import com.indoor.nav.models.Edge;
import com.indoor.nav.models.Floor;
import com.indoor.nav.models.Node;
import com.indoor.nav.models.NodeType;
import com.indoor.nav.repositories.EdgeRepository;
import com.indoor.nav.repositories.NodeRepository;
import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.repositories.GraphMetadataRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.ArrayList;
import java.util.List;

import static org.mockito.Mockito.when;

/**
 * Performance benchmark suite for Graph Loader and Cache.
 * Validates memory footprint, load times, and lookup latencies.
 */
public class GraphBenchmarkTest {

    @Test
    public void executeBenchmarks() {
        int[] nodeCounts = {100, 250, 500, 1000, 2500};
        System.out.println("Starting Graph Engine Benchmarks...");
        
        for (int count : nodeCounts) {
            runBenchmarkForSize(count);
        }
    }

    private void runBenchmarkForSize(int nodeCount) {
        NodeRepository nodeRepo = Mockito.mock(NodeRepository.class);
        EdgeRepository edgeRepo = Mockito.mock(EdgeRepository.class);
        
        List<Node> mockNodes = new ArrayList<>(nodeCount);
        List<Edge> mockEdges = new ArrayList<>(nodeCount * 3);
        Floor f1 = new Floor(); f1.setId(1L); f1.setLevel(1);
        
        for (long i = 1; i <= nodeCount; i++) {
            Node n = new Node();
            n.setId(i);
            n.setType(NodeType.ROOM);
            n.setFloor(f1);
            n.setX((double) i);
            n.setY((double) i);
            mockNodes.add(n);
            
            // Add approx 3 edges per node to simulate typical mesh
            if (i > 1) {
                mockEdges.add(createEdge(i, i - 1, 10.0));
            }
            if (i > 2) {
                mockEdges.add(createEdge(i, i - 2, 15.0));
            }
            if (i < nodeCount) {
                mockEdges.add(createEdge(i, i + 1, 10.0));
            }
        }
        
        when(nodeRepo.findAll()).thenReturn(mockNodes);
        when(edgeRepo.findAll()).thenReturn(mockEdges);
        
        FloorRepository floorRepo = Mockito.mock(FloorRepository.class);
        GraphMetadataRepository metaRepo = Mockito.mock(GraphMetadataRepository.class);
        com.indoor.nav.repositories.BuildingRepository bldgRepo = Mockito.mock(com.indoor.nav.repositories.BuildingRepository.class);
        GraphLoader loader = new GraphLoader(nodeRepo, edgeRepo, floorRepo, metaRepo, bldgRepo);
        
        // 1. Measure Load Time
        long startLoad = System.nanoTime();
        RoutingGraph graph = loader.loadAndValidate();
        long loadTimeMs = (System.nanoTime() - startLoad) / 1_000_000;
        
        // 2. Measure Reload Time
        long startReload = System.nanoTime();
        loader.loadAndValidate(); // Simulate cache reload
        long reloadTimeMs = (System.nanoTime() - startReload) / 1_000_000;
        
        // 3. Measure Lookup Latency
        long lookupStart = System.nanoTime();
        for (long i = 1; i <= nodeCount; i++) {
            GraphNode gn = graph.getNode(i);
        }
        long lookupTotalNs = System.nanoTime() - lookupStart;
        long avgLookupNs = lookupTotalNs / nodeCount;
        
        // 4. Estimate Memory (Object sizes approximation)
        // Node ~ 64 bytes, Edge ~ 32 bytes, HashMap entry ~ 32 bytes
        long memoryBytes = (nodeCount * 96L) + (mockEdges.size() * 32L);
        long memoryKb = memoryBytes / 1024;
        
        System.out.printf("Nodes: %d | Edges: %d | Load: %d ms | Reload: %d ms | Lookup: %d ns | Memory: ~%d KB%n",
                nodeCount, mockEdges.size(), loadTimeMs, reloadTimeMs, avgLookupNs, memoryKb);
    }
    
    private Edge createEdge(Long src, Long dest, Double dist) {
        Edge e = new Edge();
        Node s = new Node(); s.setId(src);
        Node d = new Node(); d.setId(dest);
        e.setSource(s);
        e.setDestination(d);
        e.setDistance(dist);
        return e;
    }
}
