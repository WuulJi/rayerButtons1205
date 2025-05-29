/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// 初始化 Firebase Admin SDK
const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  logger.error("Service account key file not found at", serviceAccountPath);
  throw new Error("Service account key file not found");
}
const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8"),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

// Discord OAuth 配置
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const TARGET_GUILD_ID = process.env.TARGET_GUILD_ID;

if (
  !DISCORD_CLIENT_ID ||
  !DISCORD_CLIENT_SECRET ||
  !REDIRECT_URI ||
  !TARGET_GUILD_ID
) {
  const missingVars = [];
  if (!DISCORD_CLIENT_ID) missingVars.push("DISCORD_CLIENT_ID");
  if (!DISCORD_CLIENT_SECRET) missingVars.push("DISCORD_CLIENT_SECRET");
  if (!REDIRECT_URI) missingVars.push("REDIRECT_URI");
  if (!TARGET_GUILD_ID) missingVars.push("TARGET_GUILD_ID");
  logger.error(
    "Missing environment variables:",
    missingVars.join(", ")
  );
  throw new Error(
    `Missing environment variables: ${missingVars.join(", ")}`
  );
}

// Discord API 響應類型
interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null; // Avatar can be null
  discriminator: string; // Discriminator might not exist for new users, handle accordingly
  email?: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string; // This is a string representing a bitwise value
  features: string[];
}

interface UserDocument {
  id: string;
  username: string;
  avatar?: string | null;
  discriminator?: string;
  lastLogin: admin.firestore.FieldValue;
  isMemberOfTargetGuild: boolean;
}

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

// 處理 Discord OAuth 回調
export const handleDiscordCallback = functions.https.onRequest(
  async (req, res) => {
    try {
      const {code} = req.query;
      if (!code) {
        res.status(400).send("Missing code parameter");
        return;
      }

      // 1. 使用 code 獲取 access token
      const fetch = (url: string, init?: object) => {
        return import("node-fetch").then((mod) => mod.default(url, init));
      };
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID, // Already checked for existence
          client_secret: DISCORD_CLIENT_SECRET, // Already checked
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: REDIRECT_URI, // Already checked
        }),
      });

      const tokenData = await tokenResponse.json() as DiscordTokenResponse;

      if (!tokenData.access_token) {
        throw new Error("Failed to get access token");
      }

      // 2. 使用 access token 獲取用戶信息
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to get user info");
      }

      const userData = await userResponse.json() as DiscordUser;

      // 2.1 獲取用戶的伺服器列表
      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!guildsResponse.ok) {
        throw new Error("Failed to get user guilds");
      }

      const guilds = await guildsResponse.json() as DiscordGuild[];
      // 2.2 檢查用戶是否為目標伺服器的成員
      const isMemberOfTargetGuild = guilds.some((guild) =>
        guild.id === TARGET_GUILD_ID
      );

      if (!isMemberOfTargetGuild) {
        res.status(403).json({
          error: "Unauthorized",
          message: "You must be a member of the target Discord server to login",
        });
        return;
      }

      // 3. 創建或更新 Firebase 用戶
      const uid = `discord:${userData.id}`;
      const userRecord = await admin.auth().getUser(uid).catch(() => null);

      if (!userRecord) {
        // 創建新用戶
        await admin.auth().createUser({
          uid,
          displayName: userData.username,
          photoURL: userData.avatar ?
            `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` :
            undefined,
        });
      } else {
        // 更新現有用戶
        await admin.auth().updateUser(uid, {
          displayName: userData.username,
          photoURL: userData.avatar ?
            `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` :
            undefined,
        });
      }

      // 4. 生成自定義 token
      const customToken = await admin.auth().createCustomToken(uid);

      // 5. 將用戶信息存儲到 Firestore
      const userDoc: UserDocument = {
        id: userData.id,
        username: userData.username,
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        isMemberOfTargetGuild: true,
      };
      if (userData.avatar) {
        userDoc.avatar = userData.avatar;
      }
      if (userData.discriminator) {
        userDoc.discriminator = userData.discriminator;
      }
      // if (userData.email) {
      //   userDoc.email = userData.email;
      // }
      await admin.firestore()
        .collection("users")
        .doc(uid) // Use uid for Firestore document ID as well for consistency
        .set(userDoc, {merge: true});

      // 6. 返回自定義 token
      res.json({token: customToken});
    } catch (error) {
      logger.error("Error in Discord callback:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ?
          error.message :
          String(error),
      });
    }
  },
);

// 其他 Cloud Functions 可以在這裡添加
