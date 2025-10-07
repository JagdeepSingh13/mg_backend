import mongoose from "mongoose";
import { app } from "./app.js";
const PORT = 5000;
const MONGO_URI =
  "mongodb+srv://jagdeeps3105:jagdeeps3105@cluster0.oitrx8g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB connection error:", err));
