package com.indoor.nav.models;

import jakarta.persistence.*;

@Entity
@Table(name = "graph_metadata")
public class GraphMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "building_name", length = 100)
    private String buildingName;

    @Column(name = "campus_name", length = 100)
    private String campusName;

    @Column(name = "floor_id")
    private Long floorId;

    @Column(name = "svg_width")
    private Double svgWidth;

    @Column(name = "svg_height")
    private Double svgHeight;

    @Column(name = "pixels_per_meter")
    private Double pixelsPerMeter;

    @Column(name = "origin_x")
    private Double originX;

    @Column(name = "origin_y")
    private Double originY;

    @Column(name = "rotation")
    private Double rotation;

    @Column(name = "north_offset")
    private Double northOffset;

    @Column(name = "graph_version")
    private Integer graphVersion;

    @Column(name = "created_timestamp")
    private Long createdTimestamp;

    @Column(name = "modified_timestamp")
    private Long modifiedTimestamp;

    public GraphMetadata() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getBuildingName() { return buildingName; }
    public void setBuildingName(String buildingName) { this.buildingName = buildingName; }

    public String getCampusName() { return campusName; }
    public void setCampusName(String campusName) { this.campusName = campusName; }

    public Long getFloorId() { return floorId; }
    public void setFloorId(Long floorId) { this.floorId = floorId; }

    public Double getSvgWidth() { return svgWidth; }
    public void setSvgWidth(Double svgWidth) { this.svgWidth = svgWidth; }

    public Double getSvgHeight() { return svgHeight; }
    public void setSvgHeight(Double svgHeight) { this.svgHeight = svgHeight; }

    public Double getPixelsPerMeter() { return pixelsPerMeter; }
    public void setPixelsPerMeter(Double pixelsPerMeter) { this.pixelsPerMeter = pixelsPerMeter; }

    public Double getOriginX() { return originX; }
    public void setOriginX(Double originX) { this.originX = originX; }

    public Double getOriginY() { return originY; }
    public void setOriginY(Double originY) { this.originY = originY; }

    public Double getRotation() { return rotation; }
    public void setRotation(Double rotation) { this.rotation = rotation; }

    public Double getNorthOffset() { return northOffset; }
    public void setNorthOffset(Double northOffset) { this.northOffset = northOffset; }

    public Integer getGraphVersion() { return graphVersion; }
    public void setGraphVersion(Integer graphVersion) { this.graphVersion = graphVersion; }

    public Long getCreatedTimestamp() { return createdTimestamp; }
    public void setCreatedTimestamp(Long createdTimestamp) { this.createdTimestamp = createdTimestamp; }

    public Long getModifiedTimestamp() { return modifiedTimestamp; }
    public void setModifiedTimestamp(Long modifiedTimestamp) { this.modifiedTimestamp = modifiedTimestamp; }
}
