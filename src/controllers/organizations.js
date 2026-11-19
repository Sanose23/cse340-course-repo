import { body } from 'express-validator';
import { stat } from 'node:fs/promises';
import { getAllOrganizations, getOrganizationDetails, createOrganization, updateOrganization } from '../models/organizations.js';
import { getProjectsByOrganizationId } from '../models/projects.js';
import { requireRecordId, requireRecord, getFormData, redirectWithSession, redirectValidationErrors } from '../utilities/forms.js';

const organizationFields = ['name', 'description', 'contactEmail'];

const organizationValidation = [
  body('name')
    .custom((value) => typeof value === 'string').withMessage('Organization name is required').bail()
    .trim().notEmpty().withMessage('Organization name is required').bail()
    .isLength({ min: 3, max: 150 }).withMessage('Organization name must be between 3 and 150 characters'),
  body('description')
    .custom((value) => typeof value === 'string').withMessage('Organization description is required').bail()
    .trim().notEmpty().withMessage('Organization description is required').bail()
    .isLength({ max: 500 }).withMessage('Organization description cannot exceed 500 characters'),
  body('contactEmail')
    .custom((value) => typeof value === 'string').withMessage('Contact email is required').bail()
    .trim().notEmpty().withMessage('Contact email is required').bail()
    .isLength({ max: 255 }).withMessage('Contact email cannot exceed 255 characters').bail()
    .isEmail().withMessage('Please provide a valid email address').bail()
    .normalizeEmail(),
];

const organizationLogoValidation = [
  body('logoFilename')
    .custom((value) => typeof value === 'string').withMessage('Logo filename is required').bail()
    .trim().notEmpty().withMessage('Logo filename is required').bail()
    .isLength({ max: 255 }).withMessage('Logo filename cannot exceed 255 characters').bail()
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|gif|webp|svg)$/i).withMessage('Select a valid image filename from public/images').bail()
    .custom(async (value) => {
      const logo = await stat(new URL(`../../public/images/${value}`, import.meta.url)).catch(() => null);
      if (!logo?.isFile()) throw new Error('Logo filename is not available');
      return true;
    }).withMessage('Select an existing image filename from public/images'),
];

const showOrganizationsPage = async (req, res) => {
  const organizations = await getAllOrganizations();
  const title = 'Our Partner Organizations';
  res.render('organizations', { title, currentPath: '/organizations', organizations });
};

const showOrganizationDetailsPage = async (req, res) => {
  const organizationId = req.params.id;
  if (!/^\d+$/.test(organizationId)) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }
  const organization = await getOrganizationDetails(organizationId);
  if (!organization) {
    const error = new Error('Organization not found');
    error.status = 404;
    throw error;
  }
  const projects = await getProjectsByOrganizationId(organizationId);
  const title = organization.name;
  res.render('organization', { title, currentPath: '/organizations', organization, projects });
};

const showNewOrganizationForm = async (req, res) => {
  const title = 'Add New Organization';
  const formData = getFormData(req);
  res.render('new-organization', { title, currentPath: '/organizations', formData });
};

const processNewOrganizationForm = async (req, res) => {
  if (await redirectValidationErrors(req, res, organizationFields)) return;
  const { name, description, contactEmail } = req.body;
  const organizationId = await createOrganization(name, description, contactEmail, 'placeholder-logo.png');
  req.flash('success', 'Organization added successfully!');
  await redirectWithSession(req, res, `/organization/${organizationId}`);
};

const showEditOrganizationForm = async (req, res) => {
  const organizationId = requireRecordId(req.params.id, 'Organization');
  const organization = requireRecord(await getOrganizationDetails(organizationId), 'Organization');
  const formData = getFormData(req, {
    name: organization.name,
    description: organization.description,
    contactEmail: organization.contact_email,
    logoFilename: organization.logo_filename,
  });
  const title = 'Edit Organization';
  res.render('edit-organization', { title, currentPath: '/organizations', organization, formData });
};

const processEditOrganizationForm = async (req, res) => {
  const organizationId = requireRecordId(req.params.id, 'Organization');
  requireRecord(await getOrganizationDetails(organizationId), 'Organization');
  if (await redirectValidationErrors(req, res, [...organizationFields, 'logoFilename'])) return;
  const { name, description, contactEmail, logoFilename } = req.body;
  await updateOrganization(organizationId, name, description, contactEmail, logoFilename);
  req.flash('success', 'Organization updated successfully!');
  await redirectWithSession(req, res, `/organization/${organizationId}`);
};

export {
  showOrganizationsPage,
  showOrganizationDetailsPage,
  showNewOrganizationForm,
  processNewOrganizationForm,
  showEditOrganizationForm,
  processEditOrganizationForm,
  organizationValidation,
  organizationLogoValidation,
};
