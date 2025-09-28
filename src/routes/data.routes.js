import { Router } from "express";
import {
  uploadCSV,
  fetchData,
  fetchMap,
  siteTimeline,
  siteComparisons,
} from "../controllers/data.controllers.js";

const router = Router();

// Upload CSV data
router.post("/upload", uploadCSV);

// Fetch all data from DB
router.get("/site/:siteCode", fetchData); // only this

router.get("/map", fetchMap);

router.get("/timeline/:siteCode", siteTimeline);

router.get("/comparison/:siteCodeOne/:siteCodeTwo", siteComparisons);

export default router;
