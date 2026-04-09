# Auditoría Técnica - Sports App

## 1. STACK & PERFORMANCE

### Backend & DB
- **Runtime:** Node.js `>=22` según [backend/package.json](/c:/Users/harea/Desktop/Sport/backend/package.json).
- **Servidor HTTP:** Express `4.18.2`.
- **Base de datos:** SQLite local sobre archivo `backend/sport.db`.
- **Driver/ORM:** no hay ORM. El acceso se hace con `DatabaseSync` de `node:sqlite`, consultas SQL manuales y sentencias preparadas.
- **Seguridad de escritura:** SQLite corre con `PRAGMA journal_mode = WAL` y `PRAGMA foreign_keys = ON`.
- **Migraciones:** no existe sistema formal de migraciones. Se aplican `ALTER TABLE` manuales en arranque, envueltos en `try/catch`.
- **Reactividad de datos:** no existe reactividad real. No hay WebSockets, SSE, listeners de cambios ni polling centralizado. Toda actualización depende de refetch manual desde el frontend.
- **Impacto de performance actual:** correcto para un equipo y bajo volumen. El patrón actual genera varias consultas por jugador en métricas semanales y listados, con riesgo de N+1 al escalar.

### Frontend & State
- **UI runtime:** React `18.2.0`.
- **Routing:** React Router DOM `6.22.1`.
- **Bundler:** Vite `5.1.4`.
- **Estilos:** Tailwind CSS `3.4.1` con utilidades propias ligeras.
- **Estado global:** solo `AuthContext` para usuario autenticado. No hay store global para dominio de negocio.
- **Estado de pantalla:** `useState` + `useEffect` por página/componente.
- **Fetching:** Axios `1.6.7` con una instancia única y `Authorization: Bearer` desde `localStorage`.
- **Estrategia de datos:** fetching imperativo en montaje y tras acciones. No hay React Query, SWR, invalidación centralizada, cache de consultas, optimistic UI ni deduplicación automática.
- **Manejo de sesión:** `token` y `user` persisten en `localStorage`. Ante `401`, el interceptor limpia ambos y redirige a `/`.

### External Libs
- **Gráficos:** `recharts 2.12.1`.
- **HTTP client:** `axios 1.6.7`.
- **Auth/crypto backend:** `jsonwebtoken 9.0.2`, `bcryptjs 2.4.3`.
- **Dev server / DX:** `nodemon 3.1.0`.
- **Manejo de fechas:** no se usa `date-fns` ni `dayjs`. Toda la lógica de fechas usa `Date` nativo y strings ISO.
- **Validación de esquemas:** no se usa `Zod`, `Joi`, `Yup` ni equivalente. La validación es manual en rutas y formularios.
- **Observación importante:** la ausencia de librerías de fechas y validación aumenta el riesgo de bugs de calendario, timezone y contratos API implícitos.

## 2. ARQUITECTURA DE DATOS (ERD Logic)

### Schema Detail

#### Users
- **Tabla:** `users`
- **Campos principales:**
  - `id INTEGER PK`
  - `name TEXT NOT NULL`
  - `role TEXT CHECK(role IN ('player','coach'))`
  - `pin TEXT`
  - `password TEXT`
  - `team TEXT NOT NULL DEFAULT 'DH ÉLITE'`
  - `created_at TEXT`
- **Relaciones:**
  - `users (player)` `1:N` `wellness`
  - `users (player)` `1:N` `rpe`
  - `users (coach)` `1:N` `sessions.created_by`
- **Observación:** no existe entidad `teams`. `team` es un `TEXT` duplicado, no una FK.

#### Sessions
- **Tabla:** `sessions`
- **Campos principales:**
  - `id INTEGER PK`
  - `date TEXT NOT NULL`
  - `team TEXT NOT NULL`
  - `match_day_type TEXT NOT NULL`
  - `is_match INTEGER NOT NULL DEFAULT 0`
  - `color_day TEXT NOT NULL`
  - `duration_minutes INTEGER NOT NULL`
  - `week INTEGER`
  - `notes TEXT`
  - `created_by INTEGER FK -> users.id`
- **Relaciones:**
  - `sessions 1:N wellness`
  - `sessions 1:N rpe`
- **Modelo funcional:** una sesión por fecha a nivel de equipo. El backend actual actualiza la sesión existente si ya hay una en esa fecha.

#### Wellness
- **Tabla:** `wellness`
- **Campos principales:**
  - `id INTEGER PK`
  - `player_id INTEGER FK -> users.id`
  - `session_id INTEGER FK -> sessions.id`
  - `date TEXT NOT NULL`
  - `fatiga INTEGER NOT NULL`
  - `sueno_calidad INTEGER NOT NULL`
  - `sueno_horas REAL NOT NULL`
  - `estres INTEGER NOT NULL`
  - `motivacion INTEGER NOT NULL`
  - `dano_muscular INTEGER NOT NULL`
  - `observaciones TEXT`
  - `molestias_zonas TEXT`
  - `enfermedad TEXT`
  - `sensacion_proximo TEXT`
  - `entrenamiento_previo INTEGER`
  - `otros_comentarios TEXT`
  - `wellness_score REAL`
- **Relaciones:**
  - `users 1:N wellness`
  - `sessions 1:N wellness`
- **Observación:** `molestias_zonas` se persiste como JSON serializado en `TEXT`.

#### RPE
- **Tabla:** `rpe`
- **Campos principales:**
  - `id INTEGER PK`
  - `player_id INTEGER FK -> users.id`
  - `session_id INTEGER FK -> sessions.id`
  - `date TEXT NOT NULL`
  - `rpe INTEGER NOT NULL`
  - `srpe REAL`
  - `comentarios TEXT`
- **Relaciones:**
  - `users 1:N rpe`
  - `sessions 1:N rpe`

#### Teams
- **Estado real:** no existe tabla `teams`.
- **Consecuencia:** no hay modelo de pertenencia formal jugador-equipo, ni ownership multi-equipo, ni aislamiento real por tenant.

#### Injuries
- **Estado real:** no existe tabla `injuries`.
- **Sustituto actual:** el estado clínico/funcional se mezcla en `wellness` con:
  - `molestias_zonas`
  - `enfermedad`
  - `sensacion_proximo`
  - `entrenamiento_previo`
  - `otros_comentarios`
- **Consecuencia:** no existe historial estructurado de lesión, severidad, retorno, lateralidad, diagnóstico ni estado.

### Enums
- **Roles:** único enum realmente reforzado en DB: `player`, `coach`.
- **Tipos de sesión / Match Day Type:** no hay enum SQL. Se usan strings libres en frontend/backend:
  - `MD-5`, `MD-4`, `MD-3`, `MD-2`, `MD-1`, `MD(H)`, `MD(A)`, `MD+1`, `MD+2`, `MD+3`
- **Color Day / Intensidad:** tampoco hay enum SQL. Valores implícitos:
  - `AMARILLO`, `NARANJA`, `ROJO`, `ROJO+`
- **Escala RPE:** funcionalmente `0-10` en UI, pero no existe `CHECK` en DB.
- **Posiciones en el campo:** no existe campo ni enum de posiciones.

### Relaciones ERD reales
- `User(player) 1:N Wellness`
- `User(player) 1:N RPE`
- `User(coach) 1:N Sessions`
- `Session 1:N Wellness`
- `Session 1:N RPE`
- **Many-to-Many:** no existe ninguna relación M:N modelada.

### Data Persistence
- **Persistencia remota:** escritura directa al backend vía API.
- **Persistencia local:** solo sesión/auth en `localStorage`.
- **Offline safety:** no existe.
- **Draft recovery:** no existe.
- **Retry queue:** no existe.
- **Resultado actual:** si el jugador rellena Wellness o RPE y falla la red antes del `POST`, pierde el formulario al recargar o abandonar pantalla.

## 3. ENGINE DE MÉTRICAS (Lógica de Negocio)

### Algoritmo MD+/-

#### Fuente de verdad actual
- Los partidos se detectan desde `sessions` cuando:
  - `is_match = 1`, o
  - `match_day_type IN ('MD', 'MD(H)', 'MD(A)')`

#### Lógica actual
1. Se recopilan todas las fechas de partido.
2. Para cada día del timeline se calcula la diferencia en días contra cada partido.
3. Se elige el partido más cercano en valor absoluto.
4. En empate, se prioriza el diff positivo.
5. Se formatea:
   - `0 -> MD`
   - `-1 -> MD-1`
   - `+1 -> MD+1`
   - partido etiquetado manualmente puede seguir mostrando `MD(H)` o `MD(A)` en tablas de sesiones

#### Pseudocódigo
```text
match_dates = all session.date where is_match = 1 or match_day_type in [MD, MD(H), MD(A)]

for each row_date in timeline:
  if no match_dates:
    relative_match_day = null
  else:
    diffs = match_dates.map(match_date => days_between(match_date, row_date))
    nearest = diff with smallest abs(diff)
    if abs-tie:
      choose positive diff
    relative_match_day = format(nearest)

format(diff):
  if diff == 0 => "MD"
  if diff > 0 => "MD+" + diff
  if diff < 0 => "MD" + diff
```

#### Limitaciones
- No existe entidad `fixture`.
- No hay soporte explícito para semanas con 2 partidos.
- En semanas con 2 partidos, el algoritmo usa el partido más cercano, no el contexto táctico real del microciclo.
- No hay recalculado histórico por cambio de calendario más allá de lo que se derive de las sesiones guardadas.

### Cálculo de Carga

#### sRPE
- Fórmula actual:
```text
sRPE = RPE * duration_minutes
```
- Solo se calcula si el registro RPE está ligado a una sesión con duración.

#### Aguda, Crónica y ACWR
- Implementación actual en dashboard:
  - **Acute:** media de `sRPE` de los últimos 7 días.
  - **Chronic:** media de `sRPE` de los últimos 28 días.
  - **ACWR:** `acuteAvg / chronicAvg`

#### Pseudocódigo
```text
acute_values   = srpe where date in [ref-7d, ref] and srpe != null
chronic_values = srpe where date in [ref-28d, ref] and srpe != null

acute_avg   = mean(acute_values)
chronic_avg = mean(chronic_values)

if acute_avg missing or chronic_avg missing:
  return null

ACWR = round(acute_avg / chronic_avg, 2)
```

#### Tratamiento de descansos / ceros
- No se sintetizan días vacíos.
- Un día sin fila `rpe` no entra como `0`; simplemente no entra en la media.
- Efecto: la carga aguda/crónica actual es una media sobre días reportados, no una media sobre calendario completo.
- Desde ciencia de rendimiento, esto sesga al alza las medias en periodos con descansos o registros incompletos.

#### Monotonía, Stress y Variabilidad
- Fórmulas actuales:
```text
mean = average(values)
sd = standard_deviation(values)
monotony = mean / sd           if sd > 0
stress = total_load * monotony
variability = sd
```
- Se aplica tanto a Wellness semanal como a sRPE semanal.
- Si `sd = 0`, monotonía y stress retornan `null`.

### Métricas Wellness

#### Wellness Score
- Fórmula actual:
```text
WS = (fatiga*0.30 + sueno_calidad*0.20 + estres*0.05 + motivacion*0.05 + dano_muscular*0.40) * 20
```
- Rango funcional aproximado: `20-100`.

#### Normalización
- No hay Z-Score.
- No hay baseline individual.
- No hay rolling baseline por jugador.
- No hay percentiles.
- Se trabaja con valores absolutos y medias simples.

#### Consecuencia analítica
- La comparación actual favorece lectura rápida pero no individualiza bien.
- Un `WS=68` vale lo mismo para todos los jugadores, aunque su baseline personal sea distinto.

### Métricas Extra
- **Scatter WS vs RPE:** compara media de `wellness_score` y media de `RPE` por jugador en el rango.
- **Reporte semanal por jugador:** calcula para Wellness y Carga:
  - media semanal
  - ratio agudo/crónico semanal contra hasta 3 semanas previas
  - monotonía
  - stress
  - variabilidad
- **Color day / intensidad:** usado como metadato visual de la sesión, no como métrica cuantitativa.
- **Home/Away:** existe solo como etiqueta `MD(H)` / `MD(A)`. No hay comparativas agregadas Home vs Away.
- **Intensidad relativa:** no hay métrica formal de intensidad relativa por minuto, por posición o por jugador.
- **Métricas personalizadas existentes:** relativas al estado clínico/funcional del día:
  - molestias reportadas
  - enfermedad
  - sensación hacia próximo entreno
  - entrenamiento previo

## 4. UX/UI & FRICTION CONTROL

### Flujo de Entrada

#### Jugador
1. Abre la app.
2. Selecciona modo `Jugador`.
3. Selecciona su nombre.
4. Introduce PIN.
5. Entra al home del jugador.
6. Ve si existe sesión del día.
7. Pulsa `Wellness` o `RPE`.
8. Completa el formulario.
9. Envía.

#### Número de interacciones
- **Login jugador:** 3-4 interacciones.
  - seleccionar modo
  - elegir nombre
  - escribir PIN
  - enviar
- **Wellness:** alto coste de interacción.
  - 5 escalas tipo Likert
  - horas de sueño
  - molestias por zonas
  - enfermedad
  - sensación próximo entreno
  - entrenamiento previo
  - comentarios opcionales
  - enviar
- **RPE:** coste bajo/moderado.

#### Fricción actual
- El home del jugador simplifica el acceso a las dos tareas del día.
- El formulario Wellness es rico pero largo.
- No existe autoguardado, borrador ni recuperación tras error de red.
- No existe cola offline.

### Visualización
- El dashboard del preparador usa patrones de color y resumen para identificar casos problemáticos.
- Hay enfoque parcial de **gestión por excepción**:
  - colores de intensidad
  - badges
  - tablas con valores destacados
  - scatter plot para adaptación de carga
  - datos diarios con contexto `MD`
- No existe sistema formal de alertas automáticas, umbrales configurables, notificaciones o ranking de riesgo clínico.
- La excepción se interpreta visualmente, no como motor de alertado.

### Diseño Sistémico
- No hay Design System formal.
- Sí hay una capa ligera de patrones reutilizados:
  - `card`
  - `btn-primary`
  - `btn-secondary`
  - badges y estilos repetidos
  - componentes de gráficos reutilizables
- El diseño actual es consistente a nivel visual, pero no está tokenizado ni gobernado por librería de componentes.

## 5. DEUDA TÉCNICA Y BACKLOG

### Bugs/Bloqueos

#### 1. Modelo de datos incompleto para operación real
- No existen `teams`, `injuries`, `fixtures`, `positions` ni memberships.
- El sistema está acoplado de facto a un único equipo (`DH ÉLITE`) y a un único coach lógico.
- Impacto:
  - impide multiequipo real
  - impide comparativas por plantilla
  - impide trazabilidad clínica estructurada

#### 2. Persistencia frágil en cliente
- Los formularios críticos no tienen borrador local ni retry.
- Un fallo de red hace perder la entrada del jugador.
- Impacto:
  - mala UX
  - menor tasa de cumplimiento
  - riesgo operativo en recogida diaria

#### 3. Motor de métricas con simplificaciones fuertes
- ACWR usa medias sobre registros existentes, no sobre calendario completo.
- MD+/- se calcula por partido más cercano, sin modelo real de fixture cuando hay 2 partidos en la misma semana.
- Wellness no tiene baseline individual ni normalización.
- Impacto:
  - interpretación menos robusta
  - riesgo de conclusiones erróneas en microciclos complejos

### Escalabilidad

#### Qué falta para soportar 10 equipos en lugar de 1
- **Modelo multi-tenant real**
  - tabla `teams`
  - tabla `team_memberships`
  - ownership explícito coach-team
  - aislamiento por tenant en todas las consultas
- **Replantear auth**
  - hoy el coach se resuelve casi como cuenta única
  - hace falta login por usuario coach, permisos y scoping por equipo
- **Normalización de dominio**
  - `injuries`
  - `fixtures`
  - `positions`
  - `session_templates`
  - quizá `microcycles`
- **DB más robusta**
  - SQLite puede aguantar bajo volumen, pero para 10 equipos conviene PostgreSQL
  - índices por `team_id`, `player_id`, `date`
  - constraints únicos formales, por ejemplo `(player_id, date)` para wellness/rpe
- **Capa de datos**
  - reducir N+1 en dashboard
  - añadir agregaciones SQL más densas
  - cache selectiva para lecturas pesadas
- **Cliente**
  - React Query/SWR
  - retry y cache de consultas
  - drafts locales para formularios
- **Observabilidad**
  - logs estructurados
  - métricas de errores
  - trazabilidad de submissions
- **Seguridad**
  - eliminar `JWT secret` fallback hardcoded
  - no guardar PIN de jugador en claro
  - rotación de secretos y configuración por entorno

## Conclusión
- La aplicación está bien orientada para un piloto de un solo equipo, con stack simple y coste operativo bajo.
- La lógica de negocio principal existe y es usable: sesiones, wellness, RPE, dashboard, semanas y contexto MD.
- El cuello de botella no está en el frontend visual sino en la capa de modelo y en la robustez analítica:
  - esquema infra-modelado
  - ausencia de persistencia offline/drafts
  - métricas simplificadas para escenarios complejos
- Antes de escalar, el orden correcto es:
  1. normalizar dominio
  2. asegurar persistencia/fiabilidad
  3. endurecer engine de métricas
  4. migrar a arquitectura multi-equipo real
