import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth, authClient } from "./better-auth.js";
import { contactMessages, problems, profiles } from "./database.js";

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 4000);
const origin = process.env.CLIENT_URL || "http://localhost:3000";
const io = new Server(server, { cors: { origin, credentials: true } });
const queue: { userId: string; socketId: string }[] = [];
app.use(cors({ origin, credentials: true }));
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ status: "ok", database: process.env.MONGODB_DB_NAME || "code1v1" }));

app.get("/api/problems", async (req, res) => {
  const { search = "", difficulty, tag, sort = "newest", page = "1" } = req.query;
  const filter: Record<string, unknown> = {};
  if (search) filter.title = { $regex: String(search), $options: "i" };
  if (difficulty) filter.difficulty = difficulty;
  if (tag) filter.tags = tag;
  const order: Record<string, 1 | -1> = sort === "acceptance" ? { acceptanceRate: -1 } : sort === "difficulty" ? { difficulty: 1 } : { createdAt: -1 };
  const current = Math.max(1, Number(page));
  const [items, total] = await Promise.all([problems.find(filter).sort(order).skip((current - 1) * 12).limit(12).toArray(), problems.countDocuments(filter)]);
  res.json({ problems: items, total, page: current, pages: Math.ceil(total / 12) });
});
app.get("/api/problems/:id", async (req, res) => { if (!ObjectId.isValid(req.params.id)) return res.status(404).json({ message:"Problem not found." }); const problem=await problems.findOne({_id:new ObjectId(req.params.id)}); if(!problem)return res.status(404).json({message:"Problem not found."}); const related=await problems.find({_id:{$ne:problem._id},$or:[{difficulty:problem.difficulty},{tags:{$in:problem.tags}}]}).limit(3).toArray();res.json({problem,related}); });
async function sessionUser(req: express.Request) { return (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }))?.user; }
app.post("/api/problems", async (req,res)=>{const user=await sessionUser(req);if(!user)return res.status(401).json({message:"Authentication required."});const required=["title","shortDescription","statement","difficulty","constraints","sampleInput","sampleOutput"];if(required.some(key=>!req.body[key])||!Array.isArray(req.body.tags)||!req.body.tags.length)return res.status(400).json({message:"Please complete every required problem field."});const result=await problems.insertOne({...req.body,author:user.id,acceptanceRate:0,createdAt:new Date()});res.status(201).json(await problems.findOne({_id:result.insertedId}));});
app.get("/api/me/problems", async(req,res)=>{const user=await sessionUser(req);if(!user)return res.status(401).json({message:"Authentication required."});res.json(await problems.find({author:user.id}).sort({createdAt:-1}).toArray());});
app.delete("/api/problems/:id", async(req,res)=>{const user=await sessionUser(req);if(!user)return res.status(401).json({message:"Authentication required."});if(!ObjectId.isValid(req.params.id))return res.status(404).json({message:"Problem not found."});const result=await problems.deleteOne({_id:new ObjectId(req.params.id),author:user.id});if(!result.deletedCount)return res.status(404).json({message:"Problem not found."});res.status(204).end();});
app.get("/api/leaderboard",async(_req,res)=>res.json(await profiles.find().sort({rating:-1}).limit(100).toArray()));
app.get("/api/profile/:handle",async(req,res)=>{const profile=await profiles.findOne({handle:req.params.handle.toLowerCase()});if(!profile)return res.status(404).json({message:"Player not found."});res.json(profile);});
app.post("/api/contact",async(req,res)=>{const{name,email,message}=req.body;if(!name||!email||!message)return res.status(400).json({message:"Name, email, and message are required."});await contactMessages.insertOne({name,email,message,createdAt:new Date()});res.status(201).json({message:"Message received. We will get back to you soon."});});
io.on("connection",socket=>{socket.on("join-queue",async({userId})=>{const opponent=queue.shift();if(!opponent){queue.push({userId,socketId:socket.id});return socket.emit("queue-status","waiting");}const problem=await problems.findOne({}, {sort:{createdAt:1}});if(!problem)return socket.emit("match-error","No problems are available yet.");const matchId=new ObjectId().toHexString();io.to(opponent.socketId).emit("match-found",{matchId,problemId:problem._id?.toHexString()});socket.emit("match-found",{matchId,problemId:problem._id?.toHexString()});});socket.on("join-match",id=>socket.join(id));socket.on("opponent-status",({matchId,status})=>socket.to(matchId).emit("opponent-status",status));socket.on("disconnect",()=>{const i=queue.findIndex(p=>p.socketId===socket.id);if(i>=0)queue.splice(i,1);});});
authClient.connect().then(async()=>{await Promise.all([problems.createIndex({title:"text",shortDescription:"text"}),profiles.createIndex({handle:1},{unique:true})]);server.listen(port,()=>console.log(`Code1v1 API running on http://localhost:${port} using MongoDB database '${process.env.MONGODB_DB_NAME || "code1v1"}'`));}).catch(error=>{console.error("MongoDB connection failed:",error.message);process.exit(1);});
