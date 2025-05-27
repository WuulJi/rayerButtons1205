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
const serviceAccount = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../serviceAccountKey.json"),
    "utf8",
  ),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

// Discord OAuth 配置
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const REDIRECT_URI = process.env.REDIRECT_URI!;

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
  avatar: string;
  discriminator: string;
  email?: string;
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
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: REDIRECT_URI,
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

      const userData = await userResponse.json() as DiscordUser;

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
      const userDoc: any = {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (userData.discriminator) {
        userDoc.discriminator = userData.discriminator;
      }
      // if (userData.email) {
      //   userDoc.email = userData.email;
      // }
      await admin.firestore()
        .collection("users")
        .doc(uid)
        .set(userDoc, {merge: true});

      // 6. 返回自定義 token
      res.json({token: customToken});
    } catch (error) {
      console.error("Error in Discord callback:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ?
          error.message : String(error),
      });
    }
  },
);

// 其他 Cloud Functions 可以在這裡添加
