package com.teamflow.teamflow_api.repository;
 
import com.teamflow.teamflow_api.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
 
@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Integer> {
    List<Attachment> findByTaskId(Integer taskId);
}