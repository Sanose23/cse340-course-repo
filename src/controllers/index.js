import { getAllOrganizations } from '../models/organizations.js';
import { getAllProjects } from '../models/projects.js';
import { getAllCategories } from '../models/categories.js';

const showHomePage = async (req, res) => {
  const [organizations, projects, categories] = await Promise.all([
    getAllOrganizations(), getAllProjects(), getAllCategories(),
  ]);
  const title = 'Home';
  res.render('home', { title, currentPath: '/', organizations, projects, categories });
};

export { showHomePage };
