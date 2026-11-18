package com.indoor.nav.dtos;

public class AdminNodeRequest {
    private Long id;
    private Long floorId;
    private Long departmentId;
    private String type;
    private String name;
    private String qrId;
    private Double x;
    private Double y;
    private String internalName;
    private String description;
    private Boolean isEnabled;
    private Boolean routeVisibility;
    private Boolean isAccessible;
    private Boolean isSearchable;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getFloorId() { return floorId; }
    public void setFloorId(Long floorId) { this.floorId = floorId; }

    public Long getDepartmentId() { return departmentId; }
    public void setDepartmentId(Long departmentId) { this.departmentId = departmentId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getQrId() { return qrId; }
    public void setQrId(String qrId) { this.qrId = qrId; }

    public Double getX() { return x; }
    public void setX(Double x) { this.x = x; }

    public Double getY() { return y; }
    public void setY(Double y) { this.y = y; }

    public String getInternalName() { return internalName; }
    public void setInternalName(String internalName) { this.internalName = internalName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }

    public Boolean getRouteVisibility() { return routeVisibility; }
    public void setRouteVisibility(Boolean routeVisibility) { this.routeVisibility = routeVisibility; }

    public Boolean getIsAccessible() { return isAccessible; }
    public void setIsAccessible(Boolean isAccessible) { this.isAccessible = isAccessible; }

    public Boolean getIsSearchable() { return isSearchable; }
    public void setIsSearchable(Boolean isSearchable) { this.isSearchable = isSearchable; }
}
