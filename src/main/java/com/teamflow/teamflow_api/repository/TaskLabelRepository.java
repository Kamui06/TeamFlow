package com.teamflow.teamflow_api.repository;

import com.teamflow.teamflow_api.entity.TaskLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskLabelRepository extends JpaRepository<TaskLabel, Integer> {

    List<TaskLabel> findByProjectId(Integer projectId);
}