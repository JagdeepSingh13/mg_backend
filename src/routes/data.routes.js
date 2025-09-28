import { Router } from "express";
import { uploadCSV } from "../controllers/data.controllers.js";

const router = Router();

router.route("/upload").post(uploadCSV);

export default router;
