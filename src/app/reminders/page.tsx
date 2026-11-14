
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
import { enableMedicineNotifications } from "@/lib/messaging";

type Reminder = {
  id: string;
  medicineId?: string;
  medicineName: string;
  reminderTime: string;
  frequency: string;
  userId: string;
};

type Medicine = {
  id: string;
  name: string;
  userId: string;
};

export default function ReminderPage() {
  const router = useRouter();

  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [frequency, setFrequency] = useState("Daily");

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [medicinesLoading, setMedicinesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const alertedReminders = useRef(new Set<string>());

  // Check login
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        setLoading(false);
        setMedicinesLoading(false);
        return;
      }

      setUserId(user.uid);
    });

    return () => unsubscribeAuth();
  }, [router]);

  // Load existing medicines from Inventory
  useEffect(() => {
    if (!userId) return;

    const medicinesQuery = query(
      collection(db, "medicines"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      medicinesQuery,
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Medicine[];

        setMedicines(list);
        setMedicinesLoading(false);
      },
      (error) => {
        console.error("Medicine loading error:", error);
        alert("Could not load your medicines.");
        setMedicinesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Load existing reminders
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

  // Existing in-page reminder alerts
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

  // Enable browser notifications
  const handleEnableNotifications = async () => {
    setNotificationLoading(true);

    try {
      const token = await enableMedicineNotifications();

      if (token) {
        console.log("Notification token generated successfully.");
      }
    } catch (error) {
      console.error(error);
      alert("Could not enable notifications.");
    } finally {
      setNotificationLoading(false);
    }
  };

  // Add reminder using selected Inventory medicine
  const addReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedMedicine = medicines.find(
      (medicine) => medicine.id === selectedMedicineId
    );

    if (!selectedMedicine || !reminderTime) {
      alert("Please select a medicine and reminder time.");
      return;
    }

    if (!auth.currentUser) {
      alert("Please login first.");
      router.push("/login");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "reminders"), {
        medicineId: selectedMedicine.id,
        medicineName: selectedMedicine.name,
        reminderTime,
        frequency,
        userId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      setSelectedMedicineId("");
      setReminderTime("");
      setFrequency("Daily");

      alert("Reminder added successfully!");
    } catch (error) {
      console.error(error);
      alert("Could not add reminder. Please check your database rules.");
    } finally {
      setSaving(false);
    }
  };

  // Delete reminder
  const deleteReminder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    try {
      await deleteDoc(doc(db, "reminders", id));
      alert("Reminder deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete reminder.");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 p-5 md:p-8">
      <div className="mx-auto max-w-4xl">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-green-700 to-emerald-500 p-6 text-white shadow-lg">
          <div>
            <p className="mb-1 text-sm font-medium text-green-100">
              MediCycle
            </p>
            <h1 className="text-3xl font-bold">Medicine Reminders</h1>
            <p className="mt-2 text-sm text-green-50">
              Stay on track with your prescribed medicine schedule.
            </p>
          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-white px-5 py-2.5 font-semibold text-green-800 shadow hover:bg-green-50"
          >
            ← Dashboard
          </button>
        </header>

        {/* Browser notifications */}
        <section className="mb-8 rounded-2xl border border-blue-100 bg-white p-6 shadow-md">
          <h2 className="text-xl font-bold text-gray-800">
            🔔 Browser Notifications
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            Enable browser notification permission for MediCycle to receive
            supported medicine reminder notifications.
          </p>

          <button
            onClick={handleEnableNotifications}
            disabled={notificationLoading}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {notificationLoading
              ? "Enabling..."
              : "🔔 Enable Notifications"}
          </button>
        </section>

        {/* Add reminder */}
        <section className="mb-8 rounded-2xl border border-green-100 bg-white p-6 shadow-md md:p-8">
          <div className="mb-6">
            <span className="text-3xl">⏰</span>
            <h2 className="mt-2 text-2xl font-bold text-gray-800">
              Add New Reminder
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Select a medicine already saved in your Inventory.
            </p>
          </div>

          <form onSubmit={addReminder} className="space-y-5">

            <div>
              <label className="mb-2 block font-semibold text-gray-700">
                Select Medicine
              </label>

              <select
                required
                value={selectedMedicineId}
                onChange={(e) => setSelectedMedicineId(e.target.value)}
                disabled={medicinesLoading || medicines.length === 0}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
              >
                <option value="">
                  {medicinesLoading
                    ? "Loading medicines..."
                    : medicines.length === 0
                    ? "No medicines found in Inventory"
                    : "Choose a medicine"}
                </option>

                {medicines.map((medicine) => (
                  <option key={medicine.id} value={medicine.id}>
                    {medicine.name}
                  </option>
                ))}
              </select>

              {medicines.length === 0 && !medicinesLoading && (
                <p className="mt-2 text-sm text-amber-700">
                  Please add a medicine to your Inventory first.
                  <button
                    type="button"
                    onClick={() => router.push("/medicines/add")}
                    className="ml-1 font-bold text-green-800 underline"
                  >
                    Add Medicine
                  </button>
                </p>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Reminder Time
                </label>

                <input
                  type="time"
                  required
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Frequency
                </label>

                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                >
                  <option value="Daily">Daily</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                saving ||
                medicinesLoading ||
                medicines.length === 0
              }
              className="w-full rounded-xl bg-gradient-to-r from-green-700 to-emerald-500 p-3.5 font-bold text-white shadow-md hover:from-green-800 hover:to-emerald-600 disabled:opacity-60"
            >
              {saving ? "Saving..." : "+ Save Reminder"}
            </button>
          </form>
        </section>

        {/* Saved reminders */}
        <section className="rounded-2xl border border-green-100 bg-white p-6 shadow-md md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Your Scheduled Reminders
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Your saved medicine reminders.
              </p>
            </div>

            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-800">
              {reminders.length} Reminder(s)
            </span>
          </div>

          {loading ? (
            <p className="rounded-xl bg-gray-50 p-5 text-center text-gray-500">
              Loading reminders...
            </p>
          ) : reminders.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-green-200 bg-green-50 p-8 text-center">
              <p className="text-4xl">📅</p>
              <h3 className="mt-3 font-bold text-gray-700">
                No reminders yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Add your first medicine reminder above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-100 bg-green-50/70 p-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl">
                      💊
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-green-800">
                        {reminder.medicineName}
                      </h3>
                      <p className="mt-1 text-sm text-gray-700">
                        Time: {reminder.reminderTime}
                      </p>
                      <p className="text-sm text-gray-500">
                        Frequency: {reminder.frequency}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700 hover:bg-red-200"
                  >
                    🗑 Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm leading-6 text-amber-900">
            <strong>Important:</strong> Browser notifications depend on
            notification permission, device settings and browser availability.
            In-page alerts work only while the website is open and the browser
            is awake. Always follow your verified prescription.
          </p>
        </div>

      </div>
    </main>
  );
}
