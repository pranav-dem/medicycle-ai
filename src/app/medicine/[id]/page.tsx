
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

export default function MedicineDetails() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [medicine, setMedicine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const medicineRef = doc(db, "medicines", id);
        const medicineDoc = await getDoc(medicineRef);

        if (!medicineDoc.exists()) {
          setMessage("Medicine record not found.");
        } else if (medicineDoc.data().userId !== user.uid) {
          setMessage("You do not have permission to view this medicine.");
        } else {
          setMedicine(medicineDoc.data());
        }
      } catch (error) {
        console.error(error);
        setMessage("Unable to load medicine details.");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, router]);

  if (loading) {
    return <p className="p-8">Loading medicine details...</p>;
  }

  if (message) {
    return <main className="p-8 text-center text-red-600">{message}</main>;
  }

  if (!medicine) return null;

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow">
        <h1 className="mb-5 text-2xl font-bold text-blue-800">
          MediCycle AI
        </h1>

        <h2 className="mb-4 text-xl font-bold text-gray-800">
          Medicine Details
        </h2>

        <div className="space-y-3 text-gray-700">
          <p><b>Medicine:</b> {medicine.name}</p>
          <p><b>Batch Number:</b> {medicine.batchNumber}</p>
          <p><b>Available Quantity:</b> {medicine.quantity}</p>
          <p><b>Expiry Date:</b> {medicine.expiryDate}</p>
          <p><b>Course End Date:</b> {medicine.courseEndDate}</p>
        </div>

        <p className="mt-5 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
          This medicine record is private and can only be viewed by its
          registered owner after login.
        </p>

        <button
          onClick={() => router.push("/inventory")}
          className="mt-5 w-full rounded-lg bg-blue-600 p-3 text-white"
        >
          Back to Inventory
        </button>
      </div>
    </main>
  );
}
