import { validationResult } from 'express-validator';
import { requireResourceId, notFound } from './identifiers.js';

const pickFormData = (source, fields) => Object.fromEntries(
  fields.filter((field) => typeof source?.[field] === 'string').map((field) => [field, source[field]])
);

const saveFormData = (req, destination, data) => {
  const safeData = Object.fromEntries(Object.entries(data).filter(([field, value]) => (
    typeof value === 'string'
    || (field === 'categoryIds' && Array.isArray(value) && value.every((id) => typeof id === 'string'))
  )));
  req.session.formData ||= {};
  req.session.formData[destination] = safeData;
};

const clearFormData = (req, destination) => {
  if (!req.session.formData || !Object.hasOwn(req.session.formData, destination)) return;
  delete req.session.formData[destination];
  if (Object.keys(req.session.formData).length === 0) delete req.session.formData;
};

const takeFormData = (req, destination, defaults = {}) => {
  const saved = req.session.formData?.[destination];
  clearFormData(req, destination);
  return { ...defaults, ...saved };
};

const redirectWithSession = async (req, res, destination) => {
  await new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return res.redirect(303, destination);
};

const rejectForm = async (req, res, destination, fields, messages) => {
  saveFormData(req, destination, pickFormData(req.body, fields));
  for (const message of messages) req.flash('error', message);
  return redirectWithSession(req, res, destination);
};

const requireRecordId = (value, resource) => requireResourceId(value, resource);

const requireRecord = (record, resource) => {
  if (!record) throw notFound(resource);
  return record;
};

const getFormData = (req, defaults = {}) => takeFormData(req, req.path, defaults);

const rememberFormData = (req, fields) => {
  const formData = pickFormData(req.body, fields);
  if (fields.includes('categoryIds') && Array.isArray(req.body?.categoryIds)) {
    formData.categoryIds = req.body.categoryIds.filter((value) => typeof value === 'string');
  }
  saveFormData(req, req.path, formData);
};

const redirectValidationErrors = async (req, res, fields) => {
  const result = validationResult(req);
  if (result.isEmpty()) return false;
  rememberFormData(req, fields);
  for (const error of result.array({ onlyFirstError: true })) req.flash('error', error.msg);
  await redirectWithSession(req, res, req.path);
  return true;
};

export {
  pickFormData,
  saveFormData,
  clearFormData,
  takeFormData,
  redirectWithSession,
  rejectForm,
  requireRecordId,
  requireRecord,
  getFormData,
  rememberFormData,
  redirectValidationErrors,
};
