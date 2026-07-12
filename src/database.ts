import { Collection, ObjectId } from "mongodb";
import { db } from "./better-auth.js";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type Problem = { _id?: ObjectId; title:string; shortDescription:string; statement:string; difficulty:Difficulty; tags:string[]; constraints:string; sampleInput:string; sampleOutput:string; acceptanceRate:number; imageUrl?:string; author:string; createdAt:Date };
export type PlayerProfile = { _id?:ObjectId; userId?:string; handle:string; email:string; rating:number; wins:number; losses:number; ratingHistory:{date:string;rating:number}[]; createdAt:Date };
export const problems: Collection<Problem> = db.collection("problems");
export const profiles: Collection<PlayerProfile> = db.collection("playerProfiles");
export const contactMessages = db.collection("contactMessages");
