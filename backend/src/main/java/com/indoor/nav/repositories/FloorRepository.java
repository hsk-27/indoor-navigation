package com.indoor.nav.repositories;

import com.indoor.nav.models.Floor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FloorRepository extends JpaRepository<Floor, Long> {
    Optional<Floor> findByName(String name);
    Optional<Floor> findByBuildingIdAndLevel(Long buildingId, Integer level);
    List<Floor> findByBuildingIdOrderBySortOrderAsc(Long buildingId);
}
