package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.TeamMember;
import com.teamflow.teamflow_api.entity.TeamMemberId;
import com.teamflow.teamflow_api.repository.TeamMemberRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Collection;
 
@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, TeamMemberId> {
    List<TeamMember> findByIdUserId(Integer userId);
    List<TeamMember> findByIdTeamId(Integer teamId);
    
    @Query("SELECT COUNT(tm) FROM TeamMember tm WHERE tm.id.userId = :userId")
    long countTeamsByUserId(@Param("userId") Integer userId);
    
    @Query("SELECT COUNT(tm) FROM TeamMember tm WHERE tm.id.teamId = :teamId")
    long countMembersByTeamId(@Param("teamId") Integer teamId);

    @Query("SELECT tm FROM TeamMember tm JOIN FETCH tm.user WHERE tm.team.id IN :teamIds")
    List<TeamMember> findByTeamIdsWithUser(@Param("teamIds") Collection<Integer> teamIds);
}