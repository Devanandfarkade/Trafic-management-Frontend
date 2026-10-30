import express from "express";
import { getAlertsList } from "../controllers/alertController.js";

const router = express.Router();

router.get("/", getAlertsList);

export default router;
