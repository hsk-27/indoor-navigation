package com.indoor.nav.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.indoor.nav.dtos.SuccessResponseDTO;

@RestController
@RequestMapping("/api/v1/svg")
public class SvgController {

    @PostMapping("/upload")
    public ResponseEntity<SuccessResponseDTO> uploadSvg() {
        return ResponseEntity.ok(new SuccessResponseDTO("SVG uploaded successfully."));
    }
}
