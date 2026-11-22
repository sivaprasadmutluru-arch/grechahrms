package com.example.demo.carr.controller;
import com.example.demo.carr.dto.CarrCreationDtos.*;
import com.example.demo.carr.dto.CarrDtos.KpiRequest;
import com.example.demo.carr.service.CarrCreationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/carr") @RequiredArgsConstructor @PreAuthorize("isAuthenticated()")
public class CarrCreationController {
    private final CarrCreationService service;
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public org.springframework.http.ResponseEntity<java.util.Map<String,Object>> error(org.springframework.web.server.ResponseStatusException ex){return org.springframework.http.ResponseEntity.status(ex.getStatusCode()).body(java.util.Map.of("status",ex.getStatusCode().value(),"message",ex.getReason()==null?"Unable to complete CAR setup":ex.getReason()));}
    @GetMapping("/creation-context") public Context context(Authentication auth){return service.context(auth);}
    @GetMapping("/role-drafts") public List<RoleDraft> drafts(Authentication auth){return service.drafts(auth);}
    @PostMapping("/role-drafts") public RoleDraft create(@Valid @RequestBody RoleDefinition body,Authentication auth){return service.save(null,body,auth);}
    @PutMapping("/role-drafts/{id}") public RoleDraft update(@PathVariable Long id,@Valid @RequestBody RoleDefinition body,Authentication auth){return service.save(id,body,auth);}
    @PostMapping("/role-kpi-suggestions") public List<KpiRequest> suggest(@Valid @RequestBody RoleSuggestion body,Authentication auth){return service.suggest(body,auth);}
}
