
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type Reminder = {
  id: string;
  medicineName: string;
  reminderTime: string;
  frequency: string;
  userId: string;
};

export default function ReminderPage() {
  const router = useRouter();

  const [medicineName, setMedicineName] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const alertedReminders = useRef(new Set<string>());

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        setLoading(false);
        return;
      }

      setUserId(user.uid);
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const remindersQuery = query(
      collection(db, "reminders"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      remindersQuery,
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Reminder[];

        setReminders(list);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        alert("Could not load reminders. Please check your database rules.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (!userId || reminders.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      const currentTime =
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0");

      const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      reminders.forEach((reminder) => {
        const alertKey = `${reminder.id}-${today}`;

        if (
          reminder.reminderTime === currentTime &&
          !alertedReminders.current.has(alertKey)
        ) {
          alertedReminders.current.add(alertKey);

          alert(
            `Medicine Reminder!\n\nTime to check your prescribed schedule for: ${reminder.medicineName}`
          );
        }
      });
    };

    checkReminders();

    const timer = window.setInterval(checkReminders, 15000);

    return () => window.clearInterval(timer);
  }, [reminders, userId]);

  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth.currentUser) {
      alert("Please login first.");
      router.push("/login");
      return;
    }

    try {
      await addDoc(collection(db, "reminders"), {
        medicineName,
        reminderTime,
        frequency,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      setMedicineName("");
      setReminderTime("");
      setFrequency("Daily");

      alert("Reminder added successfully!");
    } catch (error) {
      console.error(error);
      alert("Could not add reminder. Please check your database rules.");
    }
  };

  const deleteReminder = async (id: string) => {
    if (!confirm("Do you want to delete this reminder?")) return;

    try {
      await deleteDoc(doc(db, "reminders", id));
      alert("Reminder deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete reminder.");
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-5 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-blue-800">
            Medicine Reminders
          </h1>

          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-gray-700 px-4 py-2 text-white"
          >
            Dashboard
          </button>
        </div>

        <section className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-800">
            Add New Reminder
          </h2>

          <form onSubmit={addReminder} className="space-y-4">
            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Medicine Name
              </label>

              <input
                type="text"
                required
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                placeholder="Example: Paracetamol"
                className="w-full rounded-lg border p-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Reminder Time
              </label>

              <input
                type="time"
                required
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-800"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-gray-700">
                Frequency
              </label>

              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-lg border p-3 text-gray-800"
              >
                <option value="Daily">Daily</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700"
            >
              Save Reminder
            </button>
          </form>
        </section>

        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-gray-800">
            Your Scheduled Reminders
          </h2>

          {loading ? (
            <p className="text-gray-600">Loading reminders...</p>
          ) : reminders.length === 0 ? (
            <p className="text-gray-600">
              No reminders added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div>
                    <h3 className="font-bold text-blue-700">
                      {reminder.medicineName}
                    </h3>

                    <p className="text-gray-700">
                      Time: {reminder.reminderTime}
                    </p>

                    <p className="text-sm text-gray-600">
                      Frequency: {reminder.frequency}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-5 text-sm text-gray-600">
          Note: Reminders alert you only while this website is open.
          Keep the browser tab open and your computer awake. Follow
          your verified prescription and do not change your dose
          based on this reminder.
        </p>
      </div>
    </main>
  );
}
