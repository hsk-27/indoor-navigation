package com.indoor.nav.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import jakarta.annotation.PostConstruct;

@Configuration
public class DatabaseMigrationRunner {
    private static final Logger log = LoggerFactory.getLogger(DatabaseMigrationRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public DatabaseMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void runMigrations() {
        log.info("Running database migrations for NodeType renames...");
        try {
            int labsUpdated = jdbcTemplate.update("UPDATE node SET type = 'LABORATORY' WHERE type = 'LAB'");
            if (labsUpdated > 0) log.info("Migrated {} LAB nodes to LABORATORY.", labsUpdated);

            int intersectionsUpdated = jdbcTemplate.update("UPDATE node SET type = 'CORRIDOR_INTERSECTION' WHERE type = 'INTERSECTION'");
            if (intersectionsUpdated > 0) log.info("Migrated {} INTERSECTION nodes to CORRIDOR_INTERSECTION.", intersectionsUpdated);
            
            // Set defaults for new node columns if they are null (due to previous additions)
            jdbcTemplate.update("UPDATE node SET is_accessible = true WHERE is_accessible IS NULL");
            jdbcTemplate.update("UPDATE node SET is_searchable = true WHERE is_searchable IS NULL");
            
            // Set default traversal type for edge
            jdbcTemplate.update("UPDATE edge SET traversal_type = 'NORMAL' WHERE traversal_type IS NULL");
            
        } catch (Exception e) {
            log.error("Failed to run migrations: {}", e.getMessage());
        }
    }
}
