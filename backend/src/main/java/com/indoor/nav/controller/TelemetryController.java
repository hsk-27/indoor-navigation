package com.indoor.nav.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.indoor.nav.dtos.SuccessResponseDTO;
import com.indoor.nav.dtos.TelemetryPointDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@RestController
public class TelemetryController {

    private final File telemetryFile;
    private final ObjectMapper mapper = new ObjectMapper();
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();

    public TelemetryController(@org.springframework.beans.factory.annotation.Value("${app.upload.dir:./uploads}") String uploadDir) {
        this.telemetryFile = new File(uploadDir, "telemetry.json");
        if (!telemetryFile.getParentFile().exists()) {
            telemetryFile.getParentFile().mkdirs();
        }
        if (!telemetryFile.exists()) {
            try {
                mapper.writeValue(telemetryFile, new ArrayList<TelemetryPointDTO>());
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    @PostMapping("/api/v1/telemetry/unmapped")
    public ResponseEntity<SuccessResponseDTO> submitTelemetry(@RequestBody List<TelemetryPointDTO> points) {
        if (points == null || points.isEmpty()) {
            return ResponseEntity.ok(new SuccessResponseDTO("No points to save"));
        }

        lock.writeLock().lock();
        try {
            List<TelemetryPointDTO> existing = new ArrayList<>();
            if (telemetryFile.exists()) {
                existing = mapper.readValue(telemetryFile, new TypeReference<List<TelemetryPointDTO>>() {});
            }
            existing.addAll(points);
            mapper.writeValue(telemetryFile, existing);
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        } finally {
            lock.writeLock().unlock();
        }
        return ResponseEntity.ok(new SuccessResponseDTO("Telemetry saved"));
    }

    @GetMapping("/api/v1/admin/telemetry/unmapped")
    public ResponseEntity<List<TelemetryPointDTO>> getTelemetry() {
        lock.readLock().lock();
        try {
            if (telemetryFile.exists()) {
                List<TelemetryPointDTO> points = mapper.readValue(telemetryFile, new TypeReference<List<TelemetryPointDTO>>() {});
                return ResponseEntity.ok(points);
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            lock.readLock().unlock();
        }
        return ResponseEntity.ok(new ArrayList<>());
    }

    @DeleteMapping("/api/v1/admin/telemetry/unmapped")
    public ResponseEntity<SuccessResponseDTO> clearTelemetry() {
        lock.writeLock().lock();
        try {
            mapper.writeValue(telemetryFile, new ArrayList<TelemetryPointDTO>());
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        } finally {
            lock.writeLock().unlock();
        }
        return ResponseEntity.ok(new SuccessResponseDTO("Telemetry cleared"));
    }
}
