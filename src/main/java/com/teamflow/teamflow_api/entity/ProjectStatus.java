package com.teamflow.teamflow_api.entity;
 
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.time.ZoneId;
 
@Entity
@Table(name = "project_statuses")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectStatus {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;
    
    @Column(nullable = false, length = 50)
    private String name;
    
    @Column(nullable = false, length = 30)
    private String code;
    
    @Column(nullable = false)
    @Builder.Default
    private Integer position = 0;
    
    @Column(name = "is_default", nullable = false)
    @Builder.Default
    private Boolean isDefault = false;
    
    @Column(name = "is_final", nullable = false)
    @Builder.Default
    private Boolean isFinal = false;
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now(ZoneId.systemDefault());
    }
}