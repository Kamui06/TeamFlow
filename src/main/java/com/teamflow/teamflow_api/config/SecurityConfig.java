package com.teamflow.teamflow_api.config;

import com.teamflow.teamflow_api.security.JwtAuthenticationFilter;
import com.teamflow.teamflow_api.service.CustomUserDetailsService;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.BeanCreationException;
import org.springframework.beans.factory.annotation.Value;

import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;

import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;

import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import org.springframework.boot.web.servlet.FilterRegistrationBean;

import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private final CustomUserDetailsService userDetailsService;
    private final JwtAuthenticationFilter jwtFilter;

    
    //CORS Configuration Bean
    
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origin:http://localhost:5173}")
            String allowedOrigin) {

        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigin));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(
                HttpHeaders.AUTHORIZATION,
                HttpHeaders.CONTENT_TYPE,
                HttpHeaders.ACCEPT,
                HttpHeaders.ORIGIN,
                "X-XSRF-TOKEN"
        ));
            config.setAllowCredentials(true);
            config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    
    //Password Encoder Bean
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    
    //Authentication Manager Bean
    
    @Bean
    public AuthenticationManager authenticationManager(HttpSecurity http) {
        AuthenticationManagerBuilder authBuilder = 
            http.getSharedObject(AuthenticationManagerBuilder.class);
        authBuilder
            .userDetailsService(userDetailsService)
            .passwordEncoder(passwordEncoder());
        try {
            return authBuilder.build();
        } catch (Exception exception) {
            throw new AuthenticationServiceException("Failed to build authentication manager", exception);
        }
    }

    
    // Security Filter Chain Configuration
    
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.getWriter().write(
                    "{\"error\":\"Your session has expired. Please log in again.\",\"code\":\"UNAUTHENTICATED\"}");
                })
                .accessDeniedHandler((request, response, deniedException) -> {
                    Authentication current = SecurityContextHolder.getContext().getAuthentication();
                    boolean anonymous = current == null || current instanceof AnonymousAuthenticationToken;

                    response.setContentType("application/json");
                    if (anonymous) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.getWriter().write(
                        "{\"error\":\"Your session has expired. Please log in again.\",\"code\":\"UNAUTHENTICATED\"}");
                    } else {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.getWriter().write(
                        "{\"error\":\"You do not have permission to perform this action\"}");
                    }
                }))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Public endpoints - MUST match your controller paths
                        .requestMatchers("/auth/register").permitAll()
                        .requestMatchers("/auth/login").permitAll()
                        .requestMatchers("/auth/refresh").permitAll()
                        .requestMatchers("/users/register").permitAll()
                        .requestMatchers("/users/login").permitAll()
                        .requestMatchers("/users/refresh").permitAll()
                        .requestMatchers("/users/logout").permitAll()
                        .requestMatchers("/error").permitAll()
                        // All other requests require authentication
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        try {
            return http.build();
        } catch (Exception exception) {
            throw new BeanCreationException("Failed to build security filter chain", exception);
        }
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }
}