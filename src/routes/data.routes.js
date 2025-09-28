import { Router } from "express";
import {
  uploadCSV,
  fetchData,
  fetchMap,
  siteTimeline,
  getOverview,
} from "../controllers/data.controllers.js";

const router = Router();

// Upload CSV data
router.post("/upload", uploadCSV);

// Fetch all data from DB
router.get("/site/:siteCode", fetchData);

router.get("/map/:state", fetchMap);

router.get("/timeline/:siteCode", siteTimeline);

router.get("/overview", getOverview);

export default router;
