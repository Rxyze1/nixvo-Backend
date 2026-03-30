/**
 * ════════════════════════════════════════════════════════════════
 *                      🛣️ USER ROUTES
 * ════════════════════════════════════════════════════════════════
 */

import express from "express";
import {
  testController,
  signup,
  updateBio,
//   getUser,
//   getUserByUsername,
//   getAllUsers,
//   deleteUser,
} from "../Controller/UserController.js";
import { test } from "../Controller/TestController.js";

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// USER ROUTES
// ═══════════════════════════════════════════════════════════════

// Test
router.get("/testC", testController);

// Signup (create account with moderation)
router.post("/signup", signup);

// Update bio (with moderation)
router.put("/bio", updateBio);

// Get user by ID
// router.get("/id/:userId", getUser);

// // Get user by username
// router.get("/:username", getUserByUsername);

// // Get all users
// router.get("/", getAllUsers);

// // Delete user
// router.delete("/:userId", deleteUser);

router.post("/test",test);

export default router;