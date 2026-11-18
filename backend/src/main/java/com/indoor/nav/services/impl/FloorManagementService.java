package com.indoor.nav.services.impl;

import com.indoor.nav.dtos.FloorDTO;
import com.indoor.nav.engine.core.GraphUpdatedEvent;
import com.indoor.nav.models.Building;
import com.indoor.nav.models.Edge;
import com.indoor.nav.models.Floor;
import com.indoor.nav.models.GraphMetadata;
import com.indoor.nav.models.Node;
import com.indoor.nav.repositories.BuildingRepository;
import com.indoor.nav.repositories.EdgeRepository;
import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.repositories.GraphMetadataRepository;
import com.indoor.nav.repositories.NodeRepository;
import com.indoor.nav.exceptions.ResourceNotFoundException;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FloorManagementService {
    private final FloorRepository floorRepository;
    private final BuildingRepository buildingRepository;
    private final NodeRepository nodeRepository;
    private final EdgeRepository edgeRepository;
    private final GraphMetadataRepository metadataRepository;
    private final FileUploadService fileUploadService;
    private final ApplicationEventPublisher eventPublisher;

    public FloorManagementService(FloorRepository floorRepository, BuildingRepository buildingRepository,
                                  NodeRepository nodeRepository, EdgeRepository edgeRepository,
                                  GraphMetadataRepository metadataRepository, FileUploadService fileUploadService,
                                  ApplicationEventPublisher eventPublisher) {
        this.floorRepository = floorRepository;
        this.buildingRepository = buildingRepository;
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.metadataRepository = metadataRepository;
        this.fileUploadService = fileUploadService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public List<FloorDTO> getFloorsByBuilding(Long buildingId) {
        return floorRepository.findByBuildingIdOrderBySortOrderAsc(buildingId)
                .stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    @Transactional
    public FloorDTO createFloorWithSvg(Long buildingId, String name, Integer level, String description, MultipartFile svgFile) {
        Building b = buildingRepository.findById(buildingId)
                .orElseThrow(() -> new ResourceNotFoundException("Building not found"));
        
        // Save SVG
        String svgUrl = fileUploadService.saveSvgFile(svgFile);
        FileUploadService.SvgDimensions dims = fileUploadService.extractDimensions(svgFile);

        // 1. Create Floor
        Floor floor = new Floor();
        floor.setBuilding(b);
        floor.setName(name);
        floor.setLevel(level != null ? level : 0);
        floor.setDescription(description);
        floor.setSvgMapUrl(svgUrl);
        
        // Find max sort order
        List<Floor> existingFloors = floorRepository.findByBuildingIdOrderBySortOrderAsc(buildingId);
        int maxOrder = existingFloors.isEmpty() ? 0 : existingFloors.stream().mapToInt(Floor::getSortOrder).max().orElse(0);
        floor.setSortOrder(maxOrder + 1);
        
        floor = floorRepository.save(floor);

        // 2. Create GraphMetadata
        GraphMetadata metadata = new GraphMetadata();
        metadata.setFloorId(floor.getId());
        metadata.setBuildingName(b.getName());
        metadata.setSvgWidth(dims.width);
        metadata.setSvgHeight(dims.height);
        metadata.setPixelsPerMeter(1.0); // Default
        metadata.setOriginX(0.0);
        metadata.setOriginY(0.0);
        metadata.setRotation(0.0);
        metadataRepository.save(metadata);

        // 3. Initialize empty graph (Implicitly empty because no nodes/edges created)
        
        // 4. Reload routing cache
        eventPublisher.publishEvent(new GraphUpdatedEvent(this));

        return mapToDTO(floor);
    }

    @Transactional
    public FloorDTO updateFloor(Long floorId, FloorDTO dto) {
        Floor floor = floorRepository.findById(floorId)
                .orElseThrow(() -> new RuntimeException("Floor not found"));
        
        if (dto.getName() != null) floor.setName(dto.getName());
        if (dto.getLevel() != null) floor.setLevel(dto.getLevel());
        if (dto.getDescription() != null) floor.setDescription(dto.getDescription());
        if (dto.getSortOrder() != null) floor.setSortOrder(dto.getSortOrder());
        if (dto.getIsEnabled() != null) {
            floor.setIsEnabled(dto.getIsEnabled());
            eventPublisher.publishEvent(new GraphUpdatedEvent(this)); // Reload cache as floor is enabled/disabled
        }

        return mapToDTO(floorRepository.save(floor));
    }

    @Transactional
    public void deleteFloor(Long floorId) {
        Floor floor = floorRepository.findById(floorId)
                .orElseThrow(() -> new RuntimeException("Floor not found"));
        
        // Delete metadata
        metadataRepository.findByFloorId(floorId).ifPresent(metadataRepository::delete);
        
        // Delete nodes (cascade should delete edges, but let's be explicit if needed)
        List<Node> nodes = nodeRepository.findByFloorId(floorId);
        List<Edge> edges = edgeRepository.findEdgesByFloorId(floorId);
        edgeRepository.deleteAll(edges);
        nodeRepository.deleteAll(nodes);
        
        floorRepository.delete(floor);
        eventPublisher.publishEvent(new GraphUpdatedEvent(this));
    }

    @Transactional
    public FloorDTO duplicateFloor(Long floorId) {
        Floor original = floorRepository.findById(floorId)
                .orElseThrow(() -> new RuntimeException("Floor not found"));
        
        // Duplicate SVG
        String newSvgUrl = null;
        if (original.getSvgMapUrl() != null) {
            try {
                Path originalPath = Paths.get("." + original.getSvgMapUrl());
                String newFilename = UUID.randomUUID().toString() + ".svg";
                Path newPath = Paths.get("uploads/svgs/" + newFilename);
                if (Files.exists(originalPath)) {
                    Files.copy(originalPath, newPath, StandardCopyOption.REPLACE_EXISTING);
                    newSvgUrl = "/uploads/svgs/" + newFilename;
                } else {
                    newSvgUrl = original.getSvgMapUrl(); // fallback
                }
            } catch (IOException e) {
                throw new RuntimeException("Failed to copy SVG", e);
            }
        }

        Floor copy = new Floor();
        copy.setBuilding(original.getBuilding());
        copy.setName(original.getName() + " (Copy)");
        copy.setLevel(original.getLevel());
        copy.setDescription(original.getDescription());
        copy.setSortOrder(original.getSortOrder() + 1);
        copy.setSvgMapUrl(newSvgUrl);
        Floor savedCopy = floorRepository.save(copy);

        // Duplicate Metadata
        GraphMetadata metaCopy = new GraphMetadata();
        metadataRepository.findByFloorId(original.getId()).ifPresent(meta -> {
            metaCopy.setFloorId(savedCopy.getId());
            metaCopy.setBuildingName(meta.getBuildingName());
            metaCopy.setSvgWidth(meta.getSvgWidth());
            metaCopy.setSvgHeight(meta.getSvgHeight());
            metaCopy.setPixelsPerMeter(meta.getPixelsPerMeter());
            metaCopy.setOriginX(meta.getOriginX());
            metaCopy.setOriginY(meta.getOriginY());
            metaCopy.setRotation(meta.getRotation());
            metadataRepository.save(metaCopy);
        });

        // Duplicate Nodes and Edges
        List<Node> oldNodes = nodeRepository.findByFloorId(original.getId());
        Map<Long, Node> nodeMapping = new HashMap<>(); // oldId -> new Node
        for (Node oldNode : oldNodes) {
            Node newNode = new Node();
            newNode.setFloor(savedCopy);
            newNode.setType(oldNode.getType());
            newNode.setName(oldNode.getName());
            newNode.setQrId(null); // QR IDs must be unique — duplicated nodes get fresh ones assigned later
            newNode.setX(oldNode.getX());
            newNode.setY(oldNode.getY());
            newNode.setInternalName(oldNode.getInternalName());
            newNode.setDescription(oldNode.getDescription());
            newNode.setIsEnabled(oldNode.getIsEnabled());
            newNode.setRouteVisibility(oldNode.getRouteVisibility());
            newNode = nodeRepository.save(newNode);
            nodeMapping.put(oldNode.getId(), newNode);
        }

        List<Edge> floorEdges = edgeRepository.findEdgesByFloorId(original.getId());
        for (Edge oldEdge : floorEdges) {
            if (nodeMapping.containsKey(oldEdge.getSource().getId()) && nodeMapping.containsKey(oldEdge.getDestination().getId())) {
                Edge newEdge = new Edge();
                newEdge.setSource(nodeMapping.get(oldEdge.getSource().getId()));
                newEdge.setDestination(nodeMapping.get(oldEdge.getDestination().getId()));
                newEdge.setDistance(oldEdge.getDistance());
                newEdge.setDirection(oldEdge.getDirection());
                newEdge.setIsEnabled(oldEdge.getIsEnabled());
                newEdge.setIsFloorTransition(oldEdge.getIsFloorTransition());
                edgeRepository.save(newEdge);
            }
        }

        eventPublisher.publishEvent(new GraphUpdatedEvent(this));
        return mapToDTO(savedCopy);
    }

    private FloorDTO mapToDTO(Floor f) {
        FloorDTO dto = new FloorDTO();
        dto.setId(f.getId());
        dto.setBuildingId(f.getBuilding() != null ? f.getBuilding().getId() : null);
        dto.setName(f.getName());
        dto.setLevel(f.getLevel());
        dto.setDescription(f.getDescription());
        dto.setSortOrder(f.getSortOrder());
        dto.setIsEnabled(f.getIsEnabled());
        dto.setSvgMapUrl(f.getSvgMapUrl());
        dto.setCreatedAt(f.getCreatedAt());
        dto.setModifiedAt(f.getModifiedAt());
        return dto;
    }
}
