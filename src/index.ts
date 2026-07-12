import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth } from "./better-auth.js";
import { ContactMessage, Problem, User } from "./models.js";

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_URL || "http://localhost:3000" } });
const port = Number(process.env.PORT || 4000);
const queue: { userId: string; socketId: string }[] = [];
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000", credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/problems", async (req, res) => {
  const { search = "", difficulty, tag, sort = "newest", page = "1" } = req.query;
  const filter: Record<string, unknown> = {};
  if (search) filter.$text = { $search: String(search) };
  if (difficulty) filter.difficulty = difficulty;
  if (tag) filter.tags = tag;
  const order: Record<string, 1 | -1> = sort === "acceptance" ? { acceptanceRate: -1 } : sort === "difficulty" ? { difficulty: 1 } : { createdAt: -1 };
  const current = Math.max(1, Number(page));
  const [problems, total] = await Promise.all([Problem.find(filter).sort(order).skip((current - 1) * 12).limit(12), Problem.countDocuments(filter)]);
  res.json({ problems, total, page: current, pages: Math.ceil(total / 12) });
});
app.get("/api/problems/:id", async (req, res) => {
  const problem = await Problem.findById(req.params.id);
  if (!problem) return res.status(404).json({ message: "Problem not found." });
  const related = await Problem.find({ _id: { $ne: problem.id }, $or: [{ difficulty: problem.difficulty }, { tags: { $in: problem.tags } }] }).limit(3);
  res.json({ problem, related });
});
async function getUserId(req: express.Request) { return (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))?.user.id; }
app.post("/api/problems", async (req, res) => {
  const userId=await getUserId(req); if (!userId) return res.status(401).json({ message:"Authentication required." });
  const required = ["title", "shortDescription", "statement", "difficulty", "constraints", "sampleInput", "sampleOutput"];
  if (required.some((field) => !req.body[field]) || !Array.isArray(req.body.tags) || !req.body.tags.length) return res.status(400).json({ message: "Please complete every required problem field." });
  res.status(201).json(await Problem.create({ ...req.body, author: userId }));
});
app.get("/api/me/problems", async (req,res) => {const userId=await getUserId(req);if(!userId)return res.status(401).json({message:"Authentication required."});res.json(await Problem.find({author:userId}).sort({createdAt:-1}));});
app.delete("/api/problems/:id", async (req, res) => {
  const userId=await getUserId(req);if(!userId)return res.status(401).json({message:"Authentication required."});
  if (!(await Problem.findOneAndDelete({ _id: req.params.id, author: userId }))) return res.status(404).json({ message: "Problem not found." });
  res.status(204).end();
});
app.get("/api/leaderboard", async (_req, res) => res.json(await User.find().sort({ rating: -1 }).limit(100).select("handle rating wins losses ratingHistory")));
app.get("/api/profile/:handle", async (req, res) => {
  const user = await User.findOne({ handle: req.params.handle.toLowerCase() }).select("handle rating wins losses ratingHistory createdAt");
  if (!user) return res.status(404).json({ message: "Player not found." });
  res.json(user);
});
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ message: "Name, email, and message are required." });
  await ContactMessage.create({ name, email, message });
  res.status(201).json({ message: "Message received. We will get back to you soon." });
});

io.on("connection", (socket) => {
  socket.on("join-queue", async ({ userId }) => {
    const opponent = queue.shift();
    if (!opponent) { queue.push({ userId, socketId: socket.id }); return socket.emit("queue-status", "waiting"); }
    const problem = await Problem.findOne().sort({ createdAt: 1 });
    if (!problem) return socket.emit("match-error", "No problems are available yet.");
    const matchId = new mongoose.Types.ObjectId().toString();
    io.to(opponent.socketId).emit("match-found", { matchId, problemId: problem.id });
    socket.emit("match-found", { matchId, problemId: problem.id });
  });
  socket.on("join-match", (matchId) => socket.join(matchId));
  socket.on("opponent-status", ({ matchId, status }) => socket.to(matchId).emit("opponent-status", status));
  socket.on("disconnect", () => { const index = queue.findIndex((player) => player.socketId === socket.id); if (index >= 0) queue.splice(index, 1); });
});
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/code1v1").then(() => server.listen(port, () => console.log(`Code1v1 API running on http://localhost:${port}`))).catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
