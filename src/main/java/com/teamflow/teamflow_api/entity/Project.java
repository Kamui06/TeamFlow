package com.teamflow.teamflow_api.entity;
 
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Set;
 
@Entity
@Table(name = "projects")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Project {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;
    
    @Column(nullable = false, length = 150)
    private String name;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";
    
    @Column(name = "start_date")
    private LocalDate startDate;
    
    @Column(name = "due_date")
    private LocalDate dueDate;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;
    
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @OneToMany(mappedBy = "project", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private Set<ProjectStatus> statuses;
    
    @OneToMany(mappedBy = "project", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private Set<Task> tasks;
    
    @OneToMany(mappedBy = "project", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private Set<ProjectMember> members;
    
    @OneToMany(mappedBy = "project", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    private Set<TaskLabel> labels;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now(ZoneId.systemDefault());
        updatedAt = LocalDateTime.now(ZoneId.systemDefault());
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now(ZoneId.systemDefault());
    }
}