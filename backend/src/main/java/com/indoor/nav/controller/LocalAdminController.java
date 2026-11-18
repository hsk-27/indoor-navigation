package com.indoor.nav.controller;

import com.indoor.nav.models.AdminUser;
import com.indoor.nav.repositories.AdminUserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/local-admin")
public class LocalAdminController {

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/create")
    public ResponseEntity<?> createAdmin(@RequestBody AdminRequest request, HttpServletRequest httpRequest) {
        if (!isLocal(httpRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Local execution only.");
        }

        if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Username cannot be empty.");
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Password cannot be empty.");
        }

        if (adminUserRepository.count() > 0) {
            return ResponseEntity.badRequest().body("An administrator already exists. Please delete it first.");
        }

        AdminUser admin = new AdminUser();
        admin.setUsername(request.getUsername().trim());
        admin.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        adminUserRepository.save(admin);

        return ResponseEntity.ok("Administrator created successfully.");
    }

    @DeleteMapping("/delete/{username}")
    public ResponseEntity<?> deleteAdmin(@PathVariable String username, HttpServletRequest httpRequest) {
        if (!isLocal(httpRequest)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Access denied. Local execution only.");
        }

        Optional<AdminUser> adminOpt = adminUserRepository.findByUsername(username);
        if (adminOpt.isPresent()) {
            adminUserRepository.delete(adminOpt.get());
            return ResponseEntity.ok("Administrator deleted successfully.");
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Administrator not found.");
    }

    private boolean isLocal(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if ("127.0.0.1".equals(remoteAddr) || "0:0:0:0:0:0:0:1".equals(remoteAddr) || "::ffff:127.0.0.1".equals(remoteAddr) || "::1".equals(remoteAddr)) {
            return true;
        }
        
        try {
            // Docker Support: Allow private LAN networks (e.g. 172.18.0.1 gateway or 192.168.x.x)
            java.net.InetAddress addr = java.net.InetAddress.getByName(remoteAddr);
            if (addr.isLoopbackAddress()) {
                return true;
            }

            // Bare Metal Support: Allow any IP bound directly to this machine's interfaces
            java.util.Enumeration<java.net.NetworkInterface> interfaces = java.net.NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                java.net.NetworkInterface networkInterface = interfaces.nextElement();
                java.util.Enumeration<java.net.InetAddress> addresses = networkInterface.getInetAddresses();
                while(addresses.hasMoreElements()) {
                    java.net.InetAddress ifaceAddr = addresses.nextElement();
                    if (ifaceAddr.getHostAddress().equals(remoteAddr)) {
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            // Ignore
        }
        return false;
    }

    public static class AdminRequest {
        private String username;
        private String password;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
    }
}
