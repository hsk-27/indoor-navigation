package com.indoor.nav.services.impl;

import com.indoor.nav.dtos.BuildingDTO;
import com.indoor.nav.models.Building;
import com.indoor.nav.models.Floor;
import com.indoor.nav.repositories.BuildingRepository;
import com.indoor.nav.repositories.FloorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class BuildingService {
    private final BuildingRepository buildingRepository;
    private final FloorRepository floorRepository;
    private final FloorManagementService floorManagementService;

    public BuildingService(BuildingRepository buildingRepository, FloorRepository floorRepository, FloorManagementService floorManagementService) {
        this.buildingRepository = buildingRepository;
        this.floorRepository = floorRepository;
        this.floorManagementService = floorManagementService;
    }

    @Transactional(readOnly = true)
    public List<BuildingDTO> getAllBuildings() {
        return buildingRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public BuildingDTO getBuilding(Long id) {
        return buildingRepository.findById(id).map(this::mapToDTO)
                .orElseThrow(() -> new com.indoor.nav.exceptions.ResourceNotFoundException("Building not found"));
    }

    @Transactional
    public BuildingDTO createBuilding(BuildingDTO dto) {
        if (dto.getName() == null || dto.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Building name cannot be empty");
        }
        if (buildingRepository.findByName(dto.getName()).isPresent()) {
            throw new IllegalArgumentException("Building with this name already exists");
        }
        Building b = new Building();
        b.setName(dto.getName());
        b.setDescription(dto.getDescription());
        b.setIsEnabled(dto.getIsEnabled() != null ? dto.getIsEnabled() : true);
        b.setLatitude(dto.getLatitude());
        b.setLongitude(dto.getLongitude());
        b.setGeofenceRadius(dto.getGeofenceRadius());
        b = buildingRepository.save(b);
        return mapToDTO(b);
    }

    @Transactional
    public BuildingDTO updateBuilding(Long id, BuildingDTO dto) {
        Building b = buildingRepository.findById(id)
                .orElseThrow(() -> new com.indoor.nav.exceptions.ResourceNotFoundException("Building not found"));
        
        if (dto.getName() != null && !dto.getName().trim().isEmpty() && !dto.getName().equals(b.getName())) {
            if (buildingRepository.findByName(dto.getName()).isPresent()) {
                throw new IllegalArgumentException("Building with this name already exists");
            }
            b.setName(dto.getName());
        }
        if (dto.getDescription() != null) b.setDescription(dto.getDescription());
        if (dto.getIsEnabled() != null) b.setIsEnabled(dto.getIsEnabled());
        
        if (dto.getLatitude() != null) b.setLatitude(dto.getLatitude());
        if (dto.getLongitude() != null) b.setLongitude(dto.getLongitude());
        if (dto.getGeofenceRadius() != null) b.setGeofenceRadius(dto.getGeofenceRadius());
        b = buildingRepository.save(b);
        return mapToDTO(b);
    }

    @Transactional
    public void deleteBuilding(Long id) {
        Building building = buildingRepository.findById(id)
                .orElseThrow(() -> new com.indoor.nav.exceptions.ResourceNotFoundException("Building not found"));
        // Cascade delete through floors → edges, nodes, metadata
        List<Floor> floors = floorRepository.findByBuildingIdOrderBySortOrderAsc(building.getId());
        for (Floor floor : floors) {
            floorManagementService.deleteFloor(floor.getId());
        }
        buildingRepository.delete(building);
    }

    private BuildingDTO mapToDTO(Building b) {
        BuildingDTO dto = new BuildingDTO();
        dto.setId(b.getId());
        dto.setName(b.getName());
        dto.setDescription(b.getDescription());
        dto.setIsEnabled(b.getIsEnabled());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setModifiedAt(b.getModifiedAt());
        dto.setLatitude(b.getLatitude());
        dto.setLongitude(b.getLongitude());
        dto.setGeofenceRadius(b.getGeofenceRadius());
        return dto;
    }
}
