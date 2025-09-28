import { Router } from "express";
import {
  uploadCSV,
  fetchData,
  fetchMap,
  siteTimeline,
} from "../controllers/data.controllers.js";

const router = Router();

// Upload CSV data
router.post("/upload", uploadCSV);

// Fetch all data from DB
router.get("/site/:siteCode", fetchData); // only this

router.get("/map", fetchMap);

router.get("/timeline/:siteCode", siteTimeline);

export default router;
