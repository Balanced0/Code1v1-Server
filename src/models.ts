import { Schema, model } from "mongoose";

const ratingPoint = new Schema({ date: String, rating: Number }, { _id: false });
export const User = model("User", new Schema({
  handle: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true }, passwordHash: { type: String, required: true },
  rating: { type: Number, default: 1200 }, wins: { type: Number, default: 0 }, losses: { type: Number, default: 0 }, ratingHistory: { type: [ratingPoint], default: [] },
}, { timestamps: true }));
export const Problem = model("Problem", new Schema({
  title: { type: String, required: true, trim: true }, shortDescription: { type: String, required: true }, statement: { type: String, required: true },
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true }, tags: { type: [String], required: true }, constraints: { type: String, required: true },
  sampleInput: { type: String, required: true }, sampleOutput: { type: String, required: true }, acceptanceRate: { type: Number, default: 0 }, imageUrl: { type: String, default: "" },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true }));
export const Match = model("Match", new Schema({ players: [{ type: Schema.Types.ObjectId, ref: "User" }], problem: { type: Schema.Types.ObjectId, ref: "Problem" }, status: { type: String, default: "active" }, winner: { type: Schema.Types.ObjectId, ref: "User" }, startedAt: { type: Date, default: Date.now }, finishedAt: Date }, { timestamps: true }));
export const Submission = model("Submission", new Schema({ user: { type: Schema.Types.ObjectId, ref: "User" }, problem: { type: Schema.Types.ObjectId, ref: "Problem" }, match: { type: Schema.Types.ObjectId, ref: "Match" }, languageId: Number, sourceCode: String, verdict: String }, { timestamps: true }));
export const ContactMessage = model("ContactMessage", new Schema({ name: { type: String, required: true }, email: { type: String, required: true }, message: { type: String, required: true } }, { timestamps: true }));
