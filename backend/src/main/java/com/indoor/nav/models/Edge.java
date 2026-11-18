package com.indoor.nav.models;

import jakarta.persistence.*;

@Entity
@Table(name = "edge")
public class Edge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_id", nullable = false)
    private Node source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_id", nullable = false)
    private Node destination;

    @Column(nullable = false)
    private Double distance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EdgeDirection direction = EdgeDirection.BIDIRECTIONAL;

    @Column(name = "is_enabled", nullable = false)
    private Boolean isEnabled = true;

    @Column(name = "is_floor_transition", nullable = false)
    private Boolean isFloorTransition = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "traversal_type", length = 20, columnDefinition = "varchar(20) default 'NORMAL'")
    private TraversalType traversalType = TraversalType.NORMAL;

    public Edge() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Node getSource() { return source; }
    public void setSource(Node source) { this.source = source; }

    public Node getDestination() { return destination; }
    public void setDestination(Node destination) { this.destination = destination; }

    public Double getDistance() { return distance; }
    public void setDistance(Double distance) { this.distance = distance; }

    public EdgeDirection getDirection() { return direction; }
    public void setDirection(EdgeDirection direction) { this.direction = direction; }

    public Boolean getIsEnabled() { return isEnabled; }
    public void setIsEnabled(Boolean isEnabled) { this.isEnabled = isEnabled; }

    public Boolean getIsFloorTransition() { return isFloorTransition; }
    public void setIsFloorTransition(Boolean isFloorTransition) { this.isFloorTransition = isFloorTransition; }

    public TraversalType getTraversalType() { return traversalType; }
    public void setTraversalType(TraversalType traversalType) { this.traversalType = traversalType; }
}
