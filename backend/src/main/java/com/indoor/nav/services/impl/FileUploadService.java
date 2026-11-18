package com.indoor.nav.services.impl;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Service
public class FileUploadService {

    private final String UPLOAD_DIR = "uploads/svgs/";

    public FileUploadService() {
        try {
            Path path = Paths.get(UPLOAD_DIR);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
        } catch (Exception e) {
            throw new RuntimeException("Could not create upload directory", e);
        }
    }

    public static class SvgDimensions {
        public double width;
        public double height;
    }

    public String saveSvgFile(MultipartFile file) {
        try {
            if (file.isEmpty() || file.getOriginalFilename() == null || !file.getOriginalFilename().toLowerCase().endsWith(".svg")) {
                throw new IllegalArgumentException("File must be a valid SVG");
            }
            String filename = UUID.randomUUID().toString() + ".svg";
            Path filepath = Paths.get(UPLOAD_DIR + filename);
            file.transferTo(filepath);
            return "/uploads/svgs/" + filename;
        } catch (Exception e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    public SvgDimensions extractDimensions(MultipartFile file) {
        try {
            DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
            dbFactory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
            
            try (InputStream is = file.getInputStream()) {
                Document doc = dBuilder.parse(is);
                doc.getDocumentElement().normalize();
                Element svgElement = doc.getDocumentElement();
                
                SvgDimensions dims = new SvgDimensions();
                
                String widthStr = svgElement.getAttribute("width");
                String heightStr = svgElement.getAttribute("height");
                String viewBoxStr = svgElement.getAttribute("viewBox");
                
                if (viewBoxStr != null && !viewBoxStr.isEmpty()) {
                    String[] parts = viewBoxStr.split(" ");
                    if (parts.length == 4) {
                        dims.width = Double.parseDouble(parts[2]);
                        dims.height = Double.parseDouble(parts[3]);
                        return dims;
                    }
                }
                
                if (widthStr != null && !widthStr.isEmpty() && heightStr != null && !heightStr.isEmpty()) {
                    dims.width = parseDimension(widthStr);
                    dims.height = parseDimension(heightStr);
                    return dims;
                }
                
                dims.width = 1191.0;
                dims.height = 842.0;
                return dims;
            }
        } catch (Exception e) {
            SvgDimensions dims = new SvgDimensions();
            dims.width = 1191.0;
            dims.height = 842.0;
            return dims;
        }
    }

    private double parseDimension(String val) {
        try {
            return Double.parseDouble(val.replaceAll("[^0-9.]", ""));
        } catch (Exception e) {
            return 1191.0;
        }
    }
}
