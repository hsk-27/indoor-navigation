package com.indoor.nav.dtos;

public class NodeResponse {
    private Long id;
    private String name;
    private String type;
    private Double x;
    private Double y;
    private Long floorId;
    private String floorName;
    private String qrId;
    private String departmentName;

    public NodeResponse() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    
    public Double getX() { return x; }
    public void setX(Double x) { this.x = x; }
    
    public Double getY() { return y; }
    public void setY(Double y) { this.y = y; }
    
    public Long getFloorId() { return floorId; }
    public void setFloorId(Long floorId) { this.floorId = floorId; }

    public String getFloorName() { return floorName; }
    public void setFloorName(String floorName) { this.floorName = floorName; }

    public String getQrId() { return qrId; }
    public void setQrId(String qrId) { this.qrId = qrId; }

    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }
}
