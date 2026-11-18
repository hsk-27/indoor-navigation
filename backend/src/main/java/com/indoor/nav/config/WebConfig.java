package com.indoor.nav.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*") // Insecure but necessary for dynamic LAN development IP hosting
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path directUploads = Paths.get("uploads").toAbsolutePath().normalize();
        Path backendUploads = Paths.get("backend/uploads").toAbsolutePath().normalize();
        Path parentBackendUploads = Paths.get("../backend/uploads").toAbsolutePath().normalize();

        String uri1 = directUploads.toUri().toString();
        if (!uri1.endsWith("/")) uri1 += "/";
        String uri2 = backendUploads.toUri().toString();
        if (!uri2.endsWith("/")) uri2 += "/";
        String uri3 = parentBackendUploads.toUri().toString();
        if (!uri3.endsWith("/")) uri3 += "/";

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uri1, uri2, uri3)
                .setCachePeriod(0);
    }

    @Override
    public void configureContentNegotiation(org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer configurer) {
        configurer.mediaType("apk", org.springframework.http.MediaType.valueOf("application/vnd.android.package-archive"));
    }
}
