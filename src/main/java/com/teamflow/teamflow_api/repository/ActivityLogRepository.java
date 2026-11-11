package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
 
@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Integer> {
    List<ActivityLog> findByProjectId(Integer projectId);
    List<ActivityLog> findByActorId(Integer actorId);
}