package com.indoor.nav.services;

import com.indoor.nav.dtos.NodeResponse;
import java.util.List;

public interface GraphService {
    List<NodeResponse> getAllNodes();
    List<NodeResponse> getNodesByFloor(Long floorId);
    NodeResponse getNodeByQrId(String qrId);
    NodeResponse getNodeById(Long id);
    List<NodeResponse> searchNodes(String query);
}
