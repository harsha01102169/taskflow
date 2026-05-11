# TaskFlow — Team Task Manager

A full-stack web app for managing projects, assigning tasks, and tracking progress with role-based access control.

**Live Demo:** https://taskflow-production-7d5b.up.railway.app/

---

## Features

- **Authentication** — Signup / Login with JWT tokens
- **Role-Based Access Control** — Admin and Member roles enforced at the API level
- **Project Management** — Create projects, add members, manage teams
- **Task Management** — Create, assign, and track tasks with priorities and due dates
- **Dashboard** — Live stats: total, todo, in-progress, done, overdue
- **Overdue Detection** — Automatically flags tasks past their due date

## Role Permissions

| Feature | Admin | Member |
|---|---|---|
| Create projects | ✅ | ❌ |
| Delete projects | ✅ | ❌ |
| Add members to project | ✅ | ❌ |
| Create tasks | ✅ | ❌ |
| Edit tasks | ✅ | ❌ |
| Delete tasks | ✅ | ❌ |
| Update own task status | ✅ | ✅ |
| View dashboard | ✅ | ✅ |
| View assigned projects | ✅ | ✅ |
| Manage user roles | ✅ | ❌ |

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript (no frameworks)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT (JSON Web Tokens) + bcrypt password hashing
- **Deployment:** Railway

## Project Structure

```
taskflow/
├── backend/
│   ├── db/
│   │   └── index.js        # DB connection + auto schema creation
│   ├── middleware/
│   │   └── auth.js         # JWT verification + role checking
│   ├── routes/
│   │   ├── auth.js         # POST /api/auth/signup, /login
│   │   ├── projects.js     # CRUD for projects + members
│   │   ├── tasks.js        # CRUD for tasks + dashboard stats
│   │   └── users.js        # User management
│   ├── server.js           # Express app entry point
│   └── package.json
├── frontend/
│   ├── css/style.css       # All styles
│   ├── js/app.js           # All frontend logic
│   └── index.html          # Single page app
├── railway.toml            # Railway deployment config
└── README.md
```

## REST API Endpoints

### Auth
```
POST /api/auth/signup    — Register new user
POST /api/auth/login     — Login, returns JWT
```

### Projects
```
GET    /api/projects          — List projects (filtered by role)
POST   /api/projects          — Create project [Admin only]
GET    /api/projects/:id      — Get project + members
PUT    /api/projects/:id      — Update project [Admin only]
DELETE /api/projects/:id      — Delete project [Admin only]
POST   /api/projects/:id/members        — Add member [Admin only]
DELETE /api/projects/:id/members/:uid   — Remove member [Admin only]
```

### Tasks
```
GET    /api/tasks              — List tasks (filtered by role)
GET    /api/tasks/stats        — Dashboard stats
GET    /api/tasks/project/:id  — Tasks for a project
POST   /api/tasks              — Create task [Admin only]
PUT    /api/tasks/:id          — Update task (Admin: full; Member: status only)
DELETE /api/tasks/:id          — Delete task [Admin only]
```

### Users
```
GET /api/users            — List all users [Admin only]
GET /api/users/me         — Get own profile
PUT /api/users/:id/role   — Change role [Admin only]
```

---

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL running locally

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow

# 2. Install dependencies
cd backend
npm install

# 3. Set environment variables
cp .env.example .env
# Edit .env with your local PostgreSQL credentials

# 4. Start the server
npm start
# or for development with auto-reload:
npm run dev

# 5. Open in browser
# http://localhost:3000
```

---

## Deployment on Railway

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/taskflow.git
git push -u origin main
```

### Step 2 — Create Railway project
1. Go to [railway.app](https://railway.app) and sign up
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `taskflow` repository

### Step 3 — Add PostgreSQL database
1. In your Railway project, click **+ New**
2. Select **Database** → **PostgreSQL**
3. Railway will automatically create the database

### Step 4 — Set environment variables
In Railway → your service → **Variables**, add:
```
JWT_SECRET=pick_any_long_random_string_here
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}   ← Railway fills this automatically
```

### Step 5 — Deploy
Railway auto-deploys on every push to main. Your app will be live in ~2 minutes.

To get your live URL: Railway project → your service → **Settings** → **Domains** → Generate Domain.

---

## Database Schema

```sql
users (id, name, email, password, role, created_at)
projects (id, name, description, owner_id, created_at)
project_members (id, project_id, user_id)
tasks (id, title, description, status, priority, due_date, project_id, assignee_id, created_by, created_at)
```

Tables are created automatically on first server start. No manual migration needed.

---

## Security

- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens expire after 7 days
- All API routes protected by authentication middleware
- Role checks enforced server-side on every sensitive route
- HTML output escaped to prevent XSS
