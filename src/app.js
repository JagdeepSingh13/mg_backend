import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dataRoutes from "./routes/data.routes.js";

const app = express();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use("/api/v1/hello", () => {
  console.log("hello from hello route");
});

app.use("/api/data", dataRoutes);

export { app };
