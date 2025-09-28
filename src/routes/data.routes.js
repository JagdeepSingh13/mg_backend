import { Router } from "express";
import { uploadCSV, fetchData } from "../controllers/data.controllers.js";

const router = Router();

// Upload CSV data
router.post("/upload", uploadCSV);

// Fetch all data from DB
router.get("/site/:siteCode", fetchData);  // only this

export default router;
