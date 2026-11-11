package com.teamflow.teamflow_api.entity;
 
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.time.ZoneId;
 
@Entity
@Table(name = "task_labels")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TaskLabel {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;
    
    @Column(nullable = false, length = 50)
    private String name;
    
    @Column(nullable = false, length = 7)
    @Builder.Default
    private String color = "#808080";
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now(ZoneId.systemDefault());
    }
}