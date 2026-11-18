package com.indoor.nav.services.impl;

import com.indoor.nav.exceptions.ResourceNotFoundException;
import com.indoor.nav.repositories.FloorRepository;
import com.indoor.nav.services.MapService;
import org.springframework.stereotype.Service;

@Service
public class MapServiceImpl implements MapService {

    private final FloorRepository floorRepository;

    public MapServiceImpl(FloorRepository floorRepository) {
        this.floorRepository = floorRepository;
    }

    @Override
    public String getSvgMapUrl(Long floorId) {
        return floorRepository.findById(floorId)
                .map(floor -> floor.getSvgMapUrl())
                .orElseThrow(() -> new ResourceNotFoundException("Floor map not found"));
    }
}
