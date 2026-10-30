import express from "express";
import { listCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", listCategories);
router.post("/", express.json(), createCategory);
router.put("/:id", express.json(), updateCategory);
router.delete("/:id", deleteCategory);

export default router;
