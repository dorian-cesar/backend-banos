# Backend para Mantenedor de Baños


Este proyecto corresponde a un backend desarrollado con Node.js, Express y MySQL para la gestión de:

- Cajas
- Aperturas y cierres de caja
- Servicios
- Movimientos (ingresos y egresos)
- Usuarios (con autenticación y roles)

> **Características técnicas**:  
> - Autenticación JWT  
> - Paginación y búsqueda avanzada  
> - Validaciones de integridad referencial 

---

## Índice
- [1. Autenticacion (`/auth`)](#1-autenticacion-auth)
- [2. Usuarios (`/users`)](#2-usuarios-users)
- [3. Servicios (`/services`)](#3-servicios-services)
- [4. Movimientos (`/movimientos`)](#4-movimientos-movimientos)
- [5. Cajas (`/cajas`)](#5-cajas-cajas)
- [6. Aperturas y Cierres (`/aperturas-cierres`)](#6-aperturas-y-cierres-aperturas-cierres)
- [7. Helpers (`/helpers`)](#7-helpers-helpers)

---

## Configuración mínima
```bash
# Variables de entorno requeridas (.env)
PORT=puerto
CORS_ORIGIN=origen
JWT_SECRET=clave
DB_HOST=localhost
DB_USER=usuario
DB_PASSWORD=contraseña
DB_NAME=basedatos
```

---

## Base URL
```
http://localhost:4000/api
```

---

## Autenticación
Incluir el token en headers para rutas protegidas:
```http
Authorization: Bearer <token_jwt>
```
Respuestas de error:
| Código | Descripción |
| --- | --- |
| 400	| Validación de datos |
| 401	| No autenticado |
| 403	| Permisos insuficientes |
| 404	| Recurso no encontrado |

---

## Endpoints

### 1. Autenticacion (`/auth`)
| Método | Endpoint              | Descripción                  | Requiere Token |
| ------ | ----------------- | ---------------------------- | ----- |
| POST   | `/auth/login` | Login con email y contraseña | No |

Ejemplo De Autenticación: 
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "correo@ejemplo.com",
  "password": "123456"
}
```
Respuesta:
```json
{
    "message": "Login exitoso",
    "token": "...",
    "user": {
        "id": 5,
        "username": "ejemplo",
        "email": "correo@ejemplo.com",
        "role": "admin"
    }
}
```
Respuestas de error: 

| Código | Respuesta                                                                    | Descripción                                                |
| ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 400    | `{ "error": "Email y contraseña son requeridos" }`                           | No se enviaron ambos campos en el body de la solicitud.    |
| 401    | `{ "error": "Credenciales inválidas" }`                                      | Email no encontrado o contraseña incorrecta.               |
| 403    | `{ "error": "Acceso denegado: solo administradores pueden iniciar sesión" }` | Usuario existe pero no tiene rol `admin`.                  |
| 500    | `{ "error": "Error interno del servidor" }`                                  | Cualquier error inesperado en el backend durante el login. |


---

### 2. Usuarios (`/users`)
| Método | Endpoint     | Descripción                  | Requiere Token |
| ------ | ------------ | ---------------------------- | -------------- |
| GET    | `/users`     | Obtener todos los usuarios (con paginación y búsqueda opcional)  | Sí |
| GET    | `/users/:id` | Obtener usuario por ID       | Sí |
| GET    | `/users/roles` | Obtener roles únicos  | Sí |
| POST   | `/users`     | Crear nuevo usuario          | Sí |
| PUT    | `/users/:id` | Actualizar usuario existente | Sí |
| DELETE | `/users/:id` | Eliminar usuario             | Sí |

1. Ejemplo obtener usuarios: 
    ```http
    GET /api/users?page=1&pageSize=10&search=admin
    ```
    Parámetros opcionales (query):
    - `page` → Número de página (por defecto `1`)
    - `pageSize` → Cantidad de resultados por página (por defecto `10`)
    - `search` → Cadena de texto para buscar por `username`, `email` o `role`

    Respuesta:
    ```json
    {
        "total": 25,
        "page": 1,
        "pageSize": 10,
        "data": [
            {
                "id": 5,  
                "username": "ejemplo",
                "email": "correo@ejemplo.com",
                "role": "admin"
            }
        ]
    }

    ```

2. Ejemplo obtener usuario por ID:
    ```http
    GET /api/users/5
    ```
    Respuesta:
    ```json
    {
      "id": 5,
      "username": "ejemplo",
      "email": "correo@ejemplo.com",
      "role": "admin"
    }
    ```

3. Ejemplo obtener roles:
    ```http
    GET /api/users/roles
    ```
    Respuesta:
    ```json
    [
      "admin",
      "cajero"
    ]
    ```

4. Ejemplo crear usuario:
    ```http
    POST /api/users
    Content-Type: application/json

    {
      "username": "juanperez",
      "email": "juan@example.com",
      "password": "123456",
      "role": "cajero"
    }
    ```
    Respuesta: 
    ```json
      {
        "message": "Usuario creado",
        "id": 8
      }
    ```

5. Ejemplo actualizar usuario:
    ```http
    PUT /api/users/8
    Content-Type: application/json

    {
      "username": "juanperez2",
      "email": "juan2@example.com",
      "role": "admin",
      "password": "nuevaclave"
    }
    ```
    Notas:
    - `password` es opcional.
    - Si no se envía, la contraseña no se modifica.

    Respuesta:
    ```json
    {
      "message": "Usuario actualizado"
    }
    ```

6. Ejemplo eliminar usuario:
    ```http
    DELETE /api/users/8
    ```
    Respuesta:
    ```json
    {
      "message": "Usuario eliminado correctamente"
    }
    ```

Respuestas de error: 

| Código | Respuesta                                                                         | Descripción                                                                           |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 400    | `{ "error": "Todos los campos son requeridos" }`                                  | No se enviaron todos los campos obligatorios al crear un usuario.                     |
| 400    | `{ "error": "username, email y role son requeridos" }`                            | No se enviaron los campos obligatorios al actualizar un usuario.                      |
| 400    | `{ "error": "Email inválido" }`                                                   | Email no cumple formato válido.                                                       |
| 400    | `{ "error": "La contraseña debe tener al menos 6 caracteres" }`                   | Contraseña demasiado corta al crear usuario.                                          |
| 400    | `{ "error": "La contraseña debe tener al menos 6 caracteres si se proporciona" }` | Contraseña demasiado corta al actualizar usuario (si se proporciona).                 |
| 404    | `{ "error": "Usuario no encontrado" }`                                            | Usuario no existe en la base de datos (al obtener o actualizar).                      |
| 409    | `{ "error": "El email ya está en uso" }`                                          | Email ya registrado al crear un usuario.                                              |
| 409    | `{ "error": "El email ya está en uso por otro usuario" }`                         | Email ya registrado por otro usuario al actualizar.                                   |
| 500    | `{ "error": "Error interno del servidor" }`                                       | Cualquier error inesperado en el backend al obtener, crear o actualizar usuarios.     |
| 500    | `{ "error": <mensaje de error de MySQL> }`                                        | Error inesperado al eliminar usuario (puede devolver directamente el error de MySQL). |
| 404    | `{ "message": "Usuario no encontrado" }`                                          | Intento de eliminar un usuario que no existe.                                         |


---

### 3. Servicios (`/services`)
| Método | Endpoint         | Descripción                   | Requiere Token |
| ------ | ---------------- | ----------------------------- | -------------- |
| GET    | `/services`     | Listar todos los servicios (con paginación y búsqueda opcional)   | Sí |
| GET    | `/services/tipo`     | 	Listar tipos únicos de servicio   | Sí |
| GET    | `/services/:id` | Obtener servicio por ID       | Sí |
| POST   | `/services`     | Crear nuevo servicio          | Sí |
| PUT    | `/services/:id` | Actualizar servicio existente | Sí |
| DELETE | `/services/:id` | Eliminar servicio             | Sí |

1. Ejemplo listar servicios:
    ```http
    GET /api/services?page=1&pageSize=10&search=baño
    ```
    Respuesta:
    ```json
    {
      "total": 1,
      "page": 1,
      "pageSize": 10,
      "data": [
        {
          "id": 1,
          "nombre": "Baño estándar",
          "tipo": "BAÑO",
          "precio": "500.00",
          "descripcion": null,
          "estado": "activo"
        }
      ]
    }
    ```

2. Ejemplo listar tipos únicos:
    ```http
    GET /api/services/tipo
    ```
    Respuesta:
    ```json
    [
      "BAÑO",
      "DUCHA"
    ]
    ```
  
3. Ejemplo obtener servicio por ID:
    ```http
    GET /api/services/1
    ```
    Respuesta:
    ```json
    {
      "id": 1,
      "nombre": "Baño estándar",
      "tipo": "BAÑO",
      "precio": "500.00",
      "descripcion": null,
      "estado": "activo"
    }
    ```

4. Ejemplo crear nuevo servicio:
    ```http
    POST /api/services
    Content-Type: application/json

    {
      "nombre": "Baño premium",
      "tipo": "BAÑO",
      "precio": 5000.00,
      "descripcion": "Baño para uso premium",
      "estado": "activo"
    }
    ```
    Respuesta:
    ```json
    {
      "id": 8,
      "nombre": "Baño premium",
      "tipo": "BAÑO",
      "precio": 5000,
      "descripcion": "Baño para uso premium",
      "estado": "activo"
    }
    ```
  
5. Ejemplo actualizar servicio: 
    ```http
    PUT /api/services/8
    Content-Type: application/json

    {
      "nombre": "Baño VIP",
      "tipo": "BAÑO",
      "precio": 3000.00,
      "descripcion": "Baño con ducha incluida",
      "estado": "activo"
    }
    ```
    Respuesta:
    ```json
    {
      "message": "Servicio actualizado correctamente"
    }
    ```
6. Ejemplo eliminar servicio:
    ```http
    DELETE /api/services/8
    ```
    Respuesta:
    ```json
    {
        "message": "Servicio eliminado correctamente"
    }
    ```
Respuestas de error: 
| Código | Respuesta                                             | Descripción                                                  |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------ |
| 400    | `{ "error": "nombre, tipo y precio son requeridos" }` | Faltan campos obligatorios al crear un servicio.             |
| 404    | `{ "message": "Servicio no encontrado" }`             | Servicio no existe al obtener, actualizar o eliminar por ID. |
| 500    | `{ "error": <mensaje de error de MySQL> }`            | Error interno del servidor o en la base de datos.            |


---

### 4. Movimientos (`/movimientos`)
| Método | Endpoint           | Descripción                     | Requiere Token |
| ------ | ------------------ | ------------------------------- | --------- |
| GET    | `/movimientos`     | Listar todos los movimientos (con filtros, paginación y búsqueda)   | Sí |
| GET    | `/movimientos/:id` | Obtener movimiento por ID       | Sí |
| POST   | `/movimientos`     | Crear nuevo movimiento          | Sí |
| PUT    | `/movimientos/:id` | Actualizar movimiento existente | Sí |
| DELETE | `/movimientos/:id` | Eliminar movimiento             | Sí |

1. Ejemplo listar movimientos:
    ```http
    GET /api/movimientos?page=1&pageSize=10&search=efectivo&id_usuario=2&numero_caja=1&fecha_inicio=2025-07-01&fecha_fin=2025-07-31
    ```
    Parámetros opcionales (query):
    - `page` → Número de página (por defecto `1`)
    - `pageSize` → Cantidad de resultados por página (por defecto `10`)
    - `search` → Texto para búsqueda global (`username`, `servicio`, `caja`, `medio_pago`, `numero_caja`, `codigo`)
    - `id_usuario` → Filtrar por usuario
    - `numero_caja` → Filtrar por número de caja
    - `id_servicio` → Filtrar por servicio
    - `medio_pago` → Filtrar por medio de pago
    - `fecha_inicio` → Filtrar desde esta fecha
    - `fecha_fin` → Filtrar hasta esta fecha

    Respuesta:
    ```json
    {
        "total": 4,
        "page": 1,
        "pageSize": 10,
        "data": [
            {
                "id": 53,
                "id_aperturas_cierres": 18,
                "id_usuario": 2,
                "id_servicio": 2,
                "numero_caja": 10,
                "monto": "5000.00",
                "medio_pago": "EFECTIVO",
                "fecha": "2025-07-22T04:00:00.000Z",
                "hora": "12:05:55",
                "codigo": "1234567890",
                "nombre_usuario": "ejemplo",
                "nombre_servicio": "Ducha básica",
                "nombre_caja": "Caja ejemplo"
            }
        ]
    }
    ```
2. Ejemplo obtener movimiento por ID:
    ```http
    GET /api/movimientos/53
    ```
    Respuesta:
    ```json
    {
      "id": 53,
      "id_aperturas_cierres": 18,
      "id_usuario": 2,
      "id_servicio": 2,
      "numero_caja": 10,
      "monto": "5000.00",
      "medio_pago": "EFECTIVO",
      "fecha": "2025-07-22T04:00:00.000Z",
      "hora": "12:05:55",
      "codigo": "1234567890"
    }
    ```
3. Ejemplo crear nuevo movimiento:
    ```http
    POST /api/movimientos
    Content-Type: application/json

    {
      "id_aperturas_cierres": 12,
      "id_usuario": 2,
      "id_servicio": 2,
      "numero_caja": 1,
      "monto": 2000.00,
      "medio_pago": "EFECTIVO",
      "fecha": "2025-07-28",
      "hora": "14:30:00",
      "codigo": "ABC123"
    }
    ```
    Respuesta:
    ```json
    {
      "id": 59,
      "id_aperturas_cierres": 12,
      "id_usuario": 2,
      "id_servicio": 2,
      "numero_caja": 1,
      "monto": 2000,
      "medio_pago": "EFECTIVO",
      "fecha": "2025-07-28",
      "hora": "14:30:00",
      "codigo": "ABC123"
    }
    ```
4. Ejemplo actualizar movimiento:
    ```http
    PUT /api/movimientos/59
    Content-Type: application/json

    {
      "id_aperturas_cierres": 12,
      "id_usuario": 2,
      "id_servicio": 2,
      "numero_caja": 1,
      "monto": 2500.00,
      "medio_pago": "TARJETA",
      "fecha": "2025-07-29",
      "hora": "15:00:00",
      "codigo": "XYZ789"
    }
    ```
    Respuesta:
    ```json
    {
      "message": "Movimiento actualizado correctamente"
    }
    ```
5. Ejemplo eliminar movimiento:
    ```http
    DELETE /api/movimientos/59
    ```
    Respuesta:
    ```json
    {
      "message": "Movimiento eliminado correctamente"
    }
    ```
Respuestas de error:
| Código | Respuesta                                                            | Descripción                                                                        |
| ------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 400    | `{ "error": "Todos los campos obligatorios deben estar presentes" }` | Falta algún campo requerido al crear o actualizar un movimiento.                   |
| 400    | `{ "error": "Monto debe ser un número positivo" }`                   | El monto no es válido (no numérico o ≤ 0).                                         |
| 400    | `{ "error": "id_aperturas_cierres no existe" }`                      | La clave foránea `id_aperturas_cierres` no existe en la tabla `aperturas_cierres`. |
| 400    | `{ "error": "id_usuario no existe" }`                                | La clave foránea `id_usuario` no existe en la tabla `users`.                       |
| 400    | `{ "error": "id_servicio no existe" }`                               | La clave foránea `id_servicio` no existe en la tabla `servicios`.                  |
| 400    | `{ "error": "numero_caja no existe" }`                               | La clave foránea `numero_caja` no existe en la tabla `cajas`.                      |
| 404    | `{ "message": "Movimiento no encontrado" }`                          | No se encontró el movimiento al obtener, actualizar o eliminar por ID.             |
| 500    | `{ "error": <mensaje de error de MySQL> }`                           | Error interno del servidor o en la base de datos.                                  |


---

### 5. Cajas (`/cajas`)
| Método | Endpoint     | Descripción               | Requiere Token |
| ------ | ------------ | ------------------------- | ----------- |
| GET    | `/cajas`     | Listar todas las cajas (con paginación y búsqueda opcional)   | Sí |
| GET    | `/cajas/:id` | Obtener caja por ID       | Sí |
| POST   | `/cajas`     | Crear nueva caja          | Sí |
| PUT    | `/cajas/:id` | Actualizar caja existente | Sí |
| DELETE | `/cajas/:id` | Eliminar caja             | Sí |

1. Ejemplo listar cajas:
    ```http
    GET /api/cajas?page=1&pageSize=10&search=principal
    ```
    Parámetros opcionales (query):
    - `page` → Número de página (por defecto `1`)
    - `pageSize` → Cantidad de resultados por página (por defecto `10`)
    - `search` → Búsqueda por `nombre` o `numero_caja` (case-insensitive)

    Respuesta:
    ```json
    {
      "total": 5,
      "page": 1,
      "pageSize": 10,
      "data": [
          {
              "id": 1,
              "numero_caja": 1,
              "nombre": "Caja Principal",
              "ubicacion": "Entrada principal",
              "estado": "activa",
              "descripcion": null
          }
        ]
    }
    ```

2. Ejemplo obtener caja por ID:
    ```http
    GET /api/cajas/1
    ```
    Respuesta:
    ```json
    {
        "id": 1,
        "numero_caja": 1,
        "nombre": "Caja Principal",
        "ubicacion": "Entrada principal",
        "estado": "activa",
        "descripcion": null
    }
    ```

3. Ejemplo crear nueva caja:
    ```http
    POST /api/cajas
    Content-Type: application/json

    {
      "numero_caja": 4,
      "nombre": "Caja cuatro",
      "ubicacion": "Recepción",
      "estado": "activa",
      "descripcion": "Caja principal del local"
    }
    ```
    Notas:
    - `numero_caja` y `nombre` son obligatorios.
    - `ubicacion`, `estado` (por defecto `"activa"`), y `descripcion` son opcionales.

    Respuesta:
    ```json
    {
      "id": 9,
      "numero_caja": 4,
      "nombre": "Caja cuatro",
      "ubicacion": "Recepción",
      "estado": "activa",
      "descripcion": "Caja principal del local"
    }
    ```

4. Ejemplo actualizar caja:
    ```http
    PUT /api/cajas/9
    Content-Type: application/json

    {
      "numero_caja": 4,
      "nombre": "Caja Secundaria",
      "ubicacion": "Sucursal B",
      "estado": "inactiva",
      "descripcion": "Caja en sucursal B"
    }
    ```
    Respuesta: 
    ```json
    {
      "message": "Caja actualizada correctamente"
    }
    ```
5. Ejemplo eliminar caja:
    ```http
    DELETE /api/cajas/9
    ```
    Respuesta:
    ```json
    {
      "message": "Caja eliminada correctamente"
    }
    ```
Respuestas de error:

| Código | Respuesta                                              | Descripción                                                      |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------- |
| 400    | `{ "error": "numero_caja y nombre son obligatorios" }` | Faltan campos obligatorios al crear una caja.                    |
| 404    | `{ "message": "Caja no encontrada" }`                  | No se encontró la caja al obtener, actualizar o eliminar por ID. |
| 409    | `{ "error": "El número de caja ya existe" }`           | Intento de crear o actualizar con un `numero_caja` duplicado.    |
| 500    | `{ "error": <mensaje de error de MySQL> }`             | Error interno del servidor o en la base de datos.                |


---

### 6. Aperturas y Cierres (`/aperturas-cierres`)
| Método | Endpoint                 | Descripción                   | Requiere Token |
| ------ | ------------------------ | ----------------------------- | --------- |
| GET    | `/aperturas-cierres`     | Listar todos los registros (con paginación y búsqueda opcional)   | Sí |
| GET    | `/aperturas-cierres/:id` | Obtener registro por ID       | Sí |
| POST   | `/aperturas-cierres`     | Crear nuevo registro          | Sí |
| PUT    | `/aperturas-cierres/:id` | Actualizar registro existente | Sí |
| DELETE | `/aperturas-cierres/:id` | Eliminar registro             | Sí |

1. Ejemplo listar los registros:
    ```http
    GET /api/aperturas-cierres?page=1&pageSize=10&search=admin&numero_caja=2&estado=cerrada
    ```
    Parámetros query opcionales:
    - `page`, `pageSize`: paginación (default 1 y 10)
    - `search`: búsqueda global en usuario apertura, usuario cierre, nombre caja o estado (case insensitive)
    - `id_usuario_apertura`
    - `id_usuario_cierre`
    - `id_usuario` (filtra por apertura o cierre)
    - `numero_caja`
    - `estado` (por ejemplo: abierta, cerrada)
    - `fecha_inicio`, `fecha_fin` (filtra por rango en fecha_apertura)

    Respuesta: 
    ```json
    {
        "total": 1,
        "page": 1,
        "pageSize": 10,
        "data": [
            {
                "id": 22,
                "numero_caja": 2,
                "id_usuario_apertura": 1,
                "id_usuario_cierre": 1,
                "fecha_apertura": "2025-08-11T04:00:00.000Z",
                "hora_apertura": "15:31:00",
                "fecha_cierre": "2025-08-11T04:00:00.000Z",
                "hora_cierre": "11:11:00",
                "monto_inicial": "11111.00",
                "total_efectivo": "11111.00",
                "total_tarjeta": "1111.00",
                "total_general": "12222.00",
                "observaciones": null,
                "estado": "cerrada",
                "fue_arqueada": 0,
                "nombre_usuario_apertura": "ejemplo",
                "nombre_usuario_cierre": "ejemplo",
                "nombre_caja": "Caja Secundaria"
            }
        ]
    }
    ```

2. Ejemplo obtener registro por ID:
    ```http
    GET /api/aperturas-cierres/5
    ```
    Respuesta:
    ```json
    {
        "id": 5,
        "numero_caja": 3,
        "id_usuario_apertura": 2,
        "id_usuario_cierre": 2,
        "fecha_apertura": "2025-07-18T04:00:00.000Z",
        "hora_apertura": "12:09:32",
        "fecha_cierre": "2025-07-18T04:00:00.000Z",
        "hora_cierre": "12:10:00",
        "monto_inicial": "1000.00",
        "total_efectivo": "500.00",
        "total_tarjeta": "4000.00",
        "total_general": "4500.00",
        "observaciones": "Cierre manual desde interfaz",
        "estado": "cerrada",
        "fue_arqueada": 0
    }
    ```
3. Ejemplo crear nuevo registro:
    ```http
    POST /api/aperturas-cierres
    Content-Type: application/json

    {
      "numero_caja": 1,
      "id_usuario_apertura": 2,
      "fecha_apertura": "2025-07-28",
      "hora_apertura": "08:00:00",
      "monto_inicial": 10000.00
    }
    ```
    Campos obligatorios:
    `numero_caja`, `id_usuario_apertura`, `fecha_apertura`, `hora_apertura`, `monto_inicial`

    Respuesta: 
    ```json
    {
        "id": 23,
        "numero_caja": 1,
        "id_usuario_apertura": 2,
        "fecha_apertura": "2025-07-28",
        "hora_apertura": "08:00:00",
        "monto_inicial": 10000
    }
    ```
4. Ejemplo actualizar registro existente:
    ```http
    PUT /api/aperturas-cierres/23
    Content-Type: application/json

    {
      "numero_caja": 1,
      "id_usuario_apertura": 2,
      "id_usuario_cierre": 3,
      "fecha_apertura": "2025-07-28",
      "hora_apertura": "08:00:00",
      "fecha_cierre": "2025-07-28",
      "hora_cierre": "18:00:00",
      "monto_inicial": 10000.00,
      "total_efectivo": 200000.00,
      "total_tarjeta": 150000.00,
      "observaciones": "Cierre normal",
      "estado": "cerrada",
      "fue_arqueada": 1
    }
    ```
    Respuesta:
    ```json
    {
      "message": "Registro actualizado correctamente"
    }
    ```
5. Ejemplo eliminar registro:
    ```http
    DELETE /api/aperturas-cierres/23
    ```
    Respuesta:
    ```json
    {
      "message": "Registro eliminado correctamente"
    }
    ```
Respuestas de error:

| Código | Respuesta                                                                                                            | Descripción                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 400    | `{ "error": "Campos obligatorios: numero_caja, id_usuario_apertura, fecha_apertura, hora_apertura, monto_inicial" }` | Faltan campos obligatorios al crear un registro.                     |
| 404    | `{ "message": "Registro no encontrado" }`                                                                            | No se encontró el registro al obtener, actualizar o eliminar por ID. |
| 500    | `{ "error": <mensaje de error de MySQL> }`                                                                           | Error interno del servidor o en la base de datos.                    |



---

### 7. Helpers (`/helpers`)
| Método | Endpoint                 | Descripción                   | Requiere Token |
| ------ | ------------------------ | ----------------------------- | ------------- |
| GET    | `/helpers/metadata`     | Obtener listas (usuarios, servicios, cajas, medios de pago) para filtros dinámicos    | Sí |
| GET    | `/helpers/resumen` | Obtener resumen estadístico de movimientos (totales y ganancias por medio de pago y períodos)     | Sí |

1. Ejemplo obtener metadata para filtros:
    ```http
    GET /api/helpers/metadata?usuarios=1&servicios=1&cajas=1&mediosPago=1
    ```
    Parámetros query (opcionales):
    - `usuarios` (1 o 0, default 1)
    - `servicios` (1 o 0, default 1)
    - `cajas` (1 o 0, default 1)
    - `mediosPago` (1 o 0, default 1)

    Si alguno está en 0, no se incluye en la respuesta.

    Respuesta:
    ```json
    {
        "usuarios": [
            {
                "id": 1,
                "nombre": "ejemplo"
            }...
        ],
        "servicios": [
            {
                "id": 1,
                "nombre": "Baño ejemplo"
            }...
        ],
        "cajas": [
            {
                "numero_caja": 1,
                "nombre": "Caja ejemplo"
            }...
        ],
        "mediosPago": [
            "EFECTIVO",
            "TARJETA"
        ]
    }
    ```
2. Ejemplo obtener resumen estadístico de movimientos:
    ```http
    GET /api/helpers/resumen
    ```

    Respuesta:
    ```json
    {
        "totalUsuarios": 1234,
        "totalMovimientos": 1234,
        "totalServicios": 1234,
        "totalCajas": 1234,
        "distribucionMediosPago": {
            "EFECTIVO": 1234,
            "TARJETA": 1234
        },
        "totalGanancias": {
            "EFECTIVO": 1234,
            "TARJETA": 1234,
            "TOTAL": 1234
        },
        "totalGananciasHoy": {
            "EFECTIVO": 1234,
            "TARJETA": 1234,
            "TOTAL": 1234
        },
        "totalGananciasSemana": {
            "EFECTIVO": 1234,
            "TARJETA": 1234,
            "TOTAL": 1234
        },
        "totalGananciasMes": {
            "EFECTIVO": 1234,
            "TARJETA": 1234,
            "TOTAL": 1234
        },
        "totalGananciasAnio": {
            "EFECTIVO": 1234,
            "TARJETA": 1234,
            "TOTAL": 1234
        }
    }
    ```
Respuestas de error:
| Código | Respuesta                                             | Descripción                                                                                  |
| ------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 500    | `{ "error": "Error al obtener metadata" }`            | Error interno del servidor al obtener metadata (usuarios, servicios, cajas, medios de pago). |
| 500    | `{ "error": "Error al obtener resumen de metadata" }` | Error interno del servidor al calcular totales y distribuciones de movimientos.              |

---

## Notas:
- Los ejemplos muestran los formatos básicos, algunos campos pueden variar según contexto.
- La autenticación utiliza JWT y debe incluirse en headers para rutas protegidas.
- Los campos de fecha deben enviarse en formato ISO (YYYY-MM-DD) y horas en formato HH:MM:SS.
