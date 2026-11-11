BEGIN;

CREATE TABLE organization (
    organization_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    logo_filename VARCHAR(255) NOT NULL
);

CREATE TABLE project (
    project_id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organization (organization_id),
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    date DATE NOT NULL
);

CREATE INDEX project_organization_id_idx ON project (organization_id);

CREATE TABLE category (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE project_category (
    project_id INTEGER NOT NULL REFERENCES project (project_id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES category (category_id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, category_id)
);

CREATE INDEX project_category_category_id_idx ON project_category (category_id);

INSERT INTO organization (name, description, contact_email, logo_filename)
VALUES
('BrightFuture Builders', 'A nonprofit focused on improving community infrastructure through sustainable construction projects.', 'info@brightfuturebuilders.org', 'brightfuture-logo.png'),
('GreenHarvest Growers', 'An urban farming collective promoting food sustainability and education in local neighborhoods.', 'contact@greenharvest.org', 'greenharvest-logo.png'),
('UnityServe Volunteers', 'A volunteer coordination group supporting local charities and service initiatives.', 'hello@unityserve.org', 'unityserve-logo.png');

INSERT INTO project (organization_id, title, description, location, date)
VALUES
(1, 'Park Cleanup', 'Join us to clean up local parks and make them beautiful!', 'Riverside Park, Rexburg', '2026-11-14'),
(1, 'Community Playground Repair', 'Help repair and repaint playground equipment for neighborhood families.', 'Central Playground, Rexburg', '2026-11-21'),
(1, 'Accessible Ramp Build', 'Build an accessible entrance with experienced construction volunteers.', 'Community Center, Rexburg', '2026-11-28'),
(1, 'Neighborhood Beautification', 'Plant flowers and restore shared spaces along neighborhood walkways.', 'Main Street, Rexburg', '2026-12-05'),
(1, 'Winter Shelter Preparation', 'Help prepare a community shelter for cold weather.', 'Hope Shelter, Rexburg', '2026-12-12'),
(2, 'Community Garden Planting', 'Prepare raised beds and plant seasonal crops with local gardeners.', 'GreenHarvest Garden, Rexburg', '2026-11-15'),
(2, 'Food Drive', 'Help collect and distribute food to those in need.', 'GreenHarvest Food Hub, Rexburg', '2026-11-22'),
(2, 'Composting Workshop', 'Teach neighbors how to turn food scraps into healthy garden soil.', 'GreenHarvest Learning Center, Rexburg', '2026-11-29'),
(2, 'School Garden Lessons', 'Help students learn about growing vegetables and caring for plants.', 'Lincoln School Garden, Rexburg', '2026-12-06'),
(2, 'Healthy Harvest Distribution', 'Pack fresh produce and share nutritious meal ideas with local families.', 'Farmers Market Hall, Rexburg', '2026-12-13'),
(3, 'Community Tutoring', 'Volunteer to tutor students in various subjects.', 'Public Library, Rexburg', '2026-11-16'),
(3, 'Senior Companion Visits', 'Spend time with older neighbors through conversation and shared activities.', 'Senior Center, Rexburg', '2026-11-23'),
(3, 'Charity Supply Sorting', 'Organize donated clothing and household supplies for local charities.', 'UnityServe Donation Center, Rexburg', '2026-11-30'),
(3, 'Community Wellness Walk', 'Help host an inclusive walk that encourages movement and connection.', 'Nature Trail, Rexburg', '2026-12-07'),
(3, 'Volunteer Skills Workshop', 'Share practical skills and introduce new volunteers to local service opportunities.', 'UnityServe Meeting Hall, Rexburg', '2026-12-14');

INSERT INTO category (name)
VALUES ('Environmental'), ('Educational'), ('Community Service'), ('Health and Wellness');

INSERT INTO project_category (project_id, category_id)
VALUES
(1, 1), (1, 3),
(2, 3),
(3, 3), (3, 4),
(4, 1), (4, 3),
(5, 3),
(6, 1),
(7, 3),
(8, 1), (8, 2),
(9, 1), (9, 2),
(10, 3), (10, 4),
(11, 2),
(12, 3), (12, 4),
(13, 3),
(14, 3), (14, 4),
(15, 2), (15, 3);

COMMIT;
