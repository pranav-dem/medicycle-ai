
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

type Medicine = {
  id: string;
  name: string;
  batchNumber: string;
  quantity: number;
  userId: string;
  disposalStatus?: string;
};

export default function DisposalPage() {
  const router = useRouter();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [disposalDate, setDisposalDate] = useState("");
  const [method, setMethod] = useState("Pharmacy collection");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let unsubscribeData: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeData?.();

      if (!user) {
        router.replace("/login");
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, "medicines"),
        where("userId", "==", user.uid)
      );

      unsubscribeData = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as Medicine[];

        setMedicines(records);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeData?.();
    };
  }, [router]);

  async function handleDisposal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const medicine = medicines.find((item) => item.id === selectedId);

    if (!medicine) {
      setMessage("Please select a medicine.");
      return;
    }

    const disposeQuantity = Number(quantity);

    if (
      !Number.isInteger(disposeQuantity) ||
      disposeQuantity <= 0 ||
      disposeQuantity > medicine.quantity
    ) {
      setMessage("Enter a valid quantity not exceeding available stock.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const user = auth.currentUser;
      if (!user) return;

      await addDoc(collection(db, "disposal"), {
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchNumber: medicine.batchNumber,
        quantity: disposeQuantity,
        disposalDate,
        method,
        status: "Recorded - awaiting confirmation",
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "medicines", medicine.id), {
        quantity: medicine.quantity - disposeQuantity,
      });

      setMessage("Disposal record saved successfully!");

      setSelectedId("");
      setQuantity("");
      setDisposalDate("");
      setMethod("Pharmacy collection");
    } catch (error) {
      console.error(error);
      setMessage("Error saving disposal record. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-8">Loading...</p>;
  }

  return (
    <main className="min-h-screen bg-green-50 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-lg">

        <h1 className="text-3xl font-bold text-green-800">
          Medicine Disposal
        </h1>

        <p className="mt-2 text-gray-600">
          Record unused or expired medicine disposal.
        </p>

        <form onSubmit={handleDisposal} className="mt-8 space-y-5">

          <label className="block font-medium text-gray-700">
            Select Medicine

            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
              className="mt-2 w-full rounded-lg border p-3"
            >
              <option value="">Choose medicine</option>

              {medicines.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name} - Available: {medicine.quantity}
                </option>
              ))}
            </select>
          </label>

          <label className="block font-medium text-gray-700">
            Quantity to Dispose

            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="mt-2 w-full rounded-lg border p-3"
              placeholder="Enter quantity"
            />
          </label>

          <label className="block font-medium text-gray-700">
            Disposal Date

            <input
              type="date"
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              required
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>

          <label className="block font-medium text-gray-700">
            Disposal Method

            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="mt-2 w-full rounded-lg border p-3"
            >
              <option>Pharmacy collection</option>
              <option>Authorized medicine take-back centre</option>
              <option>Other approved collection facility</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-green-700 p-3 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Record Disposal"}
          </button>

          {message && (
            <p className="text-center font-medium text-green-700">
              {message}
            </p>
          )}

        </form>

        <button
          onClick={() => router.push("/")}
          className="mt-5 w-full rounded-lg border border-green-700 p-3 text-green-800"
        >
          Back to Dashboard
        </button>

      </div>
    </main>
  );
}
