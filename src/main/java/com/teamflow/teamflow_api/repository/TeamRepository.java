package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
 
@Repository
public interface TeamRepository extends JpaRepository<Team, Integer> {
    List<Team> findByOwnerId(Integer ownerId);

    long countByCreatedAtAfter(LocalDateTime since);

    @Query("SELECT t FROM Team t JOIN FETCH t.owner ORDER BY t.id")
    List<Team> findAllWithOwner();
}