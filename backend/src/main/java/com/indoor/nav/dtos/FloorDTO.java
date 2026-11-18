package com.indoor.nav.dtos;

public class FloorDTO {
    private Long id;
    private Long buildingId;
    private String name;
    private Integer level;
    private String description;
    private Integer sortOrder;
    private Boolean isEnabled;
    private String svgMapUrl;
    private Long createdAt;
    private Long modifiedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getBuildingId() { return buildingId; }
    public void setBuildingId(Long buildingId) { this.buildingId = buildingId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }
    public String getSvgMapUrl() { return svgMapUrl; }
    public void setSvgMapUrl(String svgMapUrl) { this.svgMapUrl = svgMapUrl; }
    public Long getCreatedAt() { return createdAt; }
    public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }
    public Long getModifiedAt() { return modifiedAt; }
    public void setModifiedAt(Long modifiedAt) { this.modifiedAt = modifiedAt; }
}
