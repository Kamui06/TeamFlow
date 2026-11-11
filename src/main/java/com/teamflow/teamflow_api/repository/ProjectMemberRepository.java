package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.ProjectMember;
import com.teamflow.teamflow_api.entity.ProjectMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
// import org.springframework.data.jpa.repository.Query;
// import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
 
@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMemberId> {
    List<ProjectMember> findByIdProjectId(Integer projectId);
    List<ProjectMember> findByIdUserId(Integer userId);
}