package com.indoor.nav.controller;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.indoor.nav.services.DeploymentConfigService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/deployment")
@CrossOrigin(origins = "*")
public class DeploymentController {

    @Value("${app.qr.link.path:../deployment/app_link.png}")
    private String qrLinkPath;

    @Autowired
    private DeploymentConfigService deploymentConfigService;

    @GetMapping
    public ResponseEntity<?> getDeploymentUrl() {
        try {
            ObjectNode rootNode = deploymentConfigService.getFullDeploymentConfig();
            String url = rootNode.has("deploymentUrl") ? rootNode.get("deploymentUrl").asText() : "";
            String lastUpdated = rootNode.has("lastUpdated") ? rootNode.get("lastUpdated").asText() : "Never";
            int version = rootNode.has("deploymentVersion") ? rootNode.get("deploymentVersion").asInt() : 0;
            String generatedBy = rootNode.has("generatedBy") ? rootNode.get("generatedBy").asText() : "None";
            
            boolean hasQr = Files.exists(Paths.get(qrLinkPath));
            
            List<String> ips = new ArrayList<>();
            try {
                Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
                while (interfaces.hasMoreElements()) {
                    NetworkInterface networkInterface = interfaces.nextElement();
                    if (networkInterface.isLoopback() || !networkInterface.isUp()) continue;
                    Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                    while(addresses.hasMoreElements()) {
                        InetAddress addr = addresses.nextElement();
                        if (addr instanceof java.net.Inet4Address) {
                            ips.add(addr.getHostAddress());
                        }
                    }
                }
            } catch (Exception ignore) {}

            boolean isCustomUrl = rootNode.has("isCustomUrl") && rootNode.get("isCustomUrl").asBoolean();

            return ResponseEntity.ok(Map.of(
                "deploymentUrl", url,
                "isCustomUrl", isCustomUrl,
                "lastUpdated", lastUpdated,
                "hasQr", hasQr,
                "deploymentVersion", version,
                "generatedBy", generatedBy,
                "localIps", ips
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/qr")
    public ResponseEntity<?> updateDeploymentAndGenerateQR(@RequestBody Map<String, String> request) {
        String url = request.get("deploymentUrl");
        String isCustomStr = request.get("isCustomUrl");
        if (url == null || url.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "deploymentUrl is required"));
        }

        try {
            // 1. Save Config & Metadata
            ObjectNode rootNode = deploymentConfigService.getFullDeploymentConfig();
            int newVersion = 1;
            
            if (rootNode.has("deploymentVersion")) {
                newVersion = rootNode.get("deploymentVersion").asInt() + 1;
            }
            
            rootNode.put("deploymentUrl", url);
            rootNode.put("deploymentVersion", newVersion);
            
            if (isCustomStr != null) {
                rootNode.put("isCustomUrl", Boolean.parseBoolean(isCustomStr));
            } else {
                rootNode.put("isCustomUrl", false);
            }
            
            java.time.format.DateTimeFormatter dtf = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
            String now = java.time.LocalDateTime.now().format(dtf);
            
            rootNode.put("lastUpdated", now);
            rootNode.put("generatedBy", "admin");
            
            deploymentConfigService.saveFullDeploymentConfig(rootNode);

            // 2. Prepare directory
            Path qrPath = Paths.get(qrLinkPath);
            qrPath.toFile().getParentFile().mkdirs();

            // 3. Generate new QR (Append /entry for deep linking workflow)
            boolean isCustom = Boolean.parseBoolean(isCustomStr != null ? isCustomStr : "false");
            String qrUrl = isCustom ? url : (url.endsWith("/") ? url + "entry" : url + "/entry");
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(qrUrl, BarcodeFormat.QR_CODE, 500, 500);
            MatrixToImageWriter.writeToPath(bitMatrix, "PNG", qrPath);

            return ResponseEntity.ok(Map.of(
                "message", "Application QR regenerated successfully", 
                "lastUpdated", now,
                "deploymentVersion", newVersion,
                "generatedBy", "admin"
            ));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
    
    @GetMapping("/qr-image")
    public ResponseEntity<?> getQrImage() {
        try {
            Path qrPath = Paths.get(qrLinkPath);
            if (!Files.exists(qrPath)) {
                return ResponseEntity.notFound().build();
            }
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(qrPath.toUri());
            return ResponseEntity.ok()
                    .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, org.springframework.http.MediaType.IMAGE_PNG_VALUE)
                    .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"app_link.png\"")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
