package dev.sebastiancardona.portal.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/**
 * In production one image serves everything: the built SPA lives in the jar's
 * classpath:/static and Spring answers /, /api and /health together (single
 * container = fits pipeline 03 unchanged).
 */
@Configuration
public class WebAppConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // vite emits hashed filenames — cache them hard; everything else stays fresh
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).immutable());
        // the shell must never go stale: it references the hashed bundle of THIS deploy
        registry.addResourceHandler("/index.html")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(CacheControl.noCache());
    }

    /** Client-side routes must serve the SPA shell (deep links). */
    @Controller
    static class SpaForwardController {

        @GetMapping({"/", "/login", "/apps", "/apps/*", "/host", "/settings", "/accounts"})
        public String spa() {
            return "forward:/index.html";
        }
    }
}
