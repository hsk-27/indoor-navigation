package com.indoor.nav.models;

import jakarta.persistence.*;
import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "floor")
public class Floor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private Integer level;
    
    @Column(name = "svg_map_url", length = 500)
    private String svgMapUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id")
    @JsonIgnore
    private Building building;

    @Column(length = 500)
    private String description;

    @Column(name = "sort_order", columnDefinition = "integer default 0")
    private Integer sortOrder = 0;

    @Column(name = "is_enabled", columnDefinition = "boolean default true")
    private Boolean isEnabled = true;

    @Column(name = "created_at", columnDefinition = "bigint default 0", updatable = false)
    private Long createdAt;

    @Column(name = "modified_at", columnDefinition = "bigint default 0")
    private Long modifiedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now().toEpochMilli();
        this.modifiedAt = this.createdAt;
        if (this.isEnabled == null) this.isEnabled = true;
        if (this.sortOrder == null) this.sortOrder = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        this.modifiedAt = Instant.now().toEpochMilli();
    }

    public Floor() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }

    public String getSvgMapUrl() { return svgMapUrl; }
    public void setSvgMapUrl(String svgMapUrl) { this.svgMapUrl = svgMapUrl; }

    public Building getBuilding() { return building; }
    public void setBuilding(Building building) { this.building = building; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }

    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }

    public Long getModifiedAt() { return modifiedAt; }
    public void setModifiedAt(Long modifiedAt) { this.modifiedAt = modifiedAt; }
}
