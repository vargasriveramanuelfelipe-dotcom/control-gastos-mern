# CashFlow - Gestor de gastos

Aplicacion MERN para registrar ingresos y gastos, actualizar el saldo y consultar reportes por fecha.

## Requisitos

- Node.js 18 o superior
- MongoDB local instalado y ejecutándose

## Arranque local

1. Abre una terminal en `proyectogastos/server`.
2. Ejecuta `npm install`.
3. Copia `.env.example` como `.env`.
4. Verifica que MongoDB este iniciado. La configuración usa MongoDB local por defecto.
5. Ejecuta `npm run dev`.
6. En otra terminal, entra a `proyectogastos/client`, ejecuta `npm install` y luego `npm run dev`.
7. Abre la URL que muestra Vite, normalmente `http://localhost:5173`.

## API principal

- `GET /api/health`
- `GET/PUT /api/settings`
- `GET/POST /api/movements`
- `DELETE /api/movements/:id`
- `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
