package com.indoor.nav.repositories;

import com.indoor.nav.models.Edge;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EdgeRepository extends JpaRepository<Edge, Long> {
    Optional<Edge> findBySourceIdAndDestinationId(Long sourceId, Long destinationId);
    
    @org.springframework.data.jpa.repository.Query("SELECT e FROM Edge e WHERE e.source.id = :nodeId OR e.destination.id = :nodeId")
    java.util.List<Edge> findBySourceIdOrDestinationId(@org.springframework.data.repository.query.Param("nodeId") Long nodeId);
    
    @org.springframework.data.jpa.repository.Query("SELECT e FROM Edge e WHERE e.source.floor.id = :floorId OR e.destination.floor.id = :floorId")
    java.util.List<Edge> findEdgesByFloorId(@org.springframework.data.repository.query.Param("floorId") Long floorId);
}
