# CineReserva - Sistema de Reservas de Salas de Cine

## Contexto

Proyecto desarrollado para la materia de **Computación en Internet III**, cuyo objetivo es construir una API Backend robusta con **NestJS**, **TypeScript**, **TypeORM** y **PostgreSQL**, con autenticación mediante **Passport (JWT + 2FA)**, autorización basada en roles, pruebas automatizadas y despliegue en la nube.

El equipo está compuesto por **3 personas**. Este documento define el contexto de negocio, los actores, y los requerimientos funcionales que servirán de base para el diseño de entidades, endpoints y pruebas.

## Problemática

Los cines pequeños e independientes (o las salas de cine dentro de centros culturales o universitarios) suelen gestionar sus funciones y la venta de boletas de forma manual: hojas de cálculo, mensajes de texto o venta exclusivamente presencial en taquilla. Esto genera varios problemas:

- No hay visibilidad en tiempo real de qué asientos están disponibles para una función, lo que provoca que dos personas reclamen el mismo puesto al mismo tiempo (sobreventa).
- El cliente debe acercarse físicamente o llamar para saber la disponibilidad, sin poder verla ni reservarla desde un dispositivo propio.
- No existe un mecanismo de "apartado temporal" del asiento mientras el cliente completa su compra, por lo que la selección y confirmación no está protegida de condiciones de carrera.
- El personal de counter no cuenta con una forma sistemática de validar boletas en la puerta, permitiendo reingresos o boletas duplicadas.
- La administración no tiene reportes consolidados de ocupación y ventas por función, dificultando decisiones sobre horarios y precios.

## Objetivo de la solución

Construir una API que permita administrar la cartelera de películas y funciones, mostrar en tiempo real el estado del mapa de asientos de una función (disponible, bloqueado temporalmente, ocupado), permitir a los clientes reservar y confirmar asientos de forma segura evitando sobreventa, y a los administradores y personal de counter operar el negocio (cartelera, validación de boletas, reportes).

### Lo que la solución no resuelve

- No procesa pagos reales; la confirmación de una reserva se simula como "pagada" sin integración con una pasarela de pagos.
- No gestiona la proyección técnica de la película (formatos, subtítulos, doblaje) más allá de su ficha informativa.
- No gestiona inventario de dulcería, combos ni otros productos adicionales a la boleta.
- No reemplaza un sistema de facturación electrónica ni maneja aspectos tributarios.

## Actores y roles

| Rol | Quién es | Qué hace en la plataforma |
|---|---|---|
| **Admin** | Responsable de la operación del cine. | Administra películas, salas, funciones, usuarios y roles; consulta reportes de ocupación y ventas. |
| **Counter** (Personal de taquilla) | Empleado encargado de la atención en sala el día de la función. | Valida tickets en la entrada y consulta el estado de las funciones del día. |
| **Cliente** | Persona que se registra para reservar boletas. | Consulta cartelera, reserva y confirma asientos, consulta su historial de reservas, cancela reservas. |

## Entidades sugeridas

- `User` (con rol: admin, counter, cliente)
- `Movie` (título, sinopsis, duración, género, clasificación, póster)
- `Room` (sala: nombre, capacidad, filas/columnas)
- `Seat` (asiento: fila, columna, tipo — normal/VIP —, sala a la que pertenece)
- `Showtime` (función: película, sala, fecha/hora, precio base)
- `SeatHold` (bloqueo temporal de un asiento para una función, con expiración)
- `Reservation` (reserva: cliente, función, asientos, estado — pendiente/confirmada/cancelada/expirada —, fecha)
- `Ticket` (boleta: código único por asiento reservado, estado — vigente/utilizado/anulado)

## Requerimientos funcionales

> Redactados como historias de usuario. Los marcados con 🔌 son los llamados a apoyarse en **WebSockets** (Gateways de NestJS); el resto son endpoints REST convencionales.

**RF1.** Como usuario, quiero registrarme e iniciar sesión con mi correo y contraseña, incluyendo verificación en dos pasos (2FA), para acceder de forma segura a la plataforma.

**RF2.** Como admin, quiero asignar y modificar el rol de un usuario (cliente, counter, admin) para controlar qué funcionalidades puede usar cada uno.

**RF3.** Como admin, quiero crear, editar, listar y eliminar películas (título, sinopsis, duración, género, clasificación, póster) para mantener actualizado el catálogo disponible.

**RF4.** Como admin, quiero crear y administrar salas, definiendo su distribución de asientos (filas, columnas y tipo de asiento: normal o VIP), para poder programar funciones sobre ellas.

**RF5.** Como admin, quiero crear funciones asociando una película, una sala, una fecha/hora y un precio base, para publicar la cartelera de proyecciones.

**RF6.** Como cliente, quiero consultar la cartelera de funciones disponibles, filtrando por película, fecha o sala, para elegir la función que me interesa.

**RF7.** Como cliente, quiero consultar el mapa de asientos de una función específica, viendo el estado de cada asiento (disponible, bloqueado temporalmente u ocupado), para elegir dónde sentarme.

**RF8.** Como cliente, quiero seleccionar uno o varios asientos disponibles y que queden bloqueados temporalmente (p. ej. 5 minutos) mientras completo mi reserva, para evitar que otro cliente los tome al mismo tiempo.

**RF9. 🔌** Como cliente conectado al mapa de asientos de una función, quiero recibir actualizaciones en tiempo real cuando un asiento cambie de estado (bloqueado, liberado o confirmado) por la acción de otro cliente, sin necesidad de recargar la página.

**RF10.** Como cliente, quiero confirmar mi reserva antes de que expire el bloqueo temporal de mis asientos, generando un ticket digital único por cada asiento reservado.

**RF11.** Como sistema, debo liberar automáticamente los asientos bloqueados cuya reserva no fue confirmada dentro del tiempo límite, dejándolos disponibles nuevamente para otros clientes.

**RF12.** Como cliente, quiero consultar el historial de mis reservas y tickets, incluyendo su estado (confirmada, cancelada, utilizada), para tener control de mis compras.

**RF13.** Como cliente, quiero cancelar una reserva confirmada antes de la función, dentro de una ventana de tiempo permitida, liberando los asientos correspondientes.

**RF14.** Como counter, quiero validar el ticket de un cliente en la entrada de la sala mediante su código único, marcándolo como utilizado, para controlar el ingreso y evitar boletas duplicadas o reingresos.

**RF15.** Como admin, quiero consultar un reporte de ocupación y ventas por función (asientos vendidos, disponibles y total de ingresos), para evaluar el desempeño de cada proyección.

## Notas técnicas y de implementación

- **Autenticación:** Passport con estrategia JWT; el 2FA puede implementarse con TOTP (ej. `speakeasy` + `otplib`) o con envío de código temporal.
- **Autorización:** Guards y decoradores personalizados (`@Roles()`) por rol (admin, counter, cliente).
- **WebSockets:** Implementar mediante un Gateway de NestJS (`@WebSocketGateway`), usando salas (`rooms` de Socket.IO) por `showtimeId`, de modo que solo los clientes viendo esa función reciban las actualizaciones del mapa de asientos.
- **Expiración de bloqueos (RF11):** puede resolverse con un `cron job` (`@nestjs/schedule`) o con un mecanismo de expiración basado en timestamps verificado en cada consulta.
- **Persistencia:** PostgreSQL + TypeORM, con relaciones claras entre `Showtime`, `Seat`, `SeatHold`, `Reservation` y `Ticket`.
- **Pruebas:** cada RF debe ser verificable de forma aislada; se recomienda priorizar pruebas unitarias sobre los servicios de negocio (bloqueo/expiración de asientos, generación de tickets, validación de reglas de cancelación) y pruebas de integración (supertest) sobre los endpoints REST. El Gateway de WebSockets puede probarse con un cliente de prueba (`socket.io-client`) en pruebas de integración.
- **Seed:** cargar al menos un usuario admin, un usuario counter, algunas películas, una sala con su mapa de asientos y una función de ejemplo.

## Alineación con la rúbrica del taller

| Criterio del taller | Cómo se cubre |
|---|---|
| Seed | Usuario admin + datos base de películas/salas/funciones |
| Autenticación (JWT + 2FA) | RF1 |
| Autorización por roles | RF2, y roles aplicados transversalmente en RF3-RF15 |
| Funcionalidades | RF3 a RF15 |
| Persistencia (TypeORM + PostgreSQL) | Entidades sugeridas |
| Pruebas | Unitarias sobre lógica de bloqueo/expiración/tickets; integración sobre endpoints y WebSocket |
| Swagger | Documentar todos los endpoints REST (no aplica directamente a WebSockets) |
| Despliegue + CI/CD | Fuera del alcance de este documento, a definir por el equipo |
