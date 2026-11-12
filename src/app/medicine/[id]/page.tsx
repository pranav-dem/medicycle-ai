
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Medicine = {
  name?: string;
  batchNumber?: string;
  quantity?: number;
  expiryDate?: string;
  courseEndDate?: string;
};

function MedicineDetailsContent() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const medicineRef = doc(db, "medicines", id);
        const medicineSnap = await getDoc(medicineRef);

        if (!medicineSnap.exists()) {
          setMessage("Medicine not found.");
          setLoading(false);
          return;
        }

        const data = medicineSnap.data();

        if (data.userId !== user.uid) {
          setMessage("You are not authorized to view this medicine.");
          setLoading(false);
          return;
        }

        setMedicine(data as Medicine);
        setLoading(false);
      } catch (error) {
        console.error(error);
        setMessage("Unable to load medicine details.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [id, router]);

  if (loading) {
    return <p className="p-8">Loading medicine details...</p>;
  }

  if (message || !medicine) {
    return (
      <main className="min-h-screen bg-green-50 p-8">
        <p className="text-red-600">{message}</p>
        <button
          onClick={() => router.push("/inventory")}
          className="mt-5 rounded-lg bg-green-700 px-5 py-3 text-white"
        >
          Back to Inventory
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-50 p-6">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow">
        <h1 className="mb-6 text-3xl font-bold text-green-800">
          Medicine Details
        </h1>

        <div className="space-y-4 text-gray-700">
          <p><strong>Medicine Name:</strong> {medicine.name}</p>
          <p><strong>Batch Number:</strong> {medicine.batchNumber}</p>
          <p><strong>Available Quantity:</strong> {medicine.quantity}</p>
          <p><strong>Expiry Date:</strong> {medicine.expiryDate}</p>
          <p><strong>Course End Date:</strong> {medicine.courseEndDate || "Not specified"}</p>
        </div>

        <button
          onClick={() => router.push("/inventory")}
          className="mt-8 w-full rounded-lg bg-green-700 p-3 font-semibold text-white hover:bg-green-800"
        >
          Back to Inventory
        </button>
      </div>
    </main>
  );
}

export default function MedicineDetails() {
  return (
    <Suspense fallback={<p className="p-8">Loading medicine page...</p>}>
      <MedicineDetailsContent />
    </Suspense>
  );
}
