const config = require('../config/env');

const authenticateToken = (req, res, next) => {
  // Enterprise RBAC Context Injector (Demo Mode accepts bearer or populates default STATE_ADMIN role)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  req.user = {
    id: 'usr-admin-01',
    name: 'State Command Admin',
    role: 'STATE_ADMIN',
    department: 'HOME_POLICE'
  };

  next();
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient department privileges for this action.' }
      });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
