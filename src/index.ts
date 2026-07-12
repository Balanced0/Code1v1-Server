import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth, authClient } from "./better-auth.js";
import { contactMessages, matches, problems, profiles, submissions } from "./database.js";
import { runJudge0 } from "./judge0.js";

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
async function executeSubmission(req:express.Request, res:express.Response, mode:"run"|"submit") {
  const user=await sessionUser(req); if(!user)return res.status(401).json({message:"Authentication required."});
  const {sourceCode,language,problemId,matchId}=req.body as {sourceCode?:string;language?:string;problemId?:string;matchId?:string};
  if(!sourceCode||!language)return res.status(400).json({message:"Source code and language are required."});
  const problem=problemId&&ObjectId.isValid(problemId)?await problems.findOne({_id:new ObjectId(problemId)}):null;
  const tests=problem?.hiddenTests?.length?problem.hiddenTests:[{input:problem?.sampleInput||req.body.sampleInput||"",output:problem?.sampleOutput||req.body.sampleOutput||""}];
  try {
    const results=await Promise.all(tests.map(async test=>{const result=await runJudge0(sourceCode,language,test.input);return {...result,passed:result.status.id===3&&result.stdout.trim()===test.output.trim()};}));
    const accepted=results.every(result=>result.passed);
    const verdict=accepted?"Accepted":results.find(result=>result.status.id!==3)?.status.description||"Wrong Answer";
    await submissions.insertOne({userId:user.id,problemId:problem?._id?.toHexString()||null,matchId:matchId||null,language,sourceCode,verdict,createdAt:new Date()});
    if(mode==="submit"&&accepted&&matchId&&ObjectId.isValid(matchId)){const matchKey=new ObjectId(matchId);const match=await matches.findOne({_id:matchKey});if(!match?.winner){await matches.updateOne({_id:matchKey},{$set:{winner:user.id,status:"finished",finishedAt:new Date()}});io.to(matchId).emit("match-ended",{winnerId:user.id,verdict:"Accepted"});}}
    res.json({verdict,accepted,results:mode==="run"?results:undefined,result:results[0]});
  } catch(error) { res.status(502).json({message:error instanceof Error?error.message:"Judge0 execution failed."}); }
}
app.post("/api/submissions/run",(req,res)=>executeSubmission(req,res,"run"));
app.post("/api/submissions/submit",(req,res)=>executeSubmission(req,res,"submit"));
io.on("connection",socket=>{socket.on("join-queue",async({userId})=>{const opponent=queue.shift();if(!opponent){queue.push({userId,socketId:socket.id});return socket.emit("queue-status","waiting");}const problem=await problems.findOne({}, {sort:{createdAt:1}});if(!problem)return socket.emit("match-error","No problems are available yet.");const matchId=new ObjectId().toHexString();io.to(opponent.socketId).emit("match-found",{matchId,problemId:problem._id?.toHexString()});socket.emit("match-found",{matchId,problemId:problem._id?.toHexString()});});socket.on("join-match",id=>socket.join(id));socket.on("opponent-status",({matchId,status})=>socket.to(matchId).emit("opponent-status",status));socket.on("disconnect",()=>{const i=queue.findIndex(p=>p.socketId===socket.id);if(i>=0)queue.splice(i,1);});});
authClient.connect().then(async()=>{await Promise.all([problems.createIndex({title:"text",shortDescription:"text"}),profiles.createIndex({handle:1},{unique:true})]);server.listen(port,()=>console.log(`Code1v1 API running on http://localhost:${port} using MongoDB database '${process.env.MONGODB_DB_NAME || "code1v1"}'`));}).catch(error=>{console.error("MongoDB connection failed:",error.message);process.exit(1);});
