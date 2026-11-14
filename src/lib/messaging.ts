
"use client";

import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { getApp } from "firebase/app";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export async function enableMedicineNotifications() {
  try {
    const user = auth.currentUser;

    if (!user) {
      alert("Please login first.");
      return null;
    }

    if (!(await isSupported())) {
      alert("Push notifications are not supported in this browser.");
      return null;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Please allow notifications for MediCycle.");
      return null;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    await navigator.serviceWorker.ready;

    const messaging = getMessaging(getApp());

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      alert("Could not generate notification token.");
      return null;
    }

    await setDoc(doc(db, "notificationTokens", user.uid), {
      userId: user.uid,
      token: token,
      updatedAt: serverTimestamp(),
    });

    console.log("Notification token saved successfully.");
    alert("MediCycle notifications enabled successfully!");

    return token;
  } catch (error) {
    console.error("Notification setup error:", error);
    alert("Notification setup failed. Check the browser console.");
    return null;
  }
}
