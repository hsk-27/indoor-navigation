package com.indoor.nav.services.impl;

import com.indoor.nav.engine.core.GraphLoader;
import com.indoor.nav.engine.model.RoutingGraph;
import com.indoor.nav.services.GraphCacheService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicReference;

import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.event.TransactionPhase;
import com.indoor.nav.engine.core.GraphUpdatedEvent;

@Service
public class GraphCacheServiceImpl implements GraphCacheService {
    private static final Logger log = LoggerFactory.getLogger(GraphCacheServiceImpl.class);

    private final GraphLoader graphLoader;
    
    // AtomicReference ensures thread-safe, lock-free reads during concurrent routing requests.
    // The reference can be atomically swapped during an admin reload without blocking active readers.
    private final AtomicReference<RoutingGraph> activeGraph;

    public GraphCacheServiceImpl(GraphLoader graphLoader) {
        this.graphLoader = graphLoader;
        this.activeGraph = new AtomicReference<>();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Override
    public void loadGraph() {
        log.info("Application Ready: Initializing Graph Cache...");
        reloadGraph();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void handleGraphUpdated(GraphUpdatedEvent event) {
        log.info("Graph state changed. Reloading GraphCache...");
        reloadGraph();
    }

    @Override
    public synchronized void reloadGraph() {
        long start = System.currentTimeMillis();
        RoutingGraph newGraph = graphLoader.loadAndValidate();
        activeGraph.set(newGraph);
        log.info("GraphCache loaded and swapped in {} ms", (System.currentTimeMillis() - start));
    }

    /**
     * Retrieves the current immutable graph snapshot for routing.
     */
    public RoutingGraph getGraph() {
        RoutingGraph graph = activeGraph.get();
        if (graph == null) {
            throw new IllegalStateException("Graph Cache is not yet initialized");
        }
        return graph;
    }
}
