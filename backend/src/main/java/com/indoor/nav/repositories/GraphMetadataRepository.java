package com.indoor.nav.repositories;

import com.indoor.nav.models.GraphMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GraphMetadataRepository extends JpaRepository<GraphMetadata, Long> {
    Optional<GraphMetadata> findByFloorId(Long floorId);
}
