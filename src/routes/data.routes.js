import { Router } from "express";
import { handleUpload } from "../controllers/data.controllers.js";

const router = Router();

router.route("/upload").post(handleUpload);

export default router;
