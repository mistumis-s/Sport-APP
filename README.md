# DH Elite - Sport Performance Tracker

Aplicacion web para que jugadores registren Wellness y RPE, y para que el staff controle carga, fatiga, evolucion individual y estado del equipo.

## Stack

- Frontend: React + Vite + Tailwind
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Produccion: una sola app Node sirve la API y los archivos compilados del frontend

## Desarrollo local

Requisitos:

- Node.js 22+
- PostgreSQL local, Docker, o una base de datos gestionada

1. Levanta PostgreSQL local con Docker:

```powershell
docker compose up -d
```

Esto crea una base local llamada `sport_app` en `localhost:5432`.

2. Copia `backend/.env.example` a `backend/.env` y cambia `JWT_SECRET`.
3. Instala dependencias y arranca el backend:

```powershell
cd backend
npm install
npm run dev
```

En otra terminal:

```powershell
cd frontend
npm install
npm run dev
```

API: `http://localhost:3001`

App: `http://localhost:3000`

## Credenciales iniciales

La primera vez que arranca con una base de datos vacia, el backend crea un equipo, jugadores de ejemplo y un preparador.

| Rol | Acceso |
| --- | --- |
| Preparador | Password: `coach123` |
| Jugador | Nombre del jugador + PIN: `1234` |

Cambia estas credenciales antes de usarlo con un equipo real.

## Build de produccion

El frontend compila dentro de `backend/public`:

```powershell
cd frontend
npm run build
```

Despues el backend puede servir API + frontend:

```powershell
cd ../backend
npm start
```

## Despliegue online con Render

La forma mas rapida para lanzar una beta es Render con PostgreSQL gestionado.

1. Sube este repo a GitHub.
2. En Render, elige **New +** > **Blueprint**.
3. Conecta el repo `mistumis-s/Sport-APP`.
4. Render leera `render.yaml` y creara:
   - un servicio web `sport-app`
   - una base PostgreSQL `sport-app-db`
   - variables `NODE_ENV`, `JWT_SECRET` y `DATABASE_URL`
5. Pulsa **Apply** y espera el primer deploy.
6. Abre la URL publica y prueba `/api/health`.

La PostgreSQL de produccion no se crea en tu ordenador. Se crea dentro de Render al aplicar el Blueprint, y Render inyecta su URL real en `DATABASE_URL`.

## Variables de entorno

Backend:

- `DATABASE_URL`: conexion PostgreSQL.
- `JWT_SECRET`: secreto largo y aleatorio para firmar sesiones.
- `ADMIN_API_KEY`: clave privada para que el propietario cree equipos y entrenadores.
- `NODE_ENV`: `production` en despliegue.
- `PORT`: opcional; Render lo define automaticamente.

## Alta privada de equipos

El registro publico no esta abierto. El propietario de la plataforma crea cada equipo con la API admin y entrega credenciales al preparador.

En Render, abre el servicio `sport-app`, entra en **Environment** y copia `ADMIN_API_KEY`.

Ejemplo:

```powershell
$adminKey = "TU_ADMIN_API_KEY"

Invoke-RestMethod `
  -Method Post `
  -Uri "https://sport-app-7ibp.onrender.com/api/admin/teams" `
  -Headers @{ "x-admin-key" = $adminKey } `
  -ContentType "application/json" `
  -Body '{
    "team_name": "Club Rugby Example Sub18",
    "club_name": "Club Rugby Example",
    "category": "Sub18",
    "coach_name": "Nombre Entrenador",
    "coach_email": "coach@example.com"
  }'
```

La respuesta incluye `credentials.email` y `credentials.temporary_password`. Esas son las credenciales que se entregan al preparador.

## Flujo de uso

Jugador:

1. Login con nombre + PIN.
2. Antes del entreno: Wellness.
3. Despues del entreno: RPE.
4. Consulta de evolucion individual.

Preparador:

1. Login con password.
2. Crear sesiones y partidos.
3. Revisar dashboard de equipo.
4. Revisar jugadores y detalle individual.

## Metricas

| Metrica | Formula |
| --- | --- |
| Wellness Score | `(fatiga * 0.3 + sueno * 0.2 + estres * 0.05 + motivacion * 0.05 + dano * 0.4) * 20` |
| sRPE | `RPE * minutos_sesion` |
| A/C Ratio | `avg_sRPE_7d / avg_sRPE_28d` |
| Monotonia | `media_sRPE_semana / desv_std_sRPE_semana` |
| Stress | `carga_total * monotonia` |

## Siguiente paso recomendado

Antes de abrirlo a equipos externos, conviene endurecer autenticacion, roles multi-equipo, backups, privacidad de datos y panel de administracion.
