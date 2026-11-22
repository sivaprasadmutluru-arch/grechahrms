package com.example.demo.carr.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Public, company-keyed configuration: never shared through browser storage. */
@Entity @Table(name="carr_company_settings",schema="public") @Getter @Setter
public class CarrCompanySettings {
    @Id @Column(name="company_id") private Long companyId;
    @Column(name="review_frequency",nullable=false,length=30) private String reviewFrequency="Quarterly";
    @Version @Column(nullable=false) private Long version;
}
