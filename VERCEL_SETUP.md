# Vercel Deployment & Setup Guide

This guide helps you configure your environment variables on Vercel and complete the deployment so that your API endpoints (`/api/*`) work without returning 404 or 500 connection errors.

---

## 📋 Table of Contents
1. [What We Changed in Code](#1-what-we-changed-in-code)
2. [Step-by-Step Vercel Configuration](#2-step-by-step-vercel-configuration)
3. [Environment Variables Table](#3-environment-variables-table)
4. [Finalizing Your Deployment](#4-finalizing-your-deployment)
5. [How to Troubleshoot](#5-how-to-troubleshoot)

---

## 1. What We Changed in Code

To adapt the Express backend to Vercel's serverless environment, we applied these modifications:
*   **Express Export (`server.ts`)**: Decoupled the Express `app` instance from the local port listener, exported it as default (`export default app`), and skipped the local listener block if `process.env.VERCEL` is present.
*   **Serverless Entrypoint (`api/index.ts`)**: Created a direct routing function under the `/api` directory that imports the Express `app` instance and exits so Vercel can run it as a serverless instance.
*   **Rewrite System (`vercel.json`)**: Configured Vercel to route all `/api/*` endpoints to the serverless entrypoint and route all client-side navigation fallbacks to the SPA `index.html` file.

---

## 2. Step-by-Step Vercel Configuration

Because your database details are defined in a local `.env` file (which is git-ignored for safety), you must configure them in Vercel's settings page:

1. Open your browser and go to your **[Vercel Dashboard](https://vercel.com/)**.
2. Click on your project name (**`hackwell-fungames`**).
3. Navigate to the **Settings** tab at the top.
4. Select the **Environment Variables** tab in the left sidebar menu.
5. Add each of the environment variables in the table below. Make sure to copy both the **Key** and the **Value** correctly, then click **Add** for each.

---

## 3. Environment Variables Table

Copy and paste these pairs into Vercel Settings:

| Key (Name) | Value |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | `AIzaSyAIOWlMHhnzfcVUzCGULbdfS6IzqJItASY` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `hackwell-fungames.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `hackwell-fungames` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `hackwell-fungames.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `206289606816` |
| `VITE_FIREBASE_APP_ID` | `1:206289606816:web:5c71780d13f2ef274ed1c5` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-PDBGNEYX7S` |

---

## 4. Finalizing Your Deployment

After adding the environment variables, you must redeploy your app so the builder builds the app with the new variables:

1. Go to the **Deployments** tab at the top of your Vercel project page.
2. Select your latest deployment (it will show commit message `update api entry import path` or `Merge branch 'ashwin' ...`).
3. Click the **three dots menu (...)** next to it, and select **Redeploy**.
4. Wait 1 or 2 minutes for the build to finish. 

Once resolved, your frontend and backend api endpoints will connect perfectly!

---

## 5. How to Troubleshoot

If you still experience issues after following these steps:
*   **Check Vercel Build Logs:** Click on the current deployment to view the build output. Ensure there are no compilation errors during bundling.
*   **Check Runtime Function Logs:** Under your Vercel project page, go to the **Logs** tab. Hit your endpoint in your browser, and watch the real-time server logs for any uncaught Firestore or configuration errors.
