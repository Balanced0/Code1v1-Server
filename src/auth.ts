import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
export interface AuthRequest extends Request { userId?: string }
export const createToken = (userId: string) => jwt.sign({ userId }, process.env.JWT_SECRET || "development-secret", { expiresIn: "7d" });
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try { req.userId = (jwt.verify(token, process.env.JWT_SECRET || "development-secret") as { userId: string }).userId; next(); }
  catch { res.status(401).json({ message: "Your session has expired. Please sign in again." }); }
}
