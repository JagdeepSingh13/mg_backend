import express from "express";
import Site from "../models/data.model.js"; // adjust the path if needed

const router = express.Router();

// Fetch all data from database
router.get("/sites", async (req, res) => {
  try {
    const sites = await Site.find({});
    res.json(sites); // send full data as JSON
  } catch (err) {
    res.status(500).json({ error: "Error fetching data" });
  }
});

export default router;
