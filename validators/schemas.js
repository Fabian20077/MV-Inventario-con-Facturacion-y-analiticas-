﻿import { z } from 'zod';

// ========================
// SCHEMAS DE AUTENTICACIÓN
// ========================

export const loginSchema = z.object({
    email: z.string()
        .min(1, 'Email es requerido')
        .email('Email inválido'),
    password: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/[0-9]/, 'Debe contener al menos un número')
});

export const registerSchema = z.object({
    nombre: z.string()
        .min(2, 'Nombre debe tener al menos 2 caracteres')
        .max(100, 'Nombre muy largo'),
    correo: z.string()
        .min(1, 'Correo es requerido')
        .email('Correo inválido'),
    password: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
        .regex(/[a-z]/, 'Debe contener al menos una minúscula')
        .regex(/[0-9]/, 'Debe contener al menos un número'),
    rol_id: z.number()
        .int('Rol inválido')
        .positive('Rol es requerido')
        .default(3)
});

// ========================
// SCHEMAS DE PRODUCTOS
// ========================

export const createProductSchema = z.object({
    codigo: z.string()
        .min(1, 'Código es requerido')
        .max(50, 'Código muy largo'),
    nombre: z.string()
        .min(1, 'Nombre es requerido')
        .max(200, 'Nombre muy largo'),
    descripcion: z.string()
        .max(1000, 'Descripción muy larga')
        .optional()
        .nullable(),
    precio_compra: z.number()
        .positive('Precio de compra debe ser positivo'),
    precio_venta: z.number()
        .positive('Precio de venta debe ser positivo'),
    cantidad: z.number()
        .int('Cantidad debe ser un número entero')
        .nonnegative('Cantidad no puede ser negativa'),
    stock_minimo: z.number()
        .int('Stock mínimo debe ser un número entero')
        .positive('Stock mínimo debe ser positivo')
        .default(10),
    ubicacion: z.string()
        .max(100, 'Ubicación muy larga')
        .optional()
        .nullable(),
    id_categoria: z.number()
        .int('Categoría inválida')
        .positive('Categoría es requerida')
        .optional(),
    categoria_nombre: z.string()
        .min(2, 'Nombre de categoría debe tener al menos 2 caracteres')
        .max(100, 'Nombre de categoría muy largo')
        .optional(),
    fecha_vencimiento: z.string()
        .optional()
        .nullable()
}).refine(
    data => data.precio_venta >= data.precio_compra,
    {
        message: 'Precio de venta debe ser mayor o igual al precio de compra',
        path: ['precio_venta']
    }
).refine(
    data => data.id_categoria || data.categoria_nombre,
    {
        message: 'Debe proporcionar id_categoria o categoria_nombre',
        path: ['id_categoria']
    }
);

export const updateProductSchema = z.object({
    codigo: z.string()
        .min(1, 'Código es requerido')
        .max(50, 'Código muy largo')
        .optional(),
    nombre: z.string()
        .min(1, 'Nombre es requerido')
        .max(200, 'Nombre muy largo')
        .optional(),
    descripcion: z.string()
        .max(1000, 'Descripción muy larga')
        .optional()
        .nullable(),
    precio_compra: z.number()
        .positive('Precio de compra debe ser positivo')
        .optional(),
    precio_venta: z.number()
        .positive('Precio de venta debe ser positivo')
        .optional(),
    cantidad: z.number()
        .int('Cantidad debe ser un número entero')
        .nonnegative('Cantidad no puede ser negativa')
        .optional(),
    stock_minimo: z.number()
        .int('Stock mínimo debe ser un número entero')
        .positive('Stock mínimo debe ser positivo')
        .optional(),
    ubicacion: z.string()
        .max(100, 'Ubicación muy larga')
        .optional()
        .nullable(),
    id_categoria: z.number()
        .int('Categoría inválida')
        .positive('Categoría es requerida')
        .optional(),
    categoria_nombre: z.string()
        .min(2, 'Nombre de categoría debe tener al menos 2 caracteres')
        .max(100, 'Nombre de categoría muy largo')
        .optional(),
    fecha_vencimiento: z.string()
        .optional()
        .nullable()
}).refine(
    data => {
        if (data.precio_venta !== undefined && data.precio_compra !== undefined) {
            return data.precio_venta >= data.precio_compra;
        }
        return true;
    },
    {
        message: 'Precio de venta debe ser mayor o igual al precio de compra',
        path: ['precio_venta']
    }
);

export const movementSchema = z.object({
    id_producto: z.number()
        .int('Producto inválido')
        .positive('Producto es requerido'),
    cantidad: z.number()
        .int('Cantidad debe ser un número entero')
        .positive('Cantidad debe ser mayor a 0'),
    motivo: z.string()
        .min(1, 'Motivo es requerido')
        .max(200, 'Motivo muy largo'),
    usuario_id: z.number()
        .int('Usuario inválido')
        .positive('Usuario es requerido')
});

export const createCategorySchema = z.object({
    nombre: z.string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(50, 'El nombre no puede exceder 50 caracteres')
        .trim()
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Email inválido')
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token es requerido'),
    newPassword: z.string()
        .min(8, 'La contraseña debe tener al menos 8 caracteres')
        .regex(/[0-9]/, 'Debe contener al menos un número')
});
