# Todo API with Authentication

## Overview
This is a simple Node.js Express server that provides user authentication and task management functionality. It supports user registration, login with JWT-based authentication, and CRUD operations for tasks.

## Features
- User registration with hashed passwords (bcrypt)
- User login with JWT authentication
- Token-based authentication for protected routes
- Task management (add and retrieve tasks)
- Persistent data storage using a JSON file
- CORS enabled for cross-origin requests

## Technologies Used
- Node.js
- Express.js
- bcrypt (for password hashing)
- JSON Web Tokens (JWT) for authentication
- dotenv (for environment variable management)
- cors (to enable cross-origin requests)

## Installation

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add the following environment variable:
   ```env
   JWT_SECRET=your_secret_key
   ```

4. Start the server:
   ```bash
   node server.js
   ```
   The server will run on `http://localhost:3000`.

## API Endpoints

### User Authentication

#### Register a New User
- **Endpoint:** `POST /register`
- **Description:** Creates a new user with hashed password.
- **Request Body:**
  ```json
  {
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone_number": "1234567890",
    "password": "securepassword",
    "remember_me": true
  }
  ```
- **Response:** `201 Created` if successful, or `400 Bad Request` if the email is already registered.

#### User Login
- **Endpoint:** `POST /login`
- **Description:** Authenticates user and returns a JWT token.
- **Request Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword",
    "remember_me": true
  }
  ```
- **Response:**
  ```json
  {
    "token": "your_jwt_token",
    "full_name": "John Doe",
    "email": "john@example.com"
  }
  ```
- **Error Codes:**
  - `401 Unauthorized` if email or password is incorrect.

### Task Management (Protected Routes)

#### Add a Task
- **Endpoint:** `POST /tasks`
- **Authentication Required:** Yes (JWT Token in `Authorization` header)
- **Request Body:**
  ```json
  {
    "task": "Complete Vue.js project"
  }
  ```
- **Response:** `201 Created` if successful.

#### Get All Tasks
- **Endpoint:** `GET /tasks`
- **Authentication Required:** Yes (JWT Token in `Authorization` header)
- **Response:**
  ```json
  [
    "Complete Vue.js project",
    "Write API documentation"
  ]
  ```

## Authentication Middleware
The `authenticateToken` middleware checks if a valid JWT token is provided before accessing protected routes.

## Notes
- Ensure the `db.json` file exists in the project directory to store user and task data.
- If the file does not exist, it will be created automatically when data is saved.

## License
This project is licensed under the MIT License.

