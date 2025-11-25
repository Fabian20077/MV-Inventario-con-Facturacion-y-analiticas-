# 🚀 Instrucciones de Instalación - MV Inventario

## Para tu amigo que está instalando el proyecto

### ✅ Pasos a seguir:

1. **Clonar el repositorio** (si aún no lo ha hecho)
   ```bash
   git clone <url-del-repositorio>
   cd inventario-ropa
   ```

2. **Iniciar Docker**
   ```bash
   docker-compose up -d
   ```

3. **⚠️ PASO CRÍTICO - Configurar la contraseña del admin**
   
   Después de que Docker esté corriendo, **DEBES** ejecutar este comando:
   ```bash
   node set-password.mjs
   ```
   
   Este script configura la contraseña del usuario administrador en la base de datos.

4. **Acceder a la aplicación**
   
   Abre tu navegador y ve a: `http://localhost:8081/login.html`

5. **Iniciar sesión con estas credenciales:**

   | Campo | Valor |
   |-------|-------|
   | **Email** | `admin@mv.com` |
   | **Contraseña** | `admin123` |

---

## ❌ Problemas Comunes

### "Contraseña incorrecta" o "Usuario no encontrado"

**Causa:** No ejecutaste el script `set-password.mjs` después de iniciar Docker.

**Solución:**
```bash
node set-password.mjs
```

Luego intenta iniciar sesión nuevamente con:
- Email: `admin@mv.com`
- Contraseña: `admin123`

---

### Error "Cannot find module"

**Solución:**
```bash
npm install
```

---

### Puertos ocupados

**Solución:**
```bash
docker-compose down
docker-compose up -d
```

---

## 📝 Notas Importantes

- El email es `admin@mv.com` (NO `admin@inventario.com`)
- La contraseña es `admin123`
- **SIEMPRE** ejecuta `node set-password.mjs` después del primer inicio de Docker
- Si cambias la base de datos o reinicias los contenedores con `docker-compose down -v`, necesitarás ejecutar `set-password.mjs` nuevamente

---

## 🆘 ¿Aún no funciona?

Verifica que Docker esté corriendo:
```bash
docker-compose ps
```

Deberías ver 3 contenedores activos:
- `mv-inventario-api` (Backend)
- `inventario-db` (MySQL)
- `mv-inventario-frontend` (Frontend)

Si alguno no está corriendo, reinicia:
```bash
docker-compose restart
```
