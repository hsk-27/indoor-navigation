package com.indoor.nav.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;

@Service
public class DeploymentConfigService {

    @Value("${app.deployment.config.path:./config/deployment.json}")
    private String deploymentConfigPath;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String getDeploymentUrl() {
        try {
            File configFile = new File(deploymentConfigPath);
            if (configFile.exists()) {
                JsonNode rootNode = objectMapper.readTree(configFile);
                if (rootNode.has("deploymentUrl")) {
                    return rootNode.get("deploymentUrl").asText();
                }
            }
        } catch (Exception e) {
            // Log or handle appropriately
        }
        return null;
    }

    public ObjectNode getFullDeploymentConfig() {
        try {
            File configFile = new File(deploymentConfigPath);
            if (configFile.exists()) {
                return (ObjectNode) objectMapper.readTree(configFile);
            }
        } catch (Exception e) {
            // Return empty object node on failure
        }
        return objectMapper.createObjectNode();
    }
    
    public void saveFullDeploymentConfig(ObjectNode rootNode) {
        try {
            File configFile = new File(deploymentConfigPath);
            configFile.getParentFile().mkdirs();
            objectMapper.writeValue(configFile, rootNode);
        } catch (Exception e) {
            throw new RuntimeException("Failed to save deployment config", e);
        }
    }
}
