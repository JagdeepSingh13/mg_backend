import { app } from "./app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();


const PORT = 5000;
const MONGO_URI = "mongodb+srv://gouravt039:123@cluster0.pkej62h.mongodb.net/yourDBname";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("MongoDB connected");
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
.catch(err => console.error("MongoDB connection error:", err));
