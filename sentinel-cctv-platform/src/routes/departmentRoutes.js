import express from "express";
import departmentStore from "../db/departmentStore.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET all departments
router.get("/", authenticateToken, (req, res, next) => {
  try {
    const departments = departmentStore.getAll();
    res.json({
      success: true,
      total: departments.length,
      data: departments
    });
  } catch (err) {
    next(err);
  }
});

// GET department by code
router.get("/:code", authenticateToken, (req, res, next) => {
  try {
    const dept = departmentStore.getByCode(req.params.code);
    if (!dept) {
      return res.status(404).json({
        success: false,
        error: { code: "DEPT_NOT_FOUND", message: "Department not found." }
      });
    }
    res.json({
      success: true,
      data: dept
    });
  } catch (err) {
    next(err);
  }
});

// POST create department (Admin only)
router.post("/", authenticateToken, (req, res, next) => {
  try {
    const newDept = departmentStore.create(req.body);
    res.status(201).json({
      success: true,
      message: "Department successfully registered into Gujarat Statewide Directory.",
      data: newDept
    });
  } catch (err) {
    next(err);
  }
});

// PUT update department
router.put("/:code", authenticateToken, (req, res, next) => {
  try {
    const updated = departmentStore.update(req.params.code, req.body);
    res.json({
      success: true,
      message: "Department successfully updated.",
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// DELETE department
router.delete("/:code", authenticateToken, (req, res, next) => {
  try {
    const deleted = departmentStore.delete(req.params.code);
    res.json({
      success: true,
      message: "Department successfully removed from directory.",
      data: deleted
    });
  } catch (err) {
    next(err);
  }
});

export default router;
