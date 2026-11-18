package com.indoor.nav.services.impl;

import com.indoor.nav.engine.core.GraphLoader;
import com.indoor.nav.engine.model.RoutingGraph;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class GraphCacheServiceImplTest {

    private GraphLoader graphLoader;
    private GraphCacheServiceImpl graphCacheService;

    @BeforeEach
    void setUp() {
        graphLoader = Mockito.mock(GraphLoader.class);
        graphCacheService = new GraphCacheServiceImpl(graphLoader);
    }

    @Test
    void testUninitializedCacheThrowsException() {
        assertThrows(IllegalStateException.class, () -> {
            graphCacheService.getGraph();
        });
    }

    @Test
    void testCacheInitializationAndReload() {
        RoutingGraph mockGraph = new RoutingGraph(Collections.emptyMap(), Collections.emptyMap());
        when(graphLoader.loadAndValidate()).thenReturn(mockGraph);

        // Initial load
        graphCacheService.loadGraph();
        RoutingGraph retrieved = graphCacheService.getGraph();
        assertNotNull(retrieved);
        assertEquals(0, retrieved.getNodeCount());

        // Reload simulation
        RoutingGraph newMockGraph = new RoutingGraph(Collections.emptyMap(), Collections.emptyMap());
        when(graphLoader.loadAndValidate()).thenReturn(newMockGraph);
        
        graphCacheService.reloadGraph();
        assertNotSame(mockGraph, graphCacheService.getGraph());
        assertSame(newMockGraph, graphCacheService.getGraph());
    }
}
