"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
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

    const totalQuantity = Number(quantity);

    if (totalQuantity <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "medicines"), {
        name,
        batchNumber,
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
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-blue-700">
          Add Medicine
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          Enter medicine details to track your medicine stock.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Medicine Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Paracetamol"
              className="w-full rounded-lg border p-3 text-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Batch Number
            </label>
            <input
              type="text"
              required
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              placeholder="Enter batch number"
              className="w-full rounded-lg border p-3 text-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Total Tablets Purchased
            </label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Example: 10"
              className="w-full rounded-lg border p-3 text-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Expiry Date
            </label>
            <input
              type="date"
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-800"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700">
              Prescribed Course End Date
            </label>
            <input
              type="date"
              required
              value={courseEndDate}
              onChange={(e) => setCourseEndDate(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-800"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add Medicine"}
          </button>
        </form>
      </div>
    </main>
  );
}