package com.teamflow.teamflow_api.service;

import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.UserRepository;
import com.teamflow.teamflow_api.security.UserPrincipal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomUserDetailsService implements UserDetailsService {
    
    private final UserRepository userRepository;
    
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> {
                    log.warn("User not found with username: {}", username);
                    return new UsernameNotFoundException("User not found with username: " + username);
                });
        
        return UserPrincipal.create(user);
    }
    
    public UserDetails loadUserById(Integer userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> {
                    log.warn("User not found with id: {}", userId);
                    return new UsernameNotFoundException("User not found with id: " + userId);
                });
        
        return UserPrincipal.create(user);
    }
}