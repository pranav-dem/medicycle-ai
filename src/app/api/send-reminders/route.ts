
import { NextResponse, connection } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are missing.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

function getIndiaTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export async function GET(request: Request) {
  await connection();

  try {
    const secret = process.env.CRON_SECRET;

    if (
      !secret ||
      request.headers.get("authorization") !== `Bearer ${secret}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const messaging = getMessaging(app);

    const { date, time } = getIndiaTime();

    const snapshot = await db
      .collection("reminders")
      .where("reminderTime", "==", time)
      .get();

    let sent = 0;

    for (const reminderDoc of snapshot.docs) {
      const reminder = reminderDoc.data();

      if (reminder.frequency !== "Daily" || !reminder.userId) {
        continue;
      }

      const tokenDoc = await db
        .collection("notificationTokens")
        .doc(reminder.userId)
        .get();

      if (!tokenDoc.exists) continue;

      const token = tokenDoc.data()?.token;
      if (!token) continue;

      const sentRef = db
        .collection("sentReminders")
        .doc(`${date}_${reminderDoc.id}`);

      const shouldSend = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(sentRef);

        if (existing.exists) return false;

        transaction.set(sentRef, {
          reminderId: reminderDoc.id,
          userId: reminder.userId,
          date,
          createdAt: new Date(),
        });

        return true;
      });

      if (!shouldSend) continue;

      try {
        await messaging.send({
          token,
          data: {
            title: "MediCycle Medicine Reminder",
            body: `Time to check your prescribed schedule for: ${reminder.medicineName}`,
            url: "/reminders",
          },
        });

        sent++;
      } catch (error) {
        await sentRef.delete();
        console.error("Notification sending failed:", error);
      }
    }

    return NextResponse.json({
      success: true,
      time,
      date,
      notificationsSent: sent,
    });
  } catch (error) {
    console.error("Reminder API error:", error);

    return NextResponse.json(
      { error: "Could not process reminders." },
      { status: 500 }
    );
  }
}
