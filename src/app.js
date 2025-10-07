import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import multer from "multer";
import dataRoutes from "./routes/data.routes.js";
import userRouter from "./routes/user.routes.js";
import siteRoutes from "./routes/siteroutes.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5176",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:5175",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// ✅ Example GET route for testing
app.get("/api/v1/hello", (req, res) => {
  console.log("hello from hello route");
  res.json({ message: "Hello World from backend!" });
});

// ✅ Test route for file upload
const upload = multer({ dest: "public/temp/" });
app.post("/api/v1/test-upload", upload.fields([{ name: "avatar", maxCount: 1 }]), (req, res) => {
  console.log("=== TEST UPLOAD ROUTE ===");
  console.log("Request body:", req.body);
  console.log("Request files:", req.files);
  res.json({ message: "Upload test successful", body: req.body, files: req.files });
});

app.use("/api/data", dataRoutes);

app.use("/api/sites", siteRoutes);

app.use("/api/v1/users", userRouter);

export { app };
