import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt
  };
}

export function createAuthService({ store, jwtSecret }) {
  function issueToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email
      },
      jwtSecret,
      { expiresIn: "7d" }
    );
  }

  async function hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Authentication required." });
    }

    try {
      const payload = jwt.verify(token, jwtSecret);
      const data = store.read();
      const user = data.users.find((entry) => entry.id === payload.sub);

      if (!user) {
        return res.status(401).json({ error: "Invalid token user." });
      }

      req.user = sanitizeUser(user);
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid token." });
    }
  }

  return {
    issueToken,
    hashPassword,
    verifyPassword,
    requireAuth
  };
}
