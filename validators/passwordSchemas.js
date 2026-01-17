import { z } from 'zod';

// Schema simplificado para reset password - solo requiere 6+ caracteres
export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token es requerido'),
    newPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});

export const forgotPasswordSchema = z.object({
    email: z.string().min(1, 'Email es requerido').email('Email inválido')
});
