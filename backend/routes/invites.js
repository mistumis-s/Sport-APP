const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireCoach } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'sport_secret_2024';

function createToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function publicInviteUrl(req, token) {
  const origin = process.env.PUBLIC_APP_URL || `https://${req.get('host')}`;
  return `${origin}/join/${token}`;
}

async function getInvite(token) {
  const { rows: [invite] } = await pool.query(`
    SELECT i.id, i.team_id, i.token, i.role, i.expires_at, t.name AS team_name, t.club_name, t.category
    FROM team_invites i
    JOIN teams t ON t.id = i.team_id
    WHERE i.token=$1
    LIMIT 1
  `, [token]);

  if (!invite) return null;
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null;
  return invite;
}

router.post('/player', requireCoach, async (req, res) => {
  const token = createToken();
  const { rows: [invite] } = await pool.query(`
    INSERT INTO team_invites (team_id, token, role, created_by)
    VALUES ($1, $2, 'player', $3)
    RETURNING token
  `, [req.user.team_id, token, req.user.id]);

  return res.status(201).json({
    token: invite.token,
    url: publicInviteUrl(req, invite.token),
  });
});

router.get('/:token', async (req, res) => {
  const invite = await getInvite(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invitacion no valida' });

  res.json({
    token: invite.token,
    role: invite.role,
    team: {
      id: invite.team_id,
      name: invite.team_name,
      club_name: invite.club_name,
      category: invite.category,
    },
  });
});

router.post('/:token/register', async (req, res) => {
  const invite = await getInvite(req.params.token);
  if (!invite) return res.status(404).json({ error: 'Invitacion no valida' });
  if (invite.role !== 'player') return res.status(400).json({ error: 'Invitacion no valida para jugador' });

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email no valido' });
  if (password.length < 8) return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [existingEmail] } = await client.query(
      'SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1',
      [email]
    );
    if (existingEmail) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const { rows: [existingName] } = await client.query(`
      SELECT u.id
      FROM users u
      JOIN team_memberships tm ON tm.user_id = u.id
      WHERE tm.team_id=$1 AND tm.role='player' AND u.name=$2
      LIMIT 1
    `, [invite.team_id, name.toUpperCase()]);
    if (existingName) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe un jugador con ese nombre en el equipo' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const { rows: [user] } = await client.query(`
      INSERT INTO users (name, email, role, password, team, must_change_password)
      VALUES ($1, $2, 'player', $3, $4, 0)
      RETURNING id, name, email, role
    `, [name.toUpperCase(), email, passwordHash, invite.team_name]);

    await client.query(
      'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
      [user.id, invite.team_id, 'player']
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: user.id, name: user.name, role: 'player', team_id: invite.team_id },
      SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: 'player', team_id: invite.team_id },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'No se pudo registrar el jugador' });
  } finally {
    client.release();
  }
});

module.exports = router;
