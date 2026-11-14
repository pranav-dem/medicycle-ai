
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export default function AddMedicine() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [courseEndDate, setCourseEndDate] = useState("");

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      alert("Please login first.");
      router.push("/login");
      return;
    }

    if (
      !name.trim() ||
      !batchNumber.trim() ||
      !expiryDate ||
      !courseEndDate
    ) {
      alert("Please complete all required medicine details.");
      return;
    }

    const totalQuantity = Number(quantity);

    if (
      !Number.isInteger(totalQuantity) ||
      totalQuantity <= 0
    ) {
      alert("Please enter a valid whole number of tablets.");
      return;
    }

    if (courseEndDate > expiryDate) {
      alert(
        "Course end date cannot be after the medicine expiry date."
      );
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "medicines"), {
        name: name.trim(),
        batchNumber: batchNumber.trim(),
        quantity: totalQuantity,
        initialQuantity: totalQuantity,
        consumedQuantity: 0,
        disposedQuantity: 0,
        expiryDate,
        courseEndDate,
        disposalStatus: "Not disposed",
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      alert("Medicine added successfully!");
      router.push("/inventory");
    } catch (error) {
      console.error(error);
      alert("Error adding medicine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 p-5 md:p-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex items-center justify-between rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold text-green-900">
              MediCycle 💚
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Smart Medicine Lifecycle Management
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl bg-green-800 px-4 py-2.5 font-semibold text-white"
          >
            ← Dashboard
          </button>
        </header>

        <section className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-gradient-to-r from-green-800 to-emerald-600 p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-4xl">
                💊
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-green-100">
                  Medicine Management
                </p>
                <h2 className="mt-1 text-3xl font-extrabold">
                  Add Medicine
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-green-50">
              Enter your medicine details manually to add
              them to your inventory.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 p-6 md:p-8"
          >
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                💊 Medicine Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Paracetamol"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold text-gray-700">
                🏷️ Batch Number
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Enter batch number"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold text-gray-700">
                📦 Total Tablets / Capsules
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter actual number of tablets"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                Enter the actual number of tablets or capsules
                you have.
              </p>
            </div>

            <div>
              <label className="mb-2 block font-bold text-gray-700">
                📅 Medicine Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block font-bold text-gray-700">
                🩺 Prescribed Course End Date
              </label>
              <input
                type="date"
                required
                value={courseEndDate}
                onChange={(e) => setCourseEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                Enter the end date given in your prescription.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 p-4 font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving Medicine..." : "+ Save Medicine"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/inventory")}
              className="w-full rounded-xl border border-green-200 bg-green-50 p-3 font-semibold text-green-800 hover:bg-green-100"
            >
              View Medicine Inventory
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 MediCycle. Smart Medicine Lifecycle Management.
        </p>
      </div>
    </main>
  );
}
