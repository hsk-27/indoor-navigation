package com.indoor.nav.dtos;

public class NodeDTO {
    private Long id;
    private String name;
    private String type;
    private Long floorId;
    private Double x;
    private Double y;

    public NodeDTO() {}
    public NodeDTO(Long id, String name, String type, Long floorId, Double x, Double y) {
        this.id = id; this.name = name; this.type = type; this.floorId = floorId; this.x = x; this.y = y;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Long getFloorId() { return floorId; }
    public void setFloorId(Long floorId) { this.floorId = floorId; }
    public Double getX() { return x; }
    public void setX(Double x) { this.x = x; }
    public Double getY() { return y; }
    public void setY(Double y) { this.y = y; }
}
