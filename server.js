const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

app.use(bodyParser.json());

// Load data from JSON file
const dataFilePath = path.join(__dirname, "db.json");
let data = { users: [], tasks: [], notifications: [] };

// Check if the db.json file exists and load data
if (fs.existsSync(dataFilePath)) {
  try {
    const fileData = fs.readFileSync(dataFilePath);
    data = JSON.parse(fileData);
    console.log("Loaded data from db.json:");
    console.log("Users:", data.users.length);
    console.log("Notifications:", data.notifications.length);
  } catch (error) {
    console.error("Error parsing db.json:", error);
    data = { users: [], tasks: [], notifications: [] };
  }
} else {
  console.log("db.json file not found, creating empty data structure");
  data = { users: [], tasks: [], notifications: [] };
}

let users = data.users; // array of users
let tasks = data.tasks; // This should be data.tasks instead of empty array

// Function to save data to JSON file
function saveData() {
  try {
    console.log("Attempting to save to:", dataFilePath);
    console.log("Current db state - notifications count:", data.notifications.length);

    fs.writeFileSync(
      dataFilePath,
      JSON.stringify(
        {
          users: users,
          tasks: tasks,
          notifications: data.notifications,
        },
        null,
        2
      )
    );
    console.log("Save successful");
  } catch (error) {
    console.error("Error saving to db.json:", error);
  }
}

// Create email transporter with more detailed configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // emilyjonhso@gmail.com
    pass: process.env.EMAIL_PASSWORD, // dbssnneijuryzbpo
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Add verification step
transporter.verify(function (error, success) {
  if (error) {
    console.log("Email server error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

// Example notification types
const NOTIFICATION_TYPES = {
  WELCOME: "welcome",
  TASK_CREATED: "task_created",
  TASK_COMPLETED: "task_completed",
  TASK_DUE: "task_due",
  TASK_OVERDUE: "task_overdue",
  TASK_UPDATED: "task_updated",
  DAILY_SUMMARY: "daily_summary",
};

// Create notification function
function createNotification(userId, type, notifyData) {
  try {
    // Create the notification object
    const notification = {
      id: Date.now().toString(),
      user_id: userId,
      type: type,
      title: "",
      message: "",
      read: false,
      createdAt: new Date().toISOString(),
      isHtml: false,
    };

    // Set notification content based on type
    switch (type) {
      case "welcome":
        notification.title = "Welcome to Taskly!";
        notification.message = `
          <p>Hello ${notifyData.full_name},</p>
          <p>Thank you for joining Taskly! We're excited to have you on board.</p>
          <p>With Taskly, you can:</p>
          <ul>
            <li>Create and manage your daily tasks</li>
            <li>Track your progress</li>
            <li>Stay organized and productive</li>
          </ul>
          <p>Get started by creating your first task!</p>
          <p>Best regards,<br>Taskly Team</p>
        `.trim();
        notification.isHtml = true;
        break;
      case "task_created":
        notification.title = "New Task Created";
        notification.message = `Task "${notifyData.title}" has been created`;
        break;
      case "task_completed":
        notification.title = "Task Completed";
        notification.message = `Task "${notifyData.title}" has been marked as completed`;
        break;
    }

    // THIS IS THE KEY FIX: Update both the file AND the in-memory data
    // Add to in-memory notifications array first
    if (!data.notifications) {
      data.notifications = [];
    }
    data.notifications.push(notification);

    // Then save to file
    saveData();

    console.log("Notification saved successfully");
    console.log("Updated in-memory notifications:", data.notifications.length);
    return notification;
  } catch (error) {
    console.error("Error in createNotification:", error);
    throw error;
  }
}

// Add a function to check for due and overdue tasks
function checkTasksDueStatus() {
  const now = new Date();

  tasks.forEach((task) => {
    if (task.status !== "completed") {
      const dueDate = new Date(task.endDateTime);
      const timeDiff = dueDate - now;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // Check for tasks due in 24 hours
      if (hoursDiff > 0 && hoursDiff <= 24) {
        createNotification(task.user_id, NOTIFICATION_TYPES.TASK_DUE, {
          title: task.title,
        });
      }
      // Check for overdue tasks
      else if (hoursDiff < 0) {
        createNotification(task.user_id, NOTIFICATION_TYPES.TASK_OVERDUE, {
          title: task.title,
        });
      }
    }
  });
}

// Add a function to send daily summary
function sendDailySummary() {
  users.forEach((user) => {
    const userTasks = tasks.filter(
      (task) => task.user_id === user.id && task.status === "pending"
    );

    createNotification(user.id, NOTIFICATION_TYPES.DAILY_SUMMARY, {
      pendingCount: userTasks.length,
    });
  });
}

// Set up periodic checks (every hour for due tasks, daily for summary)
setInterval(checkTasksDueStatus, 1000 * 60 * 60); // Every hour
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 9) {
    // At 9 AM
    sendDailySummary();
  }
}, 1000 * 60 * 60); // Check every hour

// Register a new user
app.post("/register", async (req, res) => {
  try {
    const { full_name, email, phone_number, password, remember_me } = req.body;

    // Check if user exists
    const existingUser = users.find((u) => u.email === email);
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    // Get current users and find the latest ID
    const latestUser = users[users.length - 1];
    let nextNumber = 1;

    if (latestUser) {
      const latestId = latestUser.id;
      const match = latestId.match(/taskly-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Format the new ID with padding
    const newId = `taskly-${String(nextNumber).padStart(3, "0")}`;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add new user
    users.push({
      id: newId,
      full_name,
      email,
      phone_number,
      password: hashedPassword,
      profile_image: null,
    });

    saveData(); // Save to file

    // Send welcome email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome to Taskly!",
      html: `
         <div
      style="font-family: Verdana, sans-serif; max-width: 600px; margin: 0 auto"
    >
      <h2 style="color: #09203e; text-align: center">Welcome to Taskly!</h2>
      <p>Hello <strong>${full_name}</strong>,</p>
      <p>Thank you for joining Taskly! We're excited to have you on board.</p>
      <p>With Taskly, you can:</p>
      <ul>
        <li style="list-style: none; display: flex; align-items: center">
          <span
            ><img
              width="20"
              height="20"
              src="https://img.icons8.com/emoji/20/check-mark-button-emoji.png"
              alt="check-mark-button-emoji"
          /></span>
          Create and manage your daily tasks
        </li>
        <li style="list-style: none; display: flex; align-items: center">
          <span
            ><img
              width="20"
              height="20"
              src="https://img.icons8.com/emoji/20/check-mark-button-emoji.png"
              alt="check-mark-button-emoji"
          /></span>
          Track your progress
        </li>
        <li style="list-style: none; display: flex; align-items: center">
          <span
            ><img
              width="20"
              height="20"
              src="https://img.icons8.com/emoji/20/check-mark-button-emoji.png"
              alt="check-mark-button-emoji"
          /></span>
          Stay organized and productive
        </li>
      </ul>
      <p>Get started by creating your first task!</p>
      <div style="margin: 30px 0">
        <a
          href="${process.env.FRONTEND_URL}/login"
          style="
            background-color: #09203e;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 9px;
          "
        >
          Login to Your Account
        </a>
      </div>
      <p>Best regards,<br />The Taskly Team</p>
    </div>
      `,
    };

    console.log("Attempting to send welcome email to:", email);

    try {
      await transporter.sendMail(mailOptions);
      console.log("Welcome email sent successfully");
    } catch (emailError) {
      console.error("Error sending welcome email:", emailError);
      // Still create the user even if email fails
    }

    // After successful registration and email sending
    const welcomeNotification = createNotification(newId, "welcome", {
      full_name: full_name,
      message: `Hello ${full_name},\n\nThank you for joining Taskly! We're excited to have you on board.\n\nWith Taskly, you can:\n\n✅ Create and manage your daily tasks\n✅ Track your progress\n✅ Stay organized and productive\n\nGet started by creating your first task!`,
    });

    res.status(201).json({
      message: "User registered successfully",
      notification: welcomeNotification,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("Error registering user");
  }
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
        id: user.id, // Include the user ID
        full_name: user.full_name,
        email: user.email,
      });
    } else {
      res.status(401).send("Incorrect password");
    }
  } else {
    res.status(401).send("Email not found");
  }
});

// Middleware to verify the token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log("Token verification error:", err);
      return res.sendStatus(403); // Invalid token
    }

    // Find the full user object from users array
    const fullUser = users.find((u) => u.email === user.email);
    if (!fullUser) {
      console.log("User not found for email:", user.email);
      return res.sendStatus(403);
    }

    req.user = fullUser; // This will include the ID
    next(); // Proceed to the next middleware or route handler
  });
}

// Add a task (protected route)
app.post("/tasks", authenticateToken, (req, res) => {
  try {
    const { task } = req.body;

    if (!task) {
      return res.status(400).json({ error: "Task is required" });
    }

    const newTask = {
      id: Date.now().toString(),
      ...task,
      user_id: req.user.id,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    saveData(); // Save data to file

    // Create notification for new task
    const notification = createNotification(req.user.id, "task_created", {
      title: newTask.title,
    });

    res.status(201).json({
      message: "Task added successfully",
      task: newTask,
      notification: notification,
    });
  } catch (error) {
    console.error("Error adding task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all tasks for the authenticated user (protected route)
app.get("/tasks", authenticateToken, (req, res) => {
  try {
    // Filter tasks to only return ones belonging to the authenticated user
    const userTasks = tasks.filter((task) => task.user_id === req.user.id);
    res.json(userTasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update task status (protected route)
app.patch("/tasks/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const taskIndex = tasks.findIndex(
      (task) => task.id === id && task.user_id === req.user.id
    );

    if (taskIndex === -1) {
      return res.status(404).json({
        error: "Task not found or unauthorized",
      });
    }

    // Update task
    const updatedTask = {
      ...tasks[taskIndex],
      status,
      updatedAt: new Date().toISOString(),
    };
    tasks[taskIndex] = updatedTask;

    // Save to file
    saveData();

    // If task is completed
    if (status === "completed") {
      createNotification(req.user.id, "task_completed", {
        title: updatedTask.title,
      });
    }

    // Return the updated task
    res.json(updatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add a GET route to display a welcome message
app.get("/", (req, res) => {
  res.send("Welcome to the Todo List API!"); // Message displayed on the screen
});

// Add a more thorough endpoint to fetch notifications
app.get("/notifications", authenticateToken, (req, res) => {
  try {
    console.log("Fetching notifications for user:", req.user.id);
    console.log("Current in-memory notifications:", data.notifications.length);
    
    // Debug notifications
    if (data.notifications.length > 0) {
      console.log("First notification:", data.notifications[0]);
    }
    
    const userNotifications = data.notifications.filter(
      (notif) => notif.user_id === req.user.id
    );
    
    console.log(`Found ${userNotifications.length} notifications for user ${req.user.id}`);
    
    res.json(userNotifications);
  } catch (error) {
    console.error("Error in /notifications endpoint:", error);
    res.status(500).json({ error: "Error fetching notifications" });
  }
});

// Add an endpoint to mark a notification as read
app.patch("/notifications/:id", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the notification index
    const notificationIndex = data.notifications.findIndex(
      (notif) => notif.id === id && notif.user_id === req.user.id
    );
    
    if (notificationIndex === -1) {
      return res.status(404).json({
        error: "Notification not found or unauthorized"
      });
    }
    
    // Update notification
    const updatedNotification = {
      ...data.notifications[notificationIndex],
      read: true
    };
    
    data.notifications[notificationIndex] = updatedNotification;
    
    // Save updated data
    saveData();
    
    // Return the updated notification
    res.json(updatedNotification);
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("Server is running fine on Glitch!");
});
