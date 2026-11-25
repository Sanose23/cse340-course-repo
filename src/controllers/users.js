import bcrypt from 'bcrypt';
import { body } from 'express-validator';
import { createUser, authenticateUser, getAllUsers } from '../models/users.js';
import { getFormData, rememberFormData, redirectWithSession, redirectValidationErrors } from '../utilities/forms.js';

const registrationFields = ['name', 'email'];
const loginFields = ['email'];
const passwordLength = (value) => typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 7 && Buffer.byteLength(value, 'utf8') <= 72;

const registrationValidation = [
  body('name').custom((value) => typeof value === 'string').withMessage('Name is required').bail().trim().notEmpty().withMessage('Name is required').bail().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').custom((value) => typeof value === 'string').withMessage('Email is required').bail().trim().notEmpty().withMessage('Email is required').bail().isLength({ max: 100 }).withMessage('Email cannot exceed 100 characters').bail().isEmail().withMessage('Enter a valid email address').bail().normalizeEmail(),
  body('password').custom(passwordLength).withMessage('Password must be between 7 and 72 bytes'),
];

const loginValidation = [
  body('email').custom((value) => typeof value === 'string').withMessage('Enter a valid email address').bail().trim().notEmpty().withMessage('Enter a valid email address').bail().isLength({ max: 100 }).withMessage('Enter a valid email address').bail().isEmail().withMessage('Enter a valid email address').bail().normalizeEmail(),
  body('password').custom(passwordLength).withMessage('Invalid email or password'),
];

const regenerateSession = (req) => new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
const destroySession = (req) => new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));

const showUserRegistrationForm = (req, res) => {
  res.render('register', { title: 'Register', currentPath: '/register', formData: getFormData(req) });
};

const processUserRegistrationForm = async (req, res) => {
  if (await redirectValidationErrors(req, res, registrationFields)) return;
  const { name, email, password } = req.body;
  try {
    await createUser(name, email, await bcrypt.hash(password, 10));
  } catch (error) {
    if (error.code !== '23505') throw error;
    req.flash('error', 'An account with that email already exists.');
    rememberFormData(req, registrationFields);
    await redirectWithSession(req, res, '/register');
    return;
  }
  req.flash('success', 'Registration successful! Please log in.');
  await redirectWithSession(req, res, '/login');
};

const showLoginForm = (req, res) => {
  res.render('login', { title: 'Login', currentPath: '/login', formData: getFormData(req) });
};

const processLoginForm = async (req, res) => {
  if (await redirectValidationErrors(req, res, loginFields)) return;
  const user = await authenticateUser(req.body.email, req.body.password);
  if (!user) {
    req.flash('error', 'Invalid email or password.');
    rememberFormData(req, loginFields);
    await redirectWithSession(req, res, '/login');
    return;
  }
  await regenerateSession(req);
  req.session.user = user;
  req.flash('success', 'Login successful!');
  await redirectWithSession(req, res, '/dashboard');
};

const processLogout = async (req, res) => {
  await destroySession(req);
  res.clearCookie('connect.sid', { httpOnly: true, sameSite: 'lax', secure: res.locals.NODE_ENV === 'production' });
  res.redirect(303, '/login');
};

const requireLogin = (req, res, next) => {
  if (req.session?.user) return next();
  req.flash('error', 'You must be logged in to access that page.');
  return redirectWithSession(req, res, '/login').catch(next);
};

const requireRole = (role) => (req, res, next) => {
  if (!req.session?.user) {
    req.flash('error', 'You must be logged in to access that page.');
    return redirectWithSession(req, res, '/login').catch(next);
  }
  if (req.session.user.role_name !== role) {
    req.flash('error', 'You do not have permission to access that page.');
    return redirectWithSession(req, res, '/dashboard').catch(next);
  }
  return next();
};

const showDashboard = (req, res) => res.render('dashboard', { title: 'Dashboard', currentPath: '/dashboard', account: req.session.user });
const showUsersPage = async (req, res) => res.render('users', { title: 'Registered Users', currentPath: '/users', users: await getAllUsers() });

export { showUserRegistrationForm, processUserRegistrationForm, showLoginForm, processLoginForm, processLogout, requireLogin, requireRole, showDashboard, showUsersPage, registrationValidation, loginValidation };
