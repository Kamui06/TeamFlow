package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.ProjectStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
 
@Repository
public interface ProjectStatusRepository extends JpaRepository<ProjectStatus, Integer> {
    List<ProjectStatus> findByProjectId(Integer projectId);
}