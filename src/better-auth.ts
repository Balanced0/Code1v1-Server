import "dotenv/config";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

const mongoUrl = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/code1v1";
export const authClient = new MongoClient(mongoUrl);
export const db = authClient.db(process.env.MONGODB_DB_NAME || "code1v1");
export const auth = betterAuth({
  appName: "Code1v1", baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000", basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET, trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],
  database: mongodbAdapter(db, { client: authClient }), emailAndPassword: { enabled: true },
  socialProviders: { google: { clientId: process.env.GOOGLE_CLIENT_ID || "", clientSecret: process.env.GOOGLE_CLIENT_SECRET || "" } },
});
