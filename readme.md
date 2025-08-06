# Backend para Mantenedor de Baños


Este proyecto corresponde a un backend desarrollado con Node.js, Express y MySQL para la gestión de:

- Cajas
- Aperturas y cierres de caja
- Servicios
- Movimientos (ingresos y egresos)
- Usuarios (con autenticación y roles)

> Proyecto desarrollado con soporte para JWT, paginación, búsqueda, validaciones de integridad y despliegue en entorno seguro HTTPS.

---

## Base URL
```
http://localhost:4000/api
```

---

## Endpoints

### 1. Autenticación (`/auth`)
| Método | Endpoint              | Descripción                  |
| ------ | ----------------- | ---------------------------- |
| POST   | `/auth/login` | Login con email y contraseña |


### 2. Usuarios (`/users`)
| Método | Endpoint     | Descripción                  |
| ------ | ------------ | ---------------------------- |
| GET    | `/users`     | Obtener todos los usuarios   |
| GET    | `/users/:id` | Obtener usuario por ID       |
| GET    | `/users/roles` | Obtener roles únicos  |
| POST   | `/users`     | Crear nuevo usuario          |
| PUT    | `/users/:id` | Actualizar usuario existente |
| DELETE | `/users/:id` | Eliminar usuario             |

Ejemplo Crear Usuario: 
```
POST /api/users
Content-Type: application/json

{
  "username": "juanperez",
  "email": "juan@example.com",
  "password": "123456",
  "role": "admin"
}
```

### 3. Servicios (`/servicios`)
| Método | Endpoint         | Descripción                   |
| ------ | ---------------- | ----------------------------- |
| GET    | `/services`     | Listar todos los servicios    |
| GET    | `/services/tipo`     | 	Listar tipos únicos    |
| GET    | `/services/:id` | Obtener servicio por ID       |
| POST   | `/services`     | Crear nuevo servicio          |
| PUT    | `/services/:id` | Actualizar servicio existente |
| DELETE | `/services/:id` | Eliminar servicio             |

Ejemplo Crear Servicio
```
POST /api/services
Content-Type: application/json

{
  "nombre": "Baño Simple",
  "tipo": "BAÑO",
  "precio": 2000.00,
  "descripcion": "Baño para uso simple",
  "estado": "activo"
}
```

### 4. Movimientos (`/movimientos`)
| Método | Endpoint           | Descripción                     |
| ------ | ------------------ | ------------------------------- |
| GET    | `/movimientos`     | Listar todos los movimientos    |
| GET    | `/movimientos/:id` | Obtener movimiento por ID       |
| POST   | `/movimientos`     | Crear nuevo movimiento          |
| PUT    | `/movimientos/:id` | Actualizar movimiento existente |
| DELETE | `/movimientos/:id` | Eliminar movimiento             |

Ejemplo Crear Movimiento
```
POST /api/movimientos
Content-Type: application/json

{
  "id_aperturas_cierres": 1,
  "id_usuario": 2,
  "id_servicio": 3,
  "numero_caja": 1,
  "monto": 2000.00,
  "medio_pago": "EFECTIVO",
  "fecha": "2025-07-28",
  "hora": "14:30:00",
  "codigo": "ABC123"
}
```

### 5. Cajas (`/cajas`)
| Método | Endpoint     | Descripción               |
| ------ | ------------ | ------------------------- |
| GET    | `/cajas`     | Listar todas las cajas    |
| GET    | `/cajas/:id` | Obtener caja por ID       |
| POST   | `/cajas`     | Crear nueva caja          |
| PUT    | `/cajas/:id` | Actualizar caja existente |
| DELETE | `/cajas/:id` | Eliminar caja             |

Ejemplo Crear Caja
```
POST /api/cajas
Content-Type: application/json

{
  "numero_caja": 1,
  "nombre": "Caja Principal",
  "ubicacion": "Recepción",
  "estado": "activa",
  "descripcion": "Caja principal del local"
}
```

### 6. Aperturas y Cierres (`/aperturas-cierres`)
| Método | Endpoint                 | Descripción                   |
| ------ | ------------------------ | ----------------------------- |
| GET    | `/aperturas-cierres`     | Listar todos los registros    |
| GET    | `/aperturas-cierres/:id` | Obtener registro por ID       |
| POST   | `/aperturas-cierres`     | Crear nuevo registro          |
| PUT    | `/aperturas-cierres/:id` | Actualizar registro existente |
| DELETE | `/aperturas-cierres/:id` | Eliminar registro             |

Ejemplo Crear Apertura/Cierre^
```
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