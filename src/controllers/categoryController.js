import * as CategoryModel from "../models/categoryModel.js";

export async function listCategories(req, res) {
  try {
    const { isactive } = req.query;
    const activeOnly = isactive !== undefined ? (isactive === 'true' || isactive === true) : null;
    const result = await CategoryModel.getAllCategories(activeOnly);
    return res.status(200).json({ success: true, count: result.rowCount, categories: result.rows });
  } catch (error) {
    console.error("❌ CategoryController.listCategories:", error);
    return res.status(500).json({ success: false, message: "Server error fetching categories", error: error.message });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, description, page_key } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Category name is required" });
    const result = await CategoryModel.createCategory({ name, description, page_key });
    return res.status(201).json({ success: true, message: "Category created successfully", category: result.rows[0] });
  } catch (error) {
    console.error("❌ CategoryController.createCategory:", error);
    return res.status(500).json({ success: false, message: "Server error creating category", error: error.message });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description, page_key, isactive } = req.body;
    const result = await CategoryModel.updateCategory(id, { name, description, page_key, isactive });
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Category not found" });
    return res.status(200).json({ success: true, message: "Category updated successfully", category: result.rows[0] });
  } catch (error) {
    console.error("❌ CategoryController.updateCategory:", error);
    return res.status(500).json({ success: false, message: "Server error updating category", error: error.message });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const result = await CategoryModel.deleteCategory(id);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: "Category not found" });
    return res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("❌ CategoryController.deleteCategory:", error);
    return res.status(500).json({ success: false, message: "Server error deleting category", error: error.message });
  }
}
