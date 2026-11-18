package com.indoor.nav.models;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "building")
public class Building {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100, unique = true)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "is_enabled", nullable = false)
    private Boolean isEnabled = true;

    // Phase 3: Geofencing
    @Column(name = "latitude", nullable = true)
    private Double latitude;

    @Column(name = "longitude", nullable = true)
    private Double longitude;

    @Column(name = "geofence_radius", nullable = true)
    private Double geofenceRadius;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Long createdAt;

    @Column(name = "modified_at", nullable = false)
    private Long modifiedAt;

    @OneToMany(mappedBy = "building", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<Floor> floors = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now().toEpochMilli();
        this.modifiedAt = this.createdAt;
        if (this.isEnabled == null) this.isEnabled = true;
    }

    @PreUpdate
    protected void onUpdate() {
        this.modifiedAt = Instant.now().toEpochMilli();
    }

    public Building() {}

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

    public List<Floor> getFloors() { return floors; }
    public void setFloors(List<Floor> floors) { this.floors = floors; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Double getGeofenceRadius() { return geofenceRadius; }
    public void setGeofenceRadius(Double geofenceRadius) { this.geofenceRadius = geofenceRadius; }
}
