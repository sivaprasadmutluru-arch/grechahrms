package com.example.demo.offboarding.repository;

import com.example.demo.offboarding.entity.EmployeeOffboarding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface EmployeeOffboardingRepository extends JpaRepository<EmployeeOffboarding, Long>, JpaSpecificationExecutor<EmployeeOffboarding> {
    List<EmployeeOffboarding> findByEmployeeId(Long employeeId);
    List<EmployeeOffboarding> findByStatus(EmployeeOffboarding.OffboardingStatus status);

    /** Includes legacy completed cases that never ran the deactivation step. */
    @Query("""
            select o.id from EmployeeOffboarding o
            where o.employeeDeactivatedAt is null
              and (o.status = :completed or o.exitDate <= :date)
            """)
    List<Long> findPendingDeactivationIds(@Param("date") LocalDate date,
            @Param("completed") EmployeeOffboarding.OffboardingStatus completed);
}
