package com.indoor.nav.dtos;

public class TelemetryPointDTO {
    private double x;
    private double y;
    private Long floorId;
    private long timestamp;

    public TelemetryPointDTO() {}

    public TelemetryPointDTO(double x, double y, Long floorId, long timestamp) {
        this.x = x;
        this.y = y;
        this.floorId = floorId;
        this.timestamp = timestamp;
    }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }

    public Long getFloorId() { return floorId; }
    public void setFloorId(Long floorId) { this.floorId = floorId; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
}
