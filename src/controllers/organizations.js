import { getAllOrganizations, getOrganizationDetails } from '../models/organizations.js';
import { getProjectsByOrganizationId } from '../models/projects.js';

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

export { showOrganizationsPage, showOrganizationDetailsPage };
