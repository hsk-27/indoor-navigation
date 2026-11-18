package com.indoor.nav.dtos;

public class BuildingDTO {
    private Long id;
    private String name;
    private String description;
    private Boolean isEnabled;
    private Long createdAt;
    private Long modifiedAt;
    
    private Double latitude;
    private Double longitude;
    private Double geofenceRadius;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }
    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }
    public Long getModifiedAt() { return modifiedAt; }
    public void setModifiedAt(Long modifiedAt) { this.modifiedAt = modifiedAt; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Double getGeofenceRadius() { return geofenceRadius; }
    public void setGeofenceRadius(Double geofenceRadius) { this.geofenceRadius = geofenceRadius; }
}
