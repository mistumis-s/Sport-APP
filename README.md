# DH Élite — Sport Performance Tracker

## Requisitos
- Node.js v22+ (tienes v24 ✅)

## Arrancar la app

**Terminal 1 — Backend:**
```
cd backend
npm install
npm run dev
```
→ API en `http://localhost:3001`

**Terminal 2 — Frontend:**
```
cd frontend
npm install
npm run dev
```
→ App en `http://localhost:3000`

---

## Credenciales por defecto

| Rol | Acceso |
|-----|--------|
| Preparador | Contraseña: `coach123` |
| Jugador | Selecciona nombre + PIN: `1234` |

---

## Flujo de uso

### Jugador (móvil)
1. Login → nombre + PIN
2. Antes del entreno → **Wellness** (fatiga, sueño, estrés, motivación, daño muscular)
3. Después del entreno → **RPE** (0-10 + comentarios)

### Preparador (ordenador)
1. Crear sesión → fecha, MD type, color day, minutos
2. Dashboard → WS equipo, RPE, sRPE en el tiempo
3. Jugadores → estado diario + A/C ratio
4. Jugador individual → wellness, carga, asimilación

---

## Métricas

| Métrica | Fórmula |
|---------|---------|
| Wellness Score | `(fatiga×0.3 + sueño×0.2 + estrés×0.05 + motivación×0.05 + daño×0.4) × 20` |
| sRPE | `RPE × minutos_sesión` |
| A/C Ratio | `avg_sRPE_7d / avg_sRPE_28d` |
| Monotonía | `media_sRPE_semana / desv_std_sRPE_semana` |
| Stress | `carga_total × monotonía` |
