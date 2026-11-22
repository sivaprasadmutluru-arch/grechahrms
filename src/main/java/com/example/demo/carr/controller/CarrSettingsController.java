package com.example.demo.carr.controller;
import com.example.demo.carr.service.CarrSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
@RestController @RequestMapping("/api/carr/settings") @RequiredArgsConstructor @PreAuthorize("isAuthenticated()")
public class CarrSettingsController {
    private final CarrSettingsService service;
    @GetMapping public CarrSettingsService.View get(){return service.view();}
    @PutMapping public CarrSettingsService.View save(@Valid @RequestBody CarrSettingsService.Change change,Authentication auth){return service.save(change,auth);}
    @ExceptionHandler(ResponseStatusException.class) public ResponseEntity<?> error(ResponseStatusException ex){return ResponseEntity.status(ex.getStatusCode()).body(Map.of("message",ex.getReason()));}
    @ExceptionHandler({org.springframework.dao.OptimisticLockingFailureException.class,org.springframework.dao.DataIntegrityViolationException.class}) public ResponseEntity<?> conflict(Exception ex){return ResponseEntity.status(409).body(Map.of("message","Settings changed; reload before saving"));}
}
