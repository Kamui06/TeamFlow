package com.teamflow.teamflow_api.service;
 
import com.teamflow.teamflow_api.dto.UserRegistrationRequest;
import com.teamflow.teamflow_api.entity.SystemRole;
import com.teamflow.teamflow_api.entity.User;
import com.teamflow.teamflow_api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.List;
 
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserService {

    private static final String USER_NOT_FOUND = "User not found";
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    public User registerUser(UserRegistrationRequest request) {
        // Check if user already exists
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }
        
        // Create new user
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .isActive(true)
                .build();
        
        return userRepository.save(user);
    }

    
    public User loginUser(String email, String password) {
        User user = userRepository.findByEmail(email)
        .orElseThrow(() ->
        new IllegalArgumentException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new IllegalArgumentException("User account is inactive");
        }

        return user;
    }

    
    @Transactional(readOnly = true)
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }
    
    @Transactional(readOnly = true)
    public Optional<User> getUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }
    
    @Transactional(readOnly = true)
    public Optional<User> getUserById(Integer userId) {
        return userRepository.findById(userId);
    }

    @Transactional
    public User changeSystemRole(Integer targetId, SystemRole newRole, Integer callerId) {
        if (targetId.equals(callerId) && newRole != SystemRole.ADMIN) {
            throw new IllegalArgumentException("You cannot remove your own admin role");
        }
        User user = userRepository.findById(targetId)
            .orElseThrow(() -> new IllegalArgumentException(USER_NOT_FOUND));
        user.setRole(newRole);
        return userRepository.save(user);
    }
    
    public User updateUser(Integer userId, User userUpdates) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException(USER_NOT_FOUND));
        
        if (userUpdates.getFirstName() != null) {
            user.setFirstName(userUpdates.getFirstName());
        }
        if (userUpdates.getLastName() != null) {
            user.setLastName(userUpdates.getLastName());
        }
        if (userUpdates.getIsActive() != null) {
            user.setIsActive(userUpdates.getIsActive());
        }
        
        return userRepository.save(user);
    }
    
    public User deactivateUser(Integer userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException(USER_NOT_FOUND));
        user.setIsActive(false);
        return userRepository.save(user);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }
}