# TaskFlow — Study Guide
## Plain English explanations for your interview

This guide explains *why* things were built the way they were.
If someone asks you "why did you do X", this has your answer.

---

## 1. Why Node.js + Express for the backend?

Node.js lets you write JavaScript on the server (not just in the browser).
Express is a lightweight framework that makes it easy to define API routes.

**In an interview:** "I chose Node/Express because it's lightweight, widely used in production, and has great support for building REST APIs quickly. It also deploys easily on Railway."

---

## 2. Why PostgreSQL (not MongoDB)?

This app has **relationships** between data:
- A task belongs to a project
- A project has members (users)
- A task is assigned to a user

PostgreSQL is a relational database — it handles these links cleanly using foreign keys.
MongoDB (NoSQL) is better for unstructured data like logs or documents.

**In an interview:** "I chose PostgreSQL because the data is relational — tasks link to projects, projects link to users. SQL handles these relationships with foreign keys and joins, which keeps the data consistent."

---

## 3. What is a REST API?

REST is a standard way for the frontend and backend to communicate using HTTP.

Each URL (called an endpoint) does one thing:
- `GET /api/tasks` → fetch tasks
- `POST /api/tasks` → create a task
- `PUT /api/tasks/5` → update task with id=5
- `DELETE /api/tasks/5` → delete task with id=5

**In an interview:** "A REST API uses HTTP verbs (GET, POST, PUT, DELETE) to define operations on resources. Each endpoint represents a resource and the verb defines what to do with it."

---

## 4. What is JWT and why use it for auth?

JWT = JSON Web Token. When a user logs in, the server creates a token that contains their info (id, name, role) and signs it with a secret key.

The frontend stores this token and sends it with every request.
The server verifies the signature — if it's valid, it trusts the user info inside.

Why not just store the user in a session? Sessions require server-side storage. JWTs are stateless — the server doesn't need to remember anything, which scales better.

**In an interview:** "I used JWT because it's stateless — the server doesn't need to store session data. The token is self-contained: it holds the user's id and role, signed with a secret. Every request includes the token, and the server just verifies the signature."

---

## 5. What is RBAC (Role-Based Access Control)?

RBAC means users get different permissions based on their role.

In this app:
- **Admin** can create/edit/delete projects and tasks, manage users
- **Member** can only view their assigned content and update their task status

The key point: this is enforced **at the API level**, not just in the UI.

Bad RBAC = just hiding buttons in the frontend. Anyone can call the API directly.
Good RBAC = the server checks the role on every sensitive request and rejects unauthorized ones.

**In an interview:** "RBAC is enforced server-side using middleware. When a request hits a protected route, the middleware reads the role from the JWT and returns 403 Forbidden if the role doesn't have permission. Hiding UI elements alone is not enough — the API must enforce it."

---

## 6. What is middleware?

Middleware is a function that runs *between* the incoming request and the route handler.

In this app, `auth.js` has two middleware functions:
- `authenticate` — checks if the JWT token is valid. Runs on all protected routes.
- `requireAdmin` — checks if the user's role is 'admin'. Runs on admin-only routes.

Think of it like a security checkpoint at a door — every request passes through it before reaching the actual code.

**In an interview:** "Middleware is a function that intercepts requests before they reach the route handler. I use it for authentication and authorization — the `authenticate` middleware verifies the JWT on every protected route, and `requireAdmin` additionally checks the role."

---

## 7. Why bcrypt for passwords?

Never store plain text passwords. Ever.

bcrypt is a hashing function that converts a password into a scrambled string. 
It's one-way — you can't reverse it.

When a user logs in, you hash what they typed and compare it to the stored hash.
The "10 salt rounds" means it does 2^10 = 1024 hashing iterations, making it slow to brute-force.

**In an interview:** "Passwords are hashed using bcrypt with 10 salt rounds before storing. bcrypt is slow by design — it makes brute-force attacks impractical. On login, we hash the input and compare it to the stored hash using bcrypt.compare()."

---

## 8. What are foreign keys and why do they matter?

In the database, foreign keys link tables together and enforce consistency.

Example: `tasks.project_id` is a foreign key that references `projects.id`.
This means you can't create a task with a project_id that doesn't exist.
If you delete a project, all its tasks are deleted automatically (CASCADE).

**In an interview:** "Foreign keys enforce referential integrity. A task can't reference a non-existent project. I used ON DELETE CASCADE so deleting a project automatically removes its tasks, keeping the database clean."

---

## 9. Why is the frontend a single HTML file (not React)?

React is powerful but adds complexity. Since the frontend is relatively simple (a few views, modals, API calls), plain HTML/CSS/JS is sufficient and easier to understand.

The app works as a Single Page Application (SPA) — one HTML file, views are shown/hidden with JavaScript. No page reloads needed.

**In an interview:** "I kept the frontend as vanilla JS to reduce complexity and make the codebase easier to review. It's a single-page application — views are toggled with JavaScript, and data is fetched from the API asynchronously."

---

## 10. What does the dashboard stats query do?

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'todo') as todo,
  COUNT(*) FILTER (WHERE status = 'done') as done,
  COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') as overdue
FROM tasks
```

This is one SQL query that counts tasks by different conditions simultaneously.
Much more efficient than making 4 separate queries.

**In an interview:** "The dashboard stats use a single SQL query with conditional aggregation — COUNT() FILTER — to compute all status counts in one database round-trip rather than multiple queries."

---

## Common Interview Questions

**Q: How does a user log in?**
A: They POST their email and password. The server finds the user, compares the password with bcrypt.compare(), generates a JWT with their id/role/name, and returns it. The frontend stores the token in localStorage.

**Q: How does the server know who is making a request?**
A: Every request sends the JWT in the Authorization header. The authenticate middleware extracts it, verifies the signature with the secret key, and attaches the decoded user info to req.user.

**Q: What happens if a member tries to create a project?**
A: The POST /api/projects route has requireAdmin middleware. It reads req.user.role — if it's not 'admin', it immediately returns 403 Forbidden. The actual project creation code never runs.

**Q: How are overdue tasks detected?**
A: In the SQL query, we compare due_date < NOW() (current timestamp) and check that status != 'done'. This is computed in the database, not in JavaScript.

**Q: What's the difference between 401 and 403?**
A: 401 = not authenticated (no token or invalid token). 403 = authenticated but not authorized (valid token, but wrong role).

**Q: Why store JWT in localStorage vs cookies?**
A: localStorage is simpler to implement. Cookies can be more secure (httpOnly flag prevents JS access), but require CSRF protection. For this project, localStorage is sufficient.
