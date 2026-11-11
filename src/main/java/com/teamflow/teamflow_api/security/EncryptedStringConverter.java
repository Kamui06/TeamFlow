package com.teamflow.teamflow_api.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return FieldCipher.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return FieldCipher.decrypt(dbData);
    }
}