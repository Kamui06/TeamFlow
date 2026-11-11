package com.teamflow.teamflow_api.repository;

import com.teamflow.teamflow_api.entity.Comment;
import com.teamflow.teamflow_api.entity.CommentScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Integer> {

    List<Comment> findByScopeOrderByCreatedAtAsc(CommentScope scope);

    List<Comment> findByTaskIdOrderByCreatedAtAsc(Integer taskId);

    List<Comment> findByProjectIdOrderByCreatedAtAsc(Integer projectId);

    List<Comment> findByTeamIdOrderByCreatedAtAsc(Integer teamId);

    List<Comment> findByAuthorId(Integer authorId);

    List<Comment> findTop500ByOrderByCreatedAtDesc();

    List<Comment> findTop500ByScopeOrderByCreatedAtDesc(CommentScope scope);

    // Raw stored values (ciphertext or legacy plaintext), bypassing the converter.
    @Query(value = "SELECT id, content FROM comments", nativeQuery = true)
    List<Object[]> findRawContent();

    // Writes an already-encrypted value, bypassing the converter. 
    @Modifying
    @Query(value = "UPDATE comments SET content = :content WHERE id = :id", nativeQuery = true)
    int updateStoredContent(@Param("id") Integer id, @Param("content") String content);
}