import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  const title = 'Home';
  res.render('home', { title });
});

app.get('/organizations', (req, res) => {
  const title = 'Organizations';
  res.render('organizations', { title });
});

app.get('/projects', (req, res) => {
  const title = 'Service Projects';
  res.render('projects', { title });
});

app.get('/categories', (req, res) => {
  const title = 'Service Project Categories';
  res.render('categories', { title });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
