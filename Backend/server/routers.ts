import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

// Middleware para verificar que el usuario sea admin
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Se requieren permisos de administrador' });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============ CATEGORÍAS ============
  categorias: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCategorias();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const categoria = await db.getCategoriaById(input.id);
        if (!categoria) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Categoría no encontrada' });
        }
        return categoria;
      }),

    create: protectedProcedure
      .input(z.object({
        nombre: z.string().min(1, 'El nombre es requerido').max(100),
        descripcion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createCategoria(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).max(100).optional(),
        descripcion: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCategoria(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteCategoria(input.id);
          return { success: true };
        } catch (error) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'No se puede eliminar la categoría. Puede tener productos asociados.' 
          });
        }
      }),
  }),

  // ============ PRODUCTOS ============
  productos: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProductos();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const producto = await db.getProductoById(input.id);
        if (!producto) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Producto no encontrado' });
        }
        return producto;
      }),

    create: protectedProcedure
      .input(z.object({
        sku: z.string().min(1, 'El SKU es requerido').max(50),
        nombre: z.string().min(1, 'El nombre es requerido').max(200),
        descripcion: z.string().optional(),
        precioVenta: z.number().int().positive('El precio debe ser mayor a 0'),
        stockActual: z.number().int().nonnegative('El stock no puede ser negativo').default(0),
        categoriaId: z.number().int().positive('Debe seleccionar una categoría'),
      }))
      .mutation(async ({ input }) => {
        // Verificar que el SKU no exista
        const existente = await db.getProductoBySku(input.sku);
        if (existente) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El SKU ya existe' });
        }

        // Verificar que la categoría exista
        const categoria = await db.getCategoriaById(input.categoriaId);
        if (!categoria) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'La categoría no existe' });
        }

        await db.createProducto(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        sku: z.string().min(1).max(50).optional(),
        nombre: z.string().min(1).max(200).optional(),
        descripcion: z.string().optional(),
        precioVenta: z.number().int().positive().optional(),
        categoriaId: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, sku, categoriaId, ...data } = input;

        // Verificar que el producto exista
        const producto = await db.getProductoById(id);
        if (!producto) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Producto no encontrado' });
        }

        // Si se cambia el SKU, verificar que no exista
        if (sku && sku !== producto.sku) {
          const existente = await db.getProductoBySku(sku);
          if (existente) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'El SKU ya existe' });
          }
        }

        // Si se cambia la categoría, verificar que exista
        if (categoriaId) {
          const categoria = await db.getCategoriaById(categoriaId);
          if (!categoria) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'La categoría no existe' });
          }
        }

        await db.updateProducto(id, { sku, categoriaId, ...data });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          await db.deleteProducto(input.id);
          return { success: true };
        } catch (error) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: 'No se puede eliminar el producto. Puede tener movimientos asociados.' 
          });
        }
      }),
  }),

  // ============ MOVIMIENTOS DE INVENTARIO ============
  movimientos: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllMovimientos();
    }),

    byProducto: protectedProcedure
      .input(z.object({ productoId: z.number() }))
      .query(async ({ input }) => {
        return await db.getMovimientosByProducto(input.productoId);
      }),

    registrar: protectedProcedure
      .input(z.object({
        productoId: z.number().int().positive(),
        tipo: z.enum(['entrada', 'salida']),
        cantidad: z.number().int().positive('La cantidad debe ser mayor a 0'),
        motivo: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verificar que el producto exista
        const producto = await db.getProductoById(input.productoId);
        if (!producto) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Producto no encontrado' });
        }

        // Si es salida, verificar que haya stock suficiente
        if (input.tipo === 'salida') {
          if (producto.stockActual < input.cantidad) {
            throw new TRPCError({ 
              code: 'BAD_REQUEST', 
              message: `Stock insuficiente. Stock actual: ${producto.stockActual}` 
            });
          }
        }

        // Registrar el movimiento
        await db.createMovimiento({
          productoId: input.productoId,
          tipo: input.tipo,
          cantidad: input.cantidad,
          motivo: input.motivo,
          usuarioId: ctx.user.id,
        });

        // Actualizar el stock del producto
        const cantidadConSigno = input.tipo === 'entrada' ? input.cantidad : -input.cantidad;
        await db.updateStockProducto(input.productoId, cantidadConSigno);

        return { success: true };
      }),
  }),

  // ============ USUARIOS (Solo Admin) ============
  usuarios: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        activo: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.id, input.activo);
        return { success: true };
      }),

    updateRole: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(['user', 'admin']),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.id, input.role);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
