
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
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
import { auth, db } from "@/lib/firebase";

type Medicine = {
  id: string;
  name: string;
  batchNumber?: string;
  quantity: number;
  pricePerUnit?: number | string;
};

type WasteRecord = {
  id: string;
  medicineName: string;
  unusedQuantity: number;
  reason: string;
  pricePerTablet: number;
  estimatedValue: number;
  createdAt?: any;
};

const reasons = [
  "Treatment changed or stopped",
  "Missed doses",
  "Medicine damaged",
  "Course completed with tablets remaining",
  "Medicine expired",
  "Other",
];

export default function WasteAnalyzerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [records, setRecords] = useState<WasteRecord[]>([]);

  const [medicineId, setMedicineId] = useState("");
  const [unusedQuantity, setUnusedQuantity] = useState("");
  const [reason, setReason] = useState(reasons[0]);
  const [pricePerTablet, setPricePerTablet] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let unsubscribeMedicines: (() => void) | undefined;
    let unsubscribeRecords: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      unsubscribeMedicines?.();
      unsubscribeRecords?.();

      const medicineQuery = query(
        collection(db, "medicines"),
        where("userId", "==", user.uid)
      );

      const recordsQuery = query(
        collection(db, "wasteRecords"),
        where("userId", "==", user.uid)
      );

      unsubscribeMedicines = onSnapshot(
        medicineQuery,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Medicine[];

          setMedicines(data);
        },
        (error) => {
          console.error("Medicine loading error:", error);
          alert("Could not load your medicines.");
        }
      );

      unsubscribeRecords = onSnapshot(
        recordsQuery,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as WasteRecord[];

          data.sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() || 0;
            const dateB = b.createdAt?.toMillis?.() || 0;
            return dateB - dateA;
          });

          setRecords(data);
          setLoading(false);
        },
        (error) => {
          console.error("Waste records loading error:", error);
          alert("Could not load waste records.");
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMedicines?.();
      unsubscribeRecords?.();
    };
  }, [router]);

  const selectedMedicine = medicines.find(
    (medicine) => medicine.id === medicineId
  );

  const quantity = Number(unusedQuantity);
  const price = Number(pricePerTablet);

  const estimatedValue =
    quantity > 0 && price > 0 ? quantity * price : 0;

  const handleMedicineChange = (selectedId: string) => {
    setMedicineId(selectedId);
    setUnusedQuantity("");

    const medicine = medicines.find(
      (item) => item.id === selectedId
    );

    if (!medicine) {
      setPricePerTablet("");
      return;
    }

    const savedPrice = Number(medicine.pricePerUnit);

    if (Number.isFinite(savedPrice) && savedPrice > 0) {
      setPricePerTablet(String(savedPrice));
    } else {
      setPricePerTablet("");
    }
  };

  const saveWasteRecord = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      alert("Please log in again.");
      router.replace("/login");
      return;
    }

    if (!selectedMedicine) {
      alert("Please select a medicine.");
      return;
    }

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > selectedMedicine.quantity
    ) {
      alert(
        `Enter a valid whole number of tablets between 1 and ${selectedMedicine.quantity}.`
      );
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      alert("Enter a valid price per tablet.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "wasteRecords"), {
        userId: user.uid,
        medicineId: selectedMedicine.id,
        medicineName: selectedMedicine.name,
        batchNumber: selectedMedicine.batchNumber || "",
        unusedQuantity: quantity,
        reason,
        pricePerTablet: price,
        estimatedValue: quantity * price,
        createdAt: serverTimestamp(),
      });

      alert("Waste record saved successfully!");

      setMedicineId("");
      setUnusedQuantity("");
      setPricePerTablet("");
      setReason(reasons[0]);
    } catch (error) {
      console.error(error);
      alert("Could not save the waste record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteWasteRecord = async (recordId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this waste record? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "wasteRecords", recordId));
      alert("Waste record deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete the waste record.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <p className="text-green-700 font-semibold">
          Loading MediCycle...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-5 py-10">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/waste-intelligence")}
          className="mb-7 rounded-xl border border-green-200 bg-white px-5 py-2.5 font-semibold text-green-700 hover:bg-green-50"
        >
          ← Back to Waste Intelligence
        </button>

        <section className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-500 p-8 md:p-10 text-white shadow-xl mb-8">
          <p className="text-green-100 text-sm font-semibold tracking-wider mb-3">
            MEDICYCLE
          </p>

          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Waste Analyzer & Financial Loss Calculator
          </h1>

          <p className="text-green-50">
            Record unused medicines, identify the reasons for waste
            and estimate their financial value.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-md border border-green-100 p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Record Medicine Waste
          </h2>

          <p className="text-gray-500 mb-6">
            Enter the details below to calculate the estimated value
            of unused medicine.
          </p>

          {medicines.length === 0 ? (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-5 text-yellow-800">
              No medicines found in your inventory. Add a medicine
              before recording waste.

              <button
                onClick={() => router.push("/medicines")}
                className="block mt-3 font-bold underline"
              >
                Add Medicine →
              </button>
            </div>
          ) : (
            <form onSubmit={saveWasteRecord} className="space-y-5">
              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Select Medicine
                </label>

                <select
                  value={medicineId}
                  onChange={(e) =>
                    handleMedicineChange(e.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose a medicine</option>

                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name} (Available: {medicine.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMedicine && (
                <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                  <p className="text-sm text-gray-600">
                    Available inventory quantity
                  </p>

                  <p className="text-2xl font-bold text-green-700">
                    {selectedMedicine.quantity} tablets
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Number of Unused Tablets
                </label>

                <input
                  type="number"
                  min="1"
                  max={selectedMedicine?.quantity || undefined}
                  step="1"
                  value={unusedQuantity}
                  onChange={(e) =>
                    setUnusedQuantity(e.target.value)
                  }
                  required
                  placeholder="Enter unused tablet quantity"
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Reason for Medicine Waste
                </label>

                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {reasons.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Price Per Tablet (₹)
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={pricePerTablet}
                  onChange={(e) =>
                    setPricePerTablet(e.target.value)
                  }
                  required
                  placeholder="Enter price of one tablet"
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />

                {selectedMedicine &&
                  Number(selectedMedicine.pricePerUnit) > 0 && (
                    <p className="text-sm text-green-700 mt-2">
                      <span className="font-semibold">
                        Price fetched from your inventory.
                      </span>
                      {" "}You can edit it if necessary.
                    </p>
                  )}

                {selectedMedicine &&
                  !(Number(selectedMedicine.pricePerUnit) > 0) && (
                    <p className="text-sm text-amber-700 mt-2">
                      No saved price found for this medicine.
                      Enter the price manually. Older medicines may
                      not have a price saved.
                    </p>
                  )}
              </div>

              <div className="rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6">
                <p className="text-gray-600 font-medium">
                  Estimated Financial Loss
                </p>

                <p className="text-3xl font-bold text-green-700 mt-2">
                  ₹{estimatedValue.toFixed(2)}
                </p>

                <p className="text-sm text-gray-500 mt-2">
                  Unused tablets × Price per tablet
                </p>
              </div>

              <button
                type="submit"
                disabled={saving || medicines.length === 0}
                className="w-full rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Waste Record"}
              </button>
            </form>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-md border border-green-100 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Saved Waste Records
          </h2>

          <p className="text-gray-500 mb-6">
            View or delete your previously recorded waste entries.
          </p>

          {records.length === 0 ? (
            <p className="text-gray-500 bg-gray-50 rounded-xl p-5">
              No waste records added yet.
            </p>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="border border-green-100 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">
                      {record.medicineName}
                    </h3>

                    <p className="text-sm text-gray-600 mt-1">
                      Unused quantity: {record.unusedQuantity} tablets
                    </p>

                    <p className="text-sm text-gray-600">
                      Reason: {record.reason}
                    </p>

                    <p className="text-sm text-gray-600">
                      Price per tablet: ₹
                      {Number(record.pricePerTablet || 0).toFixed(2)}
                    </p>

                    <p className="text-green-700 font-bold mt-2">
                      Estimated value: ₹
                      {Number(record.estimatedValue || 0).toFixed(2)}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteWasteRecord(record.id)}
                    className="rounded-lg bg-red-50 border border-red-200 text-red-600 font-semibold px-5 py-2 hover:bg-red-100"
                  >
                    Delete Record
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500 text-center mt-6">
          Financial values are estimates based on the saved or manually
          entered price. Recording or deleting a waste entry does not
          change medicine inventory or confirm physical disposal.
        </p>
      </div>
    </main>
  );
}
