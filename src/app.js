import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dataRoutes from "./routes/data.routes.js";
import userRouter from "./routes/user.routes.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

app.use("/api/data", dataRoutes);

app.use("/api/v1/users", userRouter);

export { app };
