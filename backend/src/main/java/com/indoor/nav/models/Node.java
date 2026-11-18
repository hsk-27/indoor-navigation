package com.indoor.nav.models;

import jakarta.persistence.*;

@Entity
@Table(name = "node")
public class Node {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private NodeType type;

    @Column(nullable = false)
    private String name;

    @Column(name = "qr_id", unique = true, length = 100)
    private String qrId;

    @Column(nullable = false)
    private Double x;

    @Column(nullable = false)
    private Double y;

    @Column(name = "internal_name", length = 100)
    private String internalName;

    @Column(length = 500)
    private String description;

    @Column(name = "is_enabled", nullable = false)
    private Boolean isEnabled = true;

    @Column(name = "route_visibility", nullable = false)
    private Boolean routeVisibility = true;

    @Column(name = "is_accessible", columnDefinition = "boolean default true")
    private Boolean isAccessible = true;

    @Column(name = "is_searchable", columnDefinition = "boolean default true")
    private Boolean isSearchable = true;

    public Node() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Floor getFloor() { return floor; }
    public void setFloor(Floor floor) { this.floor = floor; }

    public Department getDepartment() { return department; }
    public void setDepartment(Department department) { this.department = department; }

    public NodeType getType() { return type; }
    public void setType(NodeType type) { this.type = type; }

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

    @Transient
    public NodeCategory getCategory() {
        if (type == null) return null;
        switch (type) {
            case ROOM:
            case LABORATORY:
            case OFFICE:
            case CLASSROOM:
            case WASHROOM:
            case RECEPTION:
            case UTILITY:
            case DESTINATION:
                return NodeCategory.DESTINATION;
            case STAIRCASE:
            case LIFT:
            case CORRIDOR:
            case CORRIDOR_INTERSECTION:
            case CORRIDOR_BEND:
            case ENTRANCE:
            case BUILDING_ENTRANCE:
            case FLOOR_ENTRANCE:
            case EMERGENCY_EXIT:
                return NodeCategory.CONNECTOR;
            default:
                return NodeCategory.CONNECTOR;
        }
    }
}
