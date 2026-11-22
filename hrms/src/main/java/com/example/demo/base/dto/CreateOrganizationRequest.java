package com.example.demo.base.dto;

import com.example.demo.base.enums.SubscriptionPlan;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import lombok.Getter;
import lombok.Setter;

/**
 * Unified request for creating a new client organization + its Head Office in one shot.
 *
 * Org fields:         name, contactEmail, contactPhone, subscriptionPlan, maxBranches
 * Head Office fields: headOfficeName, address, city, state, country, zip, phone, email,
 *                     website, taxId, registrationNumber, branchLimit
 * Admin credentials:  adminUsername, adminEmail, adminPassword, adminFirstName, adminLastName
 */
@Getter
@Setter
public class CreateOrganizationRequest {

    // --- Organization fields ---

    @NotBlank
    private String name;                  // Organization name, e.g. "Acme Corp"

    private String slug;                  // Auto-generated if omitted

    @Email(message = "Enter a valid organization contact email")
    private String contactEmail;
    private String contactPhone;

    private SubscriptionPlan subscriptionPlan;  // Defaults to STANDARD if omitted
    private Integer maxBranches;               // Defaults to 5 if omitted

    // --- Head Office fields ---

    private String headOfficeName;        // Defaults to org name if omitted

    private String address;
    private String city;
    private String state;
    private String country;
    private String zip;
    private String phone;
    @Email(message = "Enter a valid head office email")
    private String email;
    private String website;
    private String taxId;
    private String registrationNumber;
    private Integer branchLimit;          // Defaults to 5 if omitted

    // --- First enterprise administrator ---

    @NotBlank(message = "Admin login username is required")
    private String adminUsername;
    @NotBlank(message = "Admin work email is required")
    @Email(message = "Enter a valid admin work email")
    private String adminEmail;
    @NotBlank(message = "Initial admin password is required")
    private String adminPassword;
    private String adminFirstName;
    private String adminLastName;
}
