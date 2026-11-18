package com.indoor.nav.repositories;

import com.indoor.nav.models.Node;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface NodeRepository extends JpaRepository<Node, Long> {
    Optional<Node> findByQrId(String qrId);
    
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"floor", "department"})
    List<Node> findByFloorId(Long floorId);
    
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"floor", "department"})
    List<Node> findAll();

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"floor", "department"})
    List<Node> findByNameContainingIgnoreCase(String name);
}
