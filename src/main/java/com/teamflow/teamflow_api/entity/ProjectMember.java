package com.teamflow.teamflow_api.entity;
 
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.time.ZoneId;
 
@Entity
@Table(name = "project_members")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectMember {
    
    @EmbeddedId
    private ProjectMemberId id;
    
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "MEMBER";
    
    @Column(name = "joined_at", updatable = false)
    private LocalDateTime joinedAt;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", insertable = false, updatable = false)
    private Project project;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;
    
    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now(ZoneId.systemDefault());
    }
}