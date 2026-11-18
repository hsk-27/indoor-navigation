package com.indoor.nav.controller;

import com.indoor.nav.dtos.RouteResponse;
import com.indoor.nav.services.GraphCacheService;
import com.indoor.nav.services.NavigationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/navigation")
public class NavigationController {

    private final NavigationService navigationService;

    @Autowired
    public NavigationController(NavigationService navigationService) {
        this.navigationService = navigationService;
    }

    @PostMapping("/route")
    public ResponseEntity<RouteResponse> computeRoute(@RequestBody Map<String, Object> payload) {
        Object srcRaw = payload.get("sourceNodeId");
        Object destRaw = payload.get("destinationNodeId");
        
        if (srcRaw == null || destRaw == null) {
            return ResponseEntity.badRequest().build();
        }
        
        Long sourceNodeId;
        Long destinationNodeId;
        try {
            sourceNodeId = (srcRaw instanceof Number) ? ((Number) srcRaw).longValue() : Long.parseLong(srcRaw.toString());
            destinationNodeId = (destRaw instanceof Number) ? ((Number) destRaw).longValue() : Long.parseLong(destRaw.toString());
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().build();
        }
        
        String accessProfile = payload.get("accessProfile") instanceof String 
            ? (String) payload.get("accessProfile") 
            : "AUTHORIZED_LIFT_USER";
        
        RouteResponse route = navigationService.calculatePath(sourceNodeId, destinationNodeId, accessProfile);
        return ResponseEntity.ok(route);
    }
}
