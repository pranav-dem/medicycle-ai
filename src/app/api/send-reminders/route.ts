
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

    // 1. Existing medicine reminders
    const reminderSnapshot = await db
      .collection("reminders")
      .where("reminderTime", "==", time)
      .get();

    let medicineSent = 0;

    for (const reminderDoc of reminderSnapshot.docs) {
      const reminder = reminderDoc.data();

      if (reminder.frequency !== "Daily" || !reminder.userId) {
        continue;
      }

      const tokenDoc = await db
        .collection("notificationTokens")
        .doc(reminder.userId)
        .get();

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

        medicineSent++;
      } catch (error) {
        await sentRef.delete();
        console.error("Medicine notification failed:", error);
      }
    }

    // 2. Disposal reminders
    const disposalSnapshot = await db
      .collection("disposalPlans")
      .where("plannedDate", "==", date)
      .get();

    let disposalSent = 0;

    for (const planDoc of disposalSnapshot.docs) {
      const plan = planDoc.data();

      if (
        plan.status !== "Scheduled" ||
        !plan.userId ||
        typeof plan.plannedTime !== "string" ||
        !/^\d{2}:\d{2}$/.test(plan.plannedTime)
      ) {
        continue;
      }

      // Send when the planned time has arrived.
      // This also catches up if the scheduler runs a little late.
      if (plan.plannedTime > time) {
        continue;
      }

      const tokenDoc = await db
        .collection("notificationTokens")
        .doc(plan.userId)
        .get();

      const token = tokenDoc.data()?.token;
      if (!token) continue;

      // One notification per disposal plan per scheduled date.
      const sentRef = db
        .collection("sentDisposalReminders")
        .doc(`${date}_${planDoc.id}`);

      const shouldSend = await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(sentRef);

        if (existing.exists) return false;

        transaction.set(sentRef, {
          planId: planDoc.id,
          userId: plan.userId,
          date,
          plannedTime: plan.plannedTime,
          sentAt: new Date(),
        });

        return true;
      });

      if (!shouldSend) continue;

      try {
        await messaging.send({
          token,
          data: {
            title: "MediCycle Disposal Reminder",
            body: `Your planned disposal for ${plan.medicineName} is due. Read the safety instructions before disposing.`,
            url: "/inventory",
          },
        });

        disposalSent++;
      } catch (error) {
        await sentRef.delete();
        console.error("Disposal notification failed:", error);
      }
    }

    return NextResponse.json({
      success: true,
      date,
      time,
      medicineNotificationsSent: medicineSent,
      disposalNotificationsSent: disposalSent,
      notificationsSent: medicineSent + disposalSent,
    });
  } catch (error) {
    console.error("Reminder API error:", error);

    return NextResponse.json(
      { error: "Could not process reminders." },
      { status: 500 }
    );
  }
}
