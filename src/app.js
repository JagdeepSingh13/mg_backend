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
    origin: "*", // allow all origins (you can restrict later)
    credentials: true,
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
