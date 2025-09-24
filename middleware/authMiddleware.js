const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Access denied. No valid token provided." });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Invalid token or user is inactive." });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name == "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired login." });
    }
    res.status(401).json({ error: "Invalid token." });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role != "admin") {
    return res.status(403).json({ error: "Access denied." });
  }
  next();
};

const requireIssuer = (req, res, next) => {
  if (!["admin", "issuer"].includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireIssuer,
};
