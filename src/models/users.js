import bcrypt from 'bcrypt';
import db from './db.js';

const createUser = async (name, email, passwordHash) => {
  const query = `
    INSERT INTO users (name, email, password_hash, role_id)
    VALUES ($1, $2, $3, (SELECT role_id FROM roles WHERE role_name = 'user'))
    RETURNING user_id;
  `;
  const result = await db.query(query, [name, email, passwordHash]);
  if (result.rowCount !== 1) throw new Error('Failed to create user');
  return result.rows[0].user_id;
};

const findUserByEmail = async (email) => {
  const query = `
    SELECT u.user_id, u.name, u.email, u.password_hash, r.role_name
    FROM users AS u
    JOIN roles AS r ON r.role_id = u.role_id
    WHERE u.email = $1;
  `;
  const result = await db.query(query, [email]);
  return result.rows[0] || null;
};

const authenticateUser = async (email, password) => {
  const user = await findUserByEmail(email);
  if (!user || !await bcrypt.compare(password, user.password_hash)) return null;
  return { user_id: user.user_id, name: user.name, email: user.email, role_name: user.role_name };
};

const getAllUsers = async () => {
  const query = `
    SELECT u.user_id, u.name, u.email, r.role_name, u.created_at
    FROM users AS u
    JOIN roles AS r ON r.role_id = u.role_id
    ORDER BY u.name, u.email, u.user_id;
  `;
  const result = await db.query(query);
  return result.rows;
};

export { createUser, authenticateUser, getAllUsers };
