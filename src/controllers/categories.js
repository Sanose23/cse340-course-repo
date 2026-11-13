import { getAllCategories, getCategoryDetails } from '../models/categories.js';
import { getProjectsByCategoryId } from '../models/projects.js';

const showCategoriesPage = async (req, res) => {
  const categories = await getAllCategories();
  const title = 'Service Project Categories';
  res.render('categories', { title, currentPath: '/categories', categories });
};

const showCategoryDetailsPage = async (req, res) => {
  const categoryId = req.params.id;
  if (!/^\d+$/.test(categoryId)) {
    const error = new Error('Service category not found');
    error.status = 404;
    throw error;
  }
  const category = await getCategoryDetails(categoryId);
  if (!category) {
    const error = new Error('Service category not found');
    error.status = 404;
    throw error;
  }
  const projects = await getProjectsByCategoryId(categoryId);
  const title = category.name;
  res.render('category', { title, currentPath: '/categories', category, projects });
};

export { showCategoriesPage, showCategoryDetailsPage };
