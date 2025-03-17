// server.js
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const cors = require("cors"); // Import the cors package
const bcrypt = require("bcrypt"); // Import bcrypt
require("dotenv").config(); // Load environment variables

const app = express();
const PORT = 3000;

// Middleware
app.use(
  cors({
    origin: "https://todo-list-three-mauve-12.vercel.app", // Allow only your frontend
    methods: "GET,POST,PATCH,DELETE",
    allowedHeaders: "Content-Type,Authorization",
  })
);
app.use(bodyParser.json());

// Load data from JSON file
const dataFilePath = path.join(__dirname, "db.json");
let data = { users: [], tasks: [] };

// Check if the db.json file exists and load data
if (fs.existsSync(dataFilePath)) {
  const fileData = fs.readFileSync(dataFilePath);
  data = JSON.parse(fileData);
}

let users = data.users; //array of users
let tasks = []; //array of tasks

// Function to save data to JSON file
function saveData() {
  fs.writeFileSync(dataFilePath, JSON.stringify({ users, tasks }, null, 2));
}

// Register a new user
app.post("/register", async (req, res) => {
  const { full_name, email, phone_number, password, remember_me } = req.body;

  // Check if the user already exists (optional)
  const existingUser = users.find((u) => u.email === email);
  if (existingUser) {
    return res.status(400).send("User already exists");
  }

  // Hash the password before storing it
  const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

  // Add the new user to the users array
  users.push({ full_name, email, phone_number, password: hashedPassword });
  saveData(); // Save data to file
  res.status(201).send("User registered");
});

// Login a user
app.post("/login", async (req, res) => {
  const { email, password, remember_me } = req.body;
  const user = users.find((u) => u.email === email);

  if (user) {
    // Check if the password is correct
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      // Generate a JWT token
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: remember_me ? "7d" : "1h",
      });
      // Send the token, full name, and email back to the client
      res.json({
        token,
        full_name: user.full_name, // Include full name
        email: user.email, // Include email
      });
    } else {
      res.status(401).send("Incorrect password"); // Password is incorrect
    }
  } else {
    res.status(401).send("Email not found"); // Email is not registered
  }
});

// Middleware to verify the token
function authenticateToken(req, res, next) {
  const token =
    req.headers["authorization"] && req.headers["authorization"].split(" ")[1];
  if (!token) return res.sendStatus(401); // No token provided

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token
    req.user = user; // Save user info to request
    next(); // Proceed to the next middleware or route handler
  });
}

// Add a task (protected route)
app.post("/tasks", authenticateToken, (req, res) => {
  const { task } = req.body;
  tasks.push(task);
  saveData(); // Save data to file
  res.status(201).send("Task added");
});

// Get all tasks (protected route)
app.get("/tasks", authenticateToken, (req, res) => {
  res.json(tasks);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
