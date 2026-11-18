package com.indoor.nav.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RootController {

    @GetMapping(value = "/", produces = "text/html")
    public String index() {
        return "<!DOCTYPE html>\n" +
               "<html lang=\"en\">\n" +
               "<head>\n" +
               "    <meta charset=\"UTF-8\">\n" +
               "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
               "    <title>CampusNav API Server</title>\n" +
               "    <style>\n" +
               "        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }\n" +
               "        .container { background: rgba(30, 41, 59, 0.6); padding: 40px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; max-width: 500px; }\n" +
               "        h1 { color: #818cf8; margin-top: 0; }\n" +
               "        p { color: #cbd5e1; line-height: 1.6; }\n" +
               "        a.btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; transition: background 0.3s; }\n" +
               "        a.btn:hover { background-color: #4f46e5; }\n" +
               "    </style>\n" +
               "</head>\n" +
               "<body>\n" +
               "    <div class=\"container\">\n" +
               "        <h1>⚙️ CampusNav API Server</h1>\n" +
               "        <p>You have successfully reached the Spring Boot Backend API. This port (8080) is used by the system for REST endpoints.</p>\n" +
               "        <p>If you are looking for the user interface, please click the button below to navigate to the frontend web application.</p>\n" +
               "        <a href=\"javascript:window.location.href = window.location.protocol + '//' + window.location.hostname + ':5173'\" class=\"btn\">Go to Web App</a>\n" +
               "    </div>\n" +
               "</body>\n" +
               "</html>";
    }
}
