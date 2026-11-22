package com.example.demo.auth.service;

import com.example.demo.auth.entity.User;
import com.example.demo.auth.repository.UserRepository;
import com.example.demo.base.service.WorkspaceWelcomeEmail;
import com.example.demo.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkspaceSetupPasswordTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final AuthService service = new AuthService(null, users, null, null, null, null, encoder, null, null, null);

    @Test
    void consumesInvitationTokenAndClearsStoredHash() {
        String token = "example-invitation-token";
        String hash = WorkspaceWelcomeEmail.tokenHash(token);
        User user = new User();
        user.setResetToken(hash);
        user.setResetTokenExpiry(LocalDateTime.now().plusHours(1));
        when(users.findByResetToken(hash)).thenReturn(Optional.of(user));
        when(encoder.encode("new-test-password")).thenReturn("encoded");
        service.resetPassword(token, "new-test-password");
        assertEquals("encoded", user.getPassword());
        assertNull(user.getResetToken());
        assertNull(user.getResetTokenExpiry());
        verify(users).save(user);
        verify(users, never()).findByResetToken(token);
    }

    @Test
    void storedInvitationHashCannotBeUsedAsPasswordResetToken() {
        String hash = WorkspaceWelcomeEmail.tokenHash("example");
        assertThrows(BadRequestException.class, () -> service.resetPassword(hash, "new-test-password"));
        verify(users, never()).findByResetToken(hash);
        verifyNoInteractions(encoder);
    }

    @Test
    void existingPasswordResetLinksStillWork() {
        User user = new User();
        user.setResetTokenExpiry(LocalDateTime.now().plusMinutes(5));
        when(users.findByResetToken("legacy-token")).thenReturn(Optional.of(user));
        service.resetPassword("legacy-token", "new-test-password");
        verify(users).save(user);
    }
}
