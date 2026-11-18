package com.indoor.nav.services;

public interface MapService {
    /**
     * Retrieves the SVG Map URL and metadata for a specific floor.
     */
    String getSvgMapUrl(Long floorId);
}
