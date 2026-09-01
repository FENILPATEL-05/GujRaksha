import express from 'express';
import userStore from '../db/userStore.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// 1. User Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Username and Password are required.' }
      });
    }

    const user = userStore.verifyCredentials(username, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid username or password. Access Denied.' }
      });
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'This user account has been deactivated by Superadmin.' }
      });
    }

    res.json({
      success: true,
      message: `Welcome ${user.name} (${user.role})!`,
      data: {
        user,
        token: `token-${user.id}-${Date.now()}`
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// 2. Get All Users (Superadmin access)
router.get('/users', authenticateToken, (req, res) => {
  try {
    const users = userStore.getAll();
    res.json({
      success: true,
      total: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message }
    });
  }
});

// 3. Register / Create New User (Superadmin)
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { username, name, email, password, role, department_id, department_name } = req.body;
    const createdUser = await userStore.create({
      username,
      name,
      email,
      password,
      role,
      department_id,
      department_name
    });

    res.status(201).json({
      success: true,
      message: `User '${createdUser.name}' (${createdUser.role}) successfully created.`,
      data: createdUser
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'USER_CREATION_FAILED', message: err.message }
    });
  }
});

// 4. Update User
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await userStore.update(req.params.id, req.body);
    res.json({
      success: true,
      message: `User '${updated.name}' updated successfully.`,
      data: updated
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'USER_UPDATE_FAILED', message: err.message }
    });
  }
});

// 5. Delete User
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const result = await userStore.delete(req.params.id);
    res.json({
      success: true,
      message: 'User removed from system registry.',
      data: result
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'USER_DELETE_FAILED', message: err.message }
    });
  }
});

export default router;
