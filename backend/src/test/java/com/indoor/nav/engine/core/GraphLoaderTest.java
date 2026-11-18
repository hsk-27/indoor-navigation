package com.indoor.nav.engine.core;

import com.indoor.nav.engine.model.RoutingGraph;
import com.indoor.nav.models.Edge;
import com.indoor.nav.models.Floor;
import com.indoor.nav.models.Node;
import com.indoor.nav.models.NodeType;
import com.indoor.nav.repositories.EdgeRepository;
import com.indoor.nav.repositories.NodeRepository;
import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.repositories.GraphMetadataRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class GraphLoaderTest {

    private NodeRepository nodeRepository;
    private EdgeRepository edgeRepository;
    private FloorRepository floorRepository;
    private GraphMetadataRepository metadataRepository;
    private GraphLoader graphLoader;

    @BeforeEach
    void setUp() {
        nodeRepository = Mockito.mock(NodeRepository.class);
        edgeRepository = Mockito.mock(EdgeRepository.class);
        floorRepository = Mockito.mock(FloorRepository.class);
        metadataRepository = Mockito.mock(GraphMetadataRepository.class);
        com.indoor.nav.repositories.BuildingRepository buildingRepository = Mockito.mock(com.indoor.nav.repositories.BuildingRepository.class);
        graphLoader = new GraphLoader(nodeRepository, edgeRepository, floorRepository, metadataRepository, buildingRepository);
    }

    @Test
    void testEmptyGraphLoad() {
        when(nodeRepository.findAll()).thenReturn(Collections.emptyList());
        when(edgeRepository.findAll()).thenReturn(Collections.emptyList());

        RoutingGraph graph = graphLoader.loadAndValidate();
        assertEquals(0, graph.getNodeCount(), "Empty graph should have 0 nodes");
    }

    @Test
    void testValidGraphLoad() {
        Floor floor = new Floor();
        floor.setId(1L);
        floor.setLevel(1);

        Node n1 = createNode(1L, NodeType.ROOM, floor);
        Node n2 = createNode(2L, NodeType.CORRIDOR, floor);

        Edge e = new Edge();
        e.setSource(n1);
        e.setDestination(n2);
        e.setDistance(10.0);

        when(nodeRepository.findAll()).thenReturn(Arrays.asList(n1, n2));
        when(edgeRepository.findAll()).thenReturn(Collections.singletonList(e));

        RoutingGraph graph = graphLoader.loadAndValidate();
        assertEquals(2, graph.getNodeCount());
        assertEquals(1, graph.getNode(1L).getEdges().size());
        assertEquals(2L, graph.getNode(1L).getEdges().get(0).getTargetNodeId());
        assertEquals(10.0, graph.getNode(1L).getEdges().get(0).getDistance());
    }

    @Test
    void testSelfLoopDetection() {
        Floor floor = new Floor(); floor.setId(1L); floor.setLevel(1);
        Node n1 = createNode(1L, NodeType.ROOM, floor);

        Edge selfLoop = new Edge();
        selfLoop.setSource(n1);
        selfLoop.setDestination(n1); // Self loop
        selfLoop.setDistance(0.0);

        when(nodeRepository.findAll()).thenReturn(Collections.singletonList(n1));
        when(edgeRepository.findAll()).thenReturn(Collections.singletonList(selfLoop));

        RoutingGraph graph = graphLoader.loadAndValidate();
        assertEquals(1, graph.getNodeCount());
        assertTrue(graph.getNode(1L).getEdges().isEmpty(), "Self-loops should be discarded");
    }

    @Test
    void testDisconnectedEdgeDetection() {
        Floor floor = new Floor(); floor.setId(1L); floor.setLevel(1);
        Node n1 = createNode(1L, NodeType.ROOM, floor);
        Node missingNode = createNode(999L, NodeType.ROOM, floor); // Not in node list

        Edge badEdge = new Edge();
        badEdge.setSource(n1);
        badEdge.setDestination(missingNode);
        badEdge.setDistance(5.0);

        when(nodeRepository.findAll()).thenReturn(Collections.singletonList(n1));
        when(edgeRepository.findAll()).thenReturn(Collections.singletonList(badEdge));

        RoutingGraph graph = graphLoader.loadAndValidate();
        assertTrue(graph.getNode(1L).getEdges().isEmpty(), "Edges pointing to missing nodes should be discarded");
    }

    private Node createNode(Long id, NodeType type, Floor floor) {
        Node n = new Node();
        n.setId(id);
        n.setType(type);
        n.setFloor(floor);
        n.setX(0.0);
        n.setY(0.0);
        return n;
    }
}
