import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, categorias, productos, movimientos, InsertCategoria, InsertProducto, InsertMovimiento } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["nombre", "correo", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ CATEGORÍAS ============

export async function getAllCategorias() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(categorias).orderBy(categorias.nombre);
}

export async function getCategoriaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(categorias).where(eq(categorias.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCategoria(data: InsertCategoria) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categorias).values(data);
  return result;
}

export async function updateCategoria(id: number, data: Partial<InsertCategoria>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categorias).set(data).where(eq(categorias.id, id));
}

export async function deleteCategoria(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(categorias).where(eq(categorias.id, id));
}

// ============ PRODUCTOS ============

export async function getAllProductos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productos).orderBy(desc(productos.createdAt));
}

export async function getProductoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productos).where(eq(productos.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProductoBySku(sku: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productos).where(eq(productos.sku, sku)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProducto(data: InsertProducto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productos).values(data);
  return result;
}

export async function updateProducto(id: number, data: Partial<InsertProducto>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productos).set(data).where(eq(productos.id, id));
}

export async function deleteProducto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productos).where(eq(productos.id, id));
}

export async function updateStockProducto(id: number, cantidad: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productos)
    .set({ stockActual: sql`${productos.stockActual} + ${cantidad}` })
    .where(eq(productos.id, id));
}

// ============ MOVIMIENTOS ============

export async function getAllMovimientos() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(movimientos).orderBy(desc(movimientos.fechaMovimiento));
}

export async function getMovimientosByProducto(productoId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(movimientos)
    .where(eq(movimientos.productoId, productoId))
    .orderBy(desc(movimientos.fechaMovimiento));
}

export async function createMovimiento(data: InsertMovimiento) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(movimientos).values(data);
  return result;
}

// ============ USUARIOS ============

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserStatus(id: number, activo: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ activo }).where(eq(users.id, id));
}

export async function updateUserRole(id: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}
