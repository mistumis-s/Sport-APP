# Metrics Dictionary

## Alcance auditado

- Frontend dashboard: `frontend/src/pages/coach/CoachDashboard.jsx`
- Frontend ficha de jugador activa: `frontend/src/pages/coach/PlayerDetail.jsx`
- Backend servicio de persistencia: `backend/src/services/dbService.js`
- Backend fuente real de agregados: `backend/routes/dashboard.js`
- Backend cálculo base de wellness: `backend/db.js`

Nota: `PlayerCard.jsx` no existe en el código actual. El componente equivalente en producción es `PlayerDetail.jsx`, que es el que se ha auditado.

## Resumen ejecutivo

- `dbService.js` calcula dos métricas base al persistir datos:
  - `wellness_score`
  - `srpe`
- Los agregados de equipo e individuales no se calculan en `dbService.js`; se calculan en `backend/routes/dashboard.js`.
- El Dashboard y la ficha del jugador no usan exactamente la misma lógica para medias de periodo y ventanas temporales.

## Diccionario de métricas

| Métrica | Fórmula Matemática | Lógica de Negocio | Criterio de Inclusión |
| --- | --- | --- | --- |
| Wellness Score individual (`wellness_score`) | $WS = (0.30 \cdot fatiga + 0.20 \cdot sueño + 0.05 \cdot estrés + 0.05 \cdot motivación + 0.40 \cdot daño)\cdot 20$ | Resume el estado diario del jugador en una escala práctica 20-100. Se calcula al guardar el wellness. | Solo existe si el jugador envía wellness. Si no responde, no hay fila y queda excluido de cualquier media SQL posterior. |
| Wellness por subcategoría individual | Valor absoluto capturado en formulario: `fatiga`, `sueno_calidad`, `estres`, `motivacion`, `dano_muscular` | La ficha del jugador muestra el valor bruto diario de cada dimensión, sin normalización adicional. | Solo se muestra si existe envío de wellness para esa fecha. No hay imputación de ceros. |
| Wellness Score medio del equipo por día (`avg_ws`) | $\text{AVG}(wellness\_score)$ por `date` | Mide el estado medio del grupo en esa fecha. Se usa en tarjetas, gráficas y tabla diaria del dashboard. | Incluye solo a jugadores que sí enviaron wellness ese día. Jugadores sin respuesta quedan fuera del denominador. Si no hay datos, el backend no genera media; el frontend puede rellenar la gráfica con `0` solo para continuidad visual. |
| Subcategorías wellness medias del equipo por día (`avg_fatiga`, `avg_sueno`, `avg_estres`, `avg_motivacion`, `avg_dano`) | $\text{AVG}(campo)$ por `date` | Permite ver qué componente está moviendo el wellness del equipo. | Incluye solo respuestas existentes de wellness en esa fecha. No hay relleno de `0` para subcategorías; los días vacíos quedan `null`. |
| RPE individual | Valor absoluto enviado por el jugador | Es la percepción subjetiva del esfuerzo de la sesión. | Solo existe si el jugador envía RPE. Si no responde, no hay fila. |
| RPE medio del equipo por día (`avg_rpe`) | $\text{AVG}(rpe)$ por `date` | Resume la dureza subjetiva media del día a nivel equipo. | Incluye solo jugadores que sí enviaron RPE ese día. Días sin datos pueden representarse como `0` solo en gráfica, no en SQL. |
| sRPE individual (`srpe`) | $sRPE = RPE \times minutos\_sesión$ | Convierte la percepción subjetiva en carga interna usando la duración de la sesión. | Solo se calcula si el registro RPE llega con `session_id` y la sesión existe. Si no hay sesión asociada, `srpe = null`. |
| sRPE medio del equipo por día (`avg_srpe`) | $\text{AVG}(srpe)$ por `date` | Resume la carga interna media del grupo en la sesión del día. | Solo incluye RPE con `srpe != null`, es decir, respuestas vinculadas a una sesión con duración. |
| Respuestas wellness del día (`responses_w`) | $\text{COUNT}(*)$ sobre `wellness` por `date` | Indica cuántos jugadores han contestado wellness ese día. | Cuenta solo respuestas existentes. No cuenta ausencias ni descansos. |
| Respuestas RPE del día (`responses_r`) | $\text{COUNT}(*)$ sobre `rpe` por `date` | Indica cuántos jugadores han contestado RPE ese día. | Cuenta solo respuestas existentes. |
| Promedio del periodo en Dashboard (`periodSummary.avg_ws`, `avg_rpe`, `avg_srpe`) | $\text{media}(valores \neq null \land valores \neq 0)$ | Resume el periodo activo del dashboard (`7d`, `14d`, `28d` o semana seleccionada). | Excluye explícitamente `null` y también excluye `0`. Esto evita que el zero-fill gráfico baje la media, pero también elimina un `RPE=0` real si existiera. |
| Participación del periodo en Dashboard | $\text{media}(responses\_w \neq 0)$ redondeada, mostrada como `X/total_players` | Estima la participación media en wellness durante el periodo visible. | Excluye días con `responses_w = 0`. Por tanto no penaliza días sin respuesta al calcular la media de participación. |
| Promedio del periodo en ficha de jugador (`periodAvg`) | $\text{media}(valores \neq null)$ | Resume las últimas `1`, `2`, `4` u `8` semanas del jugador para `WS`, `RPE` y `sRPE`. | Excluye `null`, pero no excluye `0`. Si existiera un `RPE=0`, sí entraría en la media del jugador. |
| A/C Ratio individual (`metrics.ac`) | $\frac{\text{AVG}(sRPE\ últimos\ 7\ días\ incl.)}{\text{AVG}(sRPE\ últimos\ 28\ días\ incl.)}$ redondeado a 2 decimales | Mide el equilibrio entre carga reciente y carga de base del jugador. | Usa solo filas con `srpe != null`. Los días sin entrenamiento o sin respuesta no se convierten en `0`; simplemente no entran. La ventana real actual es inclusiva y equivale a 8 días para agudo y 29 días para crónico. |
| Monotonía individual (`metrics.monotony`) | $\frac{\text{media}(sRPE\ semana\ actual)}{\sigma(sRPE\ semana\ actual)}$ | Detecta semanas planas y repetitivas. | Solo usa días de la semana actual con `srpe != null`. Los descansos o no respuestas quedan fuera. Si la desviación estándar es `0`, devuelve `null`. |
| Carga semanal individual (`metrics.totalLoad`) | $\sum sRPE\ semana\ actual$ | Cuantifica la carga interna acumulada del jugador en la semana actual. | Solo suma `srpe` no nulos. No añade `0` por descansos. |
| Stress individual (`metrics.stress`) | $\text{Carga semanal} \times \text{Monotonía}$ | Estima el estrés total de la semana a partir de carga acumulada y repetición. | Solo existe si existe monotonía válida. Se redondea a entero. |
| Variabilidad individual (`metrics.variability`) | $\sigma(sRPE\ semana\ actual)$ | Mide cuánto varía la carga diaria dentro de la semana. | Solo usa `srpe` no nulos de la semana actual. Si solo hay un valor, devuelve `null`. |
| WS semanal en tabla de análisis (`weekly_report.rows[].wellness.ws`) | $\text{media}(WS\ desde\ currentWeekStart)$ redondeada a entero | Resume el wellness medio del jugador en la semana analizada según la tabla semanal. | Incluye solo `wellness_score != null`. En el código actual no tiene límite superior de fin de semana, así que para semanas históricas incorpora también semanas posteriores. |
| A/C WS semanal (`weekly_report.rows[].wellness.ac`) | $\frac{\text{media semanal actual WS}}{\text{media de hasta 3 semanas previas de WS}}$ | Controla picos o caídas del wellness semanal frente a la línea base reciente. | Las semanas se construyen con buckets por lunes. Solo usa semanas con media no nula. |
| Monotonía WS semanal (`weekly_report.rows[].wellness.monotony`) | $\frac{\text{media}(WS\ semana)}{\sigma(WS\ semana)}$ | Traduce la homogeneidad del wellness semanal. | Solo usa días con `wellness_score != null`. No incorpora descansos como `0`. |
| Stress WS semanal (`weekly_report.rows[].wellness.stress`) | $\text{suma WS semana} \times \text{monotonía WS}$ | Estima el estrés acumulado del bloque semanal de wellness. | Solo existe si la monotonía no es `null`. Se redondea a entero en la tabla. |
| Variabilidad WS semanal (`weekly_report.rows[].wellness.variability`) | $\sigma(WS\ semana)$ | Mide dispersión del wellness dentro de la semana. | Solo usa días con `wellness_score != null`. |
| RPE semanal en tabla de análisis (`weekly_report.rows[].load.rpe`) | $\text{media}(RPE\ desde\ currentWeekStart)$ redondeada a entero | Resume el esfuerzo subjetivo medio del jugador en la semana analizada. | Solo usa `rpe != null`. Igual que en WS semanal, no tiene tope por `week_end` en el código actual. |
| A/C sRPE semanal (`weekly_report.rows[].load.ac`) | $\frac{\text{media semanal actual sRPE}}{\text{media de hasta 3 semanas previas de sRPE}}$ | Detecta picos de carga semanal frente a la referencia de semanas previas. | Solo usa semanas con `srpe != null`. |
| Monotonía sRPE semanal (`weekly_report.rows[].load.monotony`) | $\frac{\text{media}(sRPE\ semana)}{\sigma(sRPE\ semana)}$ | Mide homogeneidad de la carga interna semanal. | Solo usa días con `srpe != null`. Descansos/no respuestas no cuentan como `0`. |
| Stress sRPE semanal (`weekly_report.rows[].load.stress`) | $\text{suma sRPE semana} \times \text{monotonía sRPE}$ | Representa el estrés total de carga semanal. | Solo existe si monotonía no es `null`. Se redondea a entero. |
| Variabilidad sRPE semanal (`weekly_report.rows[].load.variability`) | $\sigma(sRPE\ semana)$ | Mide variación interna de la carga de la semana. | Solo usa días con `srpe != null`. |
| Scatter WS vs RPE del Dashboard | Para cada jugador: $(\text{AVG}(WS), \text{AVG}(RPE))$ en el rango activo | Posiciona a cada jugador en cuadrantes de asimilación de carga. | Solo entran jugadores que tengan ambas medias disponibles en el rango. |
| Scatter WS vs RPE de la ficha del jugador | Para cada fecha: $(WS\ del\ día, RPE\ del\ día)$ | Permite ver la relación diaria entre bienestar y esfuerzo del jugador. | Solo entran días donde exista wellness y también RPE para la misma fecha. |

## Manejo de ceros y nulos

### Dashboard del coach

- La serie visual se rellena con `0` en `avg_ws`, `avg_rpe` y `avg_srpe` para no romper las gráficas.
- Ese zero-fill ocurre en frontend, después del merge.
- Las tarjetas resumen del periodo no usan esos `0` visuales: usan `teamData.timeline` y excluyen `0` y `null`.
- Las subcategorías wellness no se rellenan con `0`; en días vacíos permanecen `null`.

### Ficha del jugador

- No existe zero-fill por día.
- Las medias por periodo excluyen `null`, pero incluyen `0` si existiera un dato real con valor cero.

### Backend

- Las medias SQL (`AVG`) solo usan filas existentes.
- Un jugador sin respuesta no aporta `0`; simplemente desaparece del cálculo.
- Los descansos tampoco entran como `0` en `A/C`, monotonía, stress o variabilidad.

## BUG TO FIX

### 1. Dashboard y ficha del jugador no tratan igual los ceros

- Dashboard: `averageExcludingZeros()` excluye `0` y `null`.
- Ficha del jugador: `periodAvg()` excluye `null`, pero no `0`.

Impacto:

- Un `RPE = 0` o `sRPE = 0` real entraría en la media del jugador, pero no en la media del dashboard.
- Hoy mismo ambas pantallas pueden dar medias distintas con el mismo histórico.

### 2. La ventana temporal del jugador es un día más larga de lo que indica la UI

- `PlayerDetail.jsx` calcula `since = now - days * 86400000` y luego filtra `date >= since`.
- Para `1 semana`, el rango efectivo es de 8 días inclusivos.
- Para `4 semanas`, el rango efectivo es de 29 días inclusivos.

Impacto:

- La etiqueta visual dice `1`, `2`, `4` u `8` semanas, pero la media real usa `N*7 + 1` días.

### 3. La tabla semanal del Dashboard no corta en `week_end`

- `buildWeeklyPlayerReport()` usa:
  - `row.date >= currentWeekStart`
  - no usa `row.date <= currentWeekEnd`
- Esto afecta a:
  - `wellness.ws`
  - `load.rpe`
  - `wellness.monotony`
  - `wellness.stress`
  - `wellness.variability`
  - `load.monotony`
  - `load.stress`
  - `load.variability`

Impacto:

- Si se selecciona una semana histórica, la fila semanal del jugador mezcla esa semana con semanas posteriores.
- La métrica visible como "semanal" no es realmente semanal en ese escenario.

### 4. Diferencia de precisión entre Dashboard y ficha del jugador

- Dashboard periodo:
  - `RPE` se muestra con 1 decimal.
  - `sRPE` se redondea a entero.
- Ficha del jugador:
  - `RPE` se redondea a entero en la tabla de medias.
  - `sRPE` también se redondea a entero.

Impacto:

- No cambia la lógica base, pero sí la lectura comparativa entre pantallas.

## Recomendación técnica inmediata

1. Unificar una sola función de media para frontend:
   - decidir si `0` es dato válido o ausencia
   - reutilizar la misma función en Dashboard y PlayerDetail
2. Corregir las ventanas inclusivas:
   - `7d` debe ser exactamente 7 días
   - `4 semanas` deben ser exactamente 28 días
3. Corregir `buildWeeklyPlayerReport()` para acotar por `week_end`
4. Definir explícitamente si descansos deben contarse como `0` en monotonía y A/C, porque hoy quedan excluidos por implementación
