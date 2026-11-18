package com.indoor.nav.config;

import com.indoor.nav.models.*;
import com.indoor.nav.repositories.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);


    @Autowired
    private BuildingRepository buildingRepository;

    @Autowired
    private FloorRepository floorRepository;

    @Autowired
    private GraphMetadataRepository metadataRepository;

    @Autowired
    private NodeRepository nodeRepository;

    @Autowired
    private EdgeRepository edgeRepository;


    @Autowired
    private com.indoor.nav.services.GraphCacheService graphCacheService;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        seedBuildingAndFloors();
        graphCacheService.reloadGraph();
    }

    private void seedBuildingAndFloors() {
        Building building = buildingRepository.findByName("GHRCE Main Campus")
                .orElseGet(() -> {
                    Building b = new Building();
                    b.setName("GHRCE Main Campus");
                    b.setDescription("Main building campus indoor navigation");
                    b.setIsEnabled(true);
                    b.setCreatedAt(Instant.now().toEpochMilli());
                    b.setModifiedAt(Instant.now().toEpochMilli());
                    return buildingRepository.save(b);
                });

        // 6 Floors configuration (Basement to Fourth Floor)
        Floor fb = syncFloor(building, "Basement Floor", -1, 0, "/uploads/svgs/basement_floor.svg", "Basement parking, utility, and maintenance rooms");
        Floor f0 = syncFloor(building, "Ground Floor", 0, 1, "/uploads/svgs/ground_floor.svg", "Ground floor classrooms, labs, and main entrance");
        Floor f1 = syncFloor(building, "First Floor", 1, 2, "/uploads/svgs/first_floor.svg", "First floor classrooms and faculty rooms");
        Floor f2 = syncFloor(building, "Second Floor", 2, 3, "/uploads/svgs/second_floor.svg", "Second floor departments and labs");
        Floor f3 = syncFloor(building, "Third Floor", 3, 4, "/uploads/svgs/third_floor.svg", "Third floor library and seminar halls");
        Floor f4 = syncFloor(building, "Fourth Floor", 4, 5, "/uploads/svgs/fourth_floor.svg", "Fourth floor auditorium and rooftop");

        syncMetadata(fb, building.getName());
        syncMetadata(f0, building.getName());
        syncMetadata(f1, building.getName());
        syncMetadata(f2, building.getName());
        syncMetadata(f3, building.getName());
        syncMetadata(f4, building.getName());

        // seedSampleGraph(fb, f0, f1, f2, f3, f4);
        log.info("Synced 6 floors, landscape metadata (1191x842), and navigation graph across all floors.");
    }

    private Floor syncFloor(Building building, String name, int level, int sortOrder, String svgUrl, String description) {
        Optional<Floor> existing = floorRepository.findByBuildingIdAndLevel(building.getId(), level);
        Floor floor;
        if (existing.isPresent()) {
            floor = existing.get();
            floor.setName(name);
            floor.setSortOrder(sortOrder);
            floor.setSvgMapUrl(svgUrl);
            floor.setDescription(description);
            floor.setIsEnabled(true);
            floor.setModifiedAt(Instant.now().toEpochMilli());
        } else {
            floor = new Floor();
            floor.setBuilding(building);
            floor.setName(name);
            floor.setLevel(level);
            floor.setSortOrder(sortOrder);
            floor.setSvgMapUrl(svgUrl);
            floor.setDescription(description);
            floor.setIsEnabled(true);
            floor.setCreatedAt(Instant.now().toEpochMilli());
            floor.setModifiedAt(Instant.now().toEpochMilli());
        }
        return floorRepository.save(floor);
    }

    private void syncMetadata(Floor floor, String buildingName) {
        boolean isNew = !metadataRepository.findByFloorId(floor.getId()).isPresent();
        GraphMetadata meta = metadataRepository.findByFloorId(floor.getId()).orElse(new GraphMetadata());
        
        if (isNew) {
            meta.setFloorId(floor.getId());
            meta.setBuildingName(buildingName);
            meta.setSvgWidth(1191.0);
            meta.setSvgHeight(842.0);
            meta.setPixelsPerMeter(12.5);
            meta.setOriginX(0.0);
            meta.setOriginY(0.0);
            meta.setRotation(0.0);
            meta.setNorthOffset(0.0);
            meta.setGraphVersion(1);
            meta.setCreatedTimestamp(System.currentTimeMillis());
        }
        meta.setModifiedTimestamp(System.currentTimeMillis());
        metadataRepository.save(meta);
    }

    private void seedSampleGraph(Floor fb, Floor f0, Floor f1, Floor f2, Floor f3, Floor f4) {
        // --- Basement Floor Nodes & Edges ---
        Node nB_C1 = upsertNode(fb, "Basement Corridor 1", NodeType.CORRIDOR, "QR_B_C1", 800.0, 420.0, true, true);
        Node nB_C2 = upsertNode(fb, "Basement Corridor 2", NodeType.CORRIDOR_INTERSECTION, "QR_B_C2", 600.0, 420.0, true, true);
        Node nB_Stair = upsertNode(fb, "Staircase Basement", NodeType.STAIRCASE, "QR_B_STAIR", 600.0, 260.0, true, true);
        Node nB_Lift = upsertNode(fb, "Lift Basement", NodeType.LIFT, "QR_B_LIFT", 600.0, 190.0, true, true);
        Node nB_Lab1 = upsertNode(fb, "Project Lab B-01", NodeType.LABORATORY, "QR_B_LAB01", 500.0, 550.0, true, true);
        Node nB_Lab2 = upsertNode(fb, "Network Lab B-02", NodeType.LABORATORY, "QR_B_LAB02", 350.0, 300.0, true, true);
        Node nB_CC3 = upsertNode(fb, "Computer Center B-03", NodeType.LABORATORY, "QR_B_CC03", 350.0, 450.0, true, true);
        Node nB_CC4 = upsertNode(fb, "Computer Center B-04", NodeType.LABORATORY, "QR_B_CC04", 400.0, 650.0, true, true);

        upsertEdge(nB_C1, nB_C2, 16.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nB_C2, nB_Stair, 12.8, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nB_C2, nB_Lift, 18.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nB_C2, nB_Lab1, 13.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nB_C2, nB_Lab2, 22.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nB_C2, nB_CC3, 20.2, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nB_C2, nB_CC4, 24.5, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);

        // --- Ground Floor Nodes & Edges ---
        Node nEnt = upsertNode(f0, "Main Entrance", NodeType.BUILDING_ENTRANCE, "QR_G_ENT", 1080.0, 420.0, true, true);
        Node nRec = upsertNode(f0, "Reception", NodeType.RECEPTION, "QR_G_REC", 950.0, 420.0, true, true);
        Node nC1 = upsertNode(f0, "Central Corridor G1", NodeType.CORRIDOR, "QR_G_C1", 800.0, 420.0, true, true);
        Node nC2 = upsertNode(f0, "Central Corridor G2", NodeType.CORRIDOR_INTERSECTION, "QR_G_C2", 600.0, 420.0, true, true);
        Node nStairG = upsertNode(f0, "Staircase Ground", NodeType.STAIRCASE, "QR_G_STAIR", 600.0, 260.0, true, true);
        Node nLiftG = upsertNode(f0, "Lift Ground", NodeType.LIFT, "QR_G_LIFT", 600.0, 190.0, true, true);
        Node nLab21 = upsertNode(f0, "Laboratory C-21", NodeType.LABORATORY, "QR_G_LAB21", 400.0, 490.0, true, true);
        Node nRm28 = upsertNode(f0, "Room C-28", NodeType.ROOM, "QR_G_RM28", 400.0, 340.0, true, true);

        upsertEdge(nEnt, nRec, 10.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nRec, nC1, 12.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nC1, nC2, 16.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nC2, nStairG, 12.8, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nC2, nLiftG, 18.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nC2, nLab21, 16.9, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(nC2, nRm28, 17.2, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);

        // --- First Floor Nodes & Edges ---
        Node n1C1 = upsertNode(f1, "Central Corridor 1F-1", NodeType.CORRIDOR, "QR_1F_C1", 800.0, 420.0, true, true);
        Node n1C2 = upsertNode(f1, "Central Corridor 1F-2", NodeType.CORRIDOR_INTERSECTION, "QR_1F_C2", 600.0, 420.0, true, true);
        Node nStair1 = upsertNode(f1, "Staircase Floor 1", NodeType.STAIRCASE, "QR_1F_STAIR", 600.0, 260.0, true, true);
        Node nLift1 = upsertNode(f1, "Lift Floor 1", NodeType.LIFT, "QR_1F_LIFT", 600.0, 190.0, true, true);
        Node nCr101 = upsertNode(f1, "Classroom 101", NodeType.CLASSROOM, "QR_1F_CR101", 400.0, 490.0, true, true);
        Node nCr102 = upsertNode(f1, "Classroom 102", NodeType.CLASSROOM, "QR_1F_CR102", 400.0, 340.0, true, true);

        upsertEdge(n1C1, n1C2, 16.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n1C2, nStair1, 12.8, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n1C2, nLift1, 18.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n1C2, nCr101, 16.9, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n1C2, nCr102, 17.2, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);

        // --- Second Floor Nodes & Edges ---
        Node n2C1 = upsertNode(f2, "Central Corridor 2F-1", NodeType.CORRIDOR, "QR_2F_C1", 800.0, 420.0, true, true);
        Node n2C2 = upsertNode(f2, "Central Corridor 2F-2", NodeType.CORRIDOR_INTERSECTION, "QR_2F_C2", 600.0, 420.0, true, true);
        Node nStair2 = upsertNode(f2, "Staircase Floor 2", NodeType.STAIRCASE, "QR_2F_STAIR", 600.0, 260.0, true, true);
        Node nLift2 = upsertNode(f2, "Lift Floor 2", NodeType.LIFT, "QR_2F_LIFT", 600.0, 190.0, true, true);
        Node nDept201 = upsertNode(f2, "Department Office 201", NodeType.OFFICE, "QR_2F_DEP201", 400.0, 490.0, true, true);
        Node nFac202 = upsertNode(f2, "Faculty Room 202", NodeType.ROOM, "QR_2F_FAC202", 400.0, 340.0, true, true);

        upsertEdge(n2C1, n2C2, 16.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n2C2, nStair2, 12.8, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n2C2, nLift2, 18.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n2C2, nDept201, 16.9, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n2C2, nFac202, 17.2, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);

        // --- Third Floor Nodes & Edges ---
        Node n3C1 = upsertNode(f3, "Central Corridor 3F-1", NodeType.CORRIDOR, "QR_3F_C1", 800.0, 420.0, true, true);
        Node n3C2 = upsertNode(f3, "Central Corridor 3F-2", NodeType.CORRIDOR_INTERSECTION, "QR_3F_C2", 600.0, 420.0, true, true);
        Node nStair3 = upsertNode(f3, "Staircase Floor 3", NodeType.STAIRCASE, "QR_3F_STAIR", 600.0, 260.0, true, true);
        Node nLift3 = upsertNode(f3, "Lift Floor 3", NodeType.LIFT, "QR_3F_LIFT", 600.0, 190.0, true, true);
        Node nLib301 = upsertNode(f3, "Central Library", NodeType.ROOM, "QR_3F_LIB", 400.0, 490.0, true, true);
        Node nSem302 = upsertNode(f3, "Seminar Hall 302", NodeType.CLASSROOM, "QR_3F_SEM302", 400.0, 340.0, true, true);

        upsertEdge(n3C1, n3C2, 16.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n3C2, nStair3, 12.8, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n3C2, nLift3, 18.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n3C2, nLib301, 16.9, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n3C2, nSem302, 17.2, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);

        // --- Fourth Floor Nodes & Edges ---
        Node n4C1 = upsertNode(f4, "Central Corridor 4F-1", NodeType.CORRIDOR, "QR_4F_C1", 800.0, 420.0, true, true);
        Node n4C2 = upsertNode(f4, "Central Corridor 4F-2", NodeType.CORRIDOR_INTERSECTION, "QR_4F_C2", 600.0, 420.0, true, true);
        Node nStair4 = upsertNode(f4, "Staircase Floor 4", NodeType.STAIRCASE, "QR_4F_STAIR", 600.0, 260.0, true, true);
        Node nLift4 = upsertNode(f4, "Lift Floor 4", NodeType.LIFT, "QR_4F_LIFT", 600.0, 190.0, true, true);
        Node nAud401 = upsertNode(f4, "Main Auditorium", NodeType.ROOM, "QR_4F_AUD", 400.0, 490.0, true, true);
        Node nConf402 = upsertNode(f4, "Conference Hall 402", NodeType.ROOM, "QR_4F_CONF", 400.0, 340.0, true, true);

        upsertEdge(n4C1, n4C2, 16.0, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n4C2, nStair4, 12.8, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n4C2, nLift4, 18.4, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n4C2, nAud401, 16.9, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);
        upsertEdge(n4C2, nConf402, 17.2, EdgeDirection.BIDIRECTIONAL, false, TraversalType.NORMAL);

        // --- Multi-floor Vertical Transitions (Basement -> Ground -> 1F -> 2F -> 3F -> 4F) ---
        upsertEdge(nB_Stair, nStairG, 15.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.STAIRS);
        upsertEdge(nStairG, nStair1, 15.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.STAIRS);
        upsertEdge(nStair1, nStair2, 15.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.STAIRS);
        upsertEdge(nStair2, nStair3, 15.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.STAIRS);
        upsertEdge(nStair3, nStair4, 15.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.STAIRS);

        upsertEdge(nB_Lift, nLiftG, 10.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.LIFT);
        upsertEdge(nLiftG, nLift1, 10.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.LIFT);
        upsertEdge(nLift1, nLift2, 10.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.LIFT);
        upsertEdge(nLift2, nLift3, 10.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.LIFT);
        upsertEdge(nLift3, nLift4, 10.0, EdgeDirection.BIDIRECTIONAL, true, TraversalType.LIFT);
    }

    private Node upsertNode(Floor floor, String name, NodeType type, String qrId, Double x, Double y, boolean searchable, boolean accessible) {
        Node node = nodeRepository.findByQrId(qrId).orElse(new Node());
        node.setFloor(floor);
        node.setName(name);
        node.setType(type);
        node.setQrId(qrId);
        node.setX(x);
        node.setY(y);
        node.setIsEnabled(true);
        node.setRouteVisibility(true);
        node.setIsSearchable(searchable);
        node.setIsAccessible(accessible);
        return nodeRepository.save(node);
    }

    private Edge upsertEdge(Node src, Node dst, Double dist, EdgeDirection dir, boolean isFloorTransition, TraversalType type) {
        Edge edge = edgeRepository.findBySourceIdAndDestinationId(src.getId(), dst.getId()).orElse(new Edge());
        edge.setSource(src);
        edge.setDestination(dst);
        edge.setDistance(dist);
        edge.setDirection(dir);
        edge.setIsEnabled(true);
        edge.setIsFloorTransition(isFloorTransition);
        edge.setTraversalType(type);
        return edgeRepository.save(edge);
    }
}
