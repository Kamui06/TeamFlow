package com.teamflow.teamflow_api.entity;
 
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.util.Objects;
 
@Embeddable
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectMemberId implements Serializable {
    
    private static final long serialVersionUID = 1L;
    
    @Column(name = "project_id")
    private Integer projectId;
    
    @Column(name = "user_id")
    private Integer userId;
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProjectMemberId that = (ProjectMemberId) o;
        return Objects.equals(projectId, that.projectId) &&
               Objects.equals(userId, that.userId);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(projectId, userId);
    }
}