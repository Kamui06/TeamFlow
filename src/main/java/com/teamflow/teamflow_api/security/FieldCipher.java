package com.teamflow.teamflow_api.security;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicReference;

/*
    AES-256-GCM field encryption. Stored values look like "enc:v1:" followed by
    base64. Values without the prefix are legacy plaintext
    and are returned unchanged when read.
*/
public final class FieldCipher {

    static final String PREFIX = "enc:v1:";
    private static final String ENV_KEY = "TEAMFLOW_ENCRYPTION_KEY";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final AtomicReference<SecretKeySpec> key = new AtomicReference<>();

    private FieldCipher() {
    }

    public static boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    public static String encrypt(String plain) {
        if (plain == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            byte[] body = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] combined = ByteBuffer.allocate(iv.length + body.length).put(iv).put(body).array();
            return PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt value", e);
        }
    }

    public static String decrypt(String stored) {
        if (!isEncrypted(stored)) {
            return stored;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            byte[] iv = Arrays.copyOfRange(combined, 0, IV_BYTES);
            byte[] body = Arrays.copyOfRange(combined, IV_BYTES, combined.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(body), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Could not decrypt value. Check TEAMFLOW_ENCRYPTION_KEY", e);
        }
    }

    private static SecretKeySpec key() {
        SecretKeySpec current = key.get();
        if (current != null) {
            return current;
        }
        String raw = System.getenv(ENV_KEY);
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException(ENV_KEY + " is not set");
        }
        byte[] bytes = Base64.getDecoder().decode(raw.trim());
        if (bytes.length != 32) {
            throw new IllegalStateException(ENV_KEY + " must decode to 32 bytes");
        }
        SecretKeySpec initialized = new SecretKeySpec(bytes, "AES");
        key.compareAndSet(null, initialized);
        return key.get();
    }
}