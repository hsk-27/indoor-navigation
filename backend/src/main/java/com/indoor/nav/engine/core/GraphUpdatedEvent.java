package com.indoor.nav.engine.core;

import org.springframework.context.ApplicationEvent;

public class GraphUpdatedEvent extends ApplicationEvent {
    public GraphUpdatedEvent(Object source) {
        super(source);
    }
}
