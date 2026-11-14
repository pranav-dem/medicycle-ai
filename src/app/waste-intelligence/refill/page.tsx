
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
  quantity: number;
};

type RefillPlan = {
  id: string;
  medicineName: string;
  currentQuantity: number;
  tabletsPerDay: number;
  daysRemaining: number;
  estimatedRunOutDate: string;
};

export default function RefillPlannerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [plans, setPlans] = useState<RefillPlan[]>([]);
  const [medicineId, setMedicineId] = useState("");
  const [tabletsPerDay, setTabletsPerDay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let unsubscribeMedicines: (() => void) | undefined;
    let unsubscribePlans: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const medicineQuery = query(
        collection(db, "medicines"),
        where("userId", "==", user.uid)
      );

      const planQuery = query(
        collection(db, "refillPlans"),
        where("userId", "==", user.uid)
      );

      unsubscribeMedicines = onSnapshot(
        medicineQuery,
        (snapshot) => {
          setMedicines(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Medicine[]
          );
        },
        (error) => {
          console.error(error);
          alert("Could not load medicines.");
        }
      );

      unsubscribePlans = onSnapshot(
        planQuery,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as RefillPlan[];

          setPlans(data);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          alert("Could not load refill plans.");
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMedicines?.();
      unsubscribePlans?.();
    };
  }, [router]);

  const selectedMedicine = medicines.find(
    (medicine) => medicine.id === medicineId
  );

  const dailyUse = Number(tabletsPerDay);

  const daysRemaining =
    selectedMedicine && dailyUse > 0
      ? Math.floor(selectedMedicine.quantity / dailyUse)
      : 0;

  const getRunOutDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString("en-IN");
  };

  const savePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user || !selectedMedicine) {
      alert("Please select a medicine.");
      return;
    }

    if (!Number.isFinite(dailyUse) || dailyUse <= 0) {
      alert("Enter a valid number of tablets per day.");
      return;
    }

    const calculatedDays = Math.floor(
      selectedMedicine.quantity / dailyUse
    );

    if (calculatedDays < 1) {
      alert("Your current stock is less than one day's usage.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "refillPlans"), {
        userId: user.uid,
        medicineId: selectedMedicine.id,
        medicineName: selectedMedicine.name,
        currentQuantity: selectedMedicine.quantity,
        tabletsPerDay: dailyUse,
        daysRemaining: calculatedDays,
        estimatedRunOutDate: getRunOutDate(calculatedDays),
        createdAt: serverTimestamp(),
      });

      alert("Refill plan saved successfully!");

      setMedicineId("");
      setTabletsPerDay("");
    } catch (error) {
      console.error(error);
      alert("Could not save the refill plan.");
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this refill plan?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "refillPlans", id));
      alert("Refill plan deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete the refill plan.");
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
            Smart Medicine Refill Planner
          </h1>

          <p className="text-green-50">
            Estimate how many days your current medicine stock will last
            and plan ahead.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-md border border-green-100 p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Calculate Your Refill Plan
          </h2>

          <p className="text-gray-500 mb-6">
            Select a medicine and enter its prescribed daily tablet usage.
          </p>

          {medicines.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-yellow-800">
              No medicines found. Add a medicine to your inventory first.

              <button
                onClick={() => router.push("/medicines")}
                className="block mt-3 font-bold underline"
              >
                Add Medicine →
              </button>
            </div>
          ) : (
            <form onSubmit={savePlan} className="space-y-5">

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Select Medicine
                </label>

                <select
                  value={medicineId}
                  onChange={(e) => setMedicineId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Choose a medicine</option>

                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name} (Stock: {medicine.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMedicine && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <p className="text-sm text-gray-600">
                    Current available stock
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    {selectedMedicine.quantity} tablets
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Prescribed Tablets Per Day
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={tabletsPerDay}
                  onChange={(e) => setTabletsPerDay(e.target.value)}
                  required
                  placeholder="Example: 2"
                  className="w-full rounded-xl border border-gray-300 p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {selectedMedicine && dailyUse > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6">
                  <p className="text-gray-600 font-medium">
                    Estimated Stock Duration
                  </p>

                  <p className="text-3xl font-bold text-green-700 mt-2">
                    {daysRemaining} days
                  </p>

                  <p className="text-gray-600 mt-3">
                    Estimated stock run-out date:{" "}
                    <strong>
                      {getRunOutDate(daysRemaining)}
                    </strong>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold py-3.5 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Refill Plan"}
              </button>
            </form>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-md border border-green-100 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Saved Refill Plans
          </h2>

          <p className="text-gray-500 mb-6">
            View or delete your saved refill estimates.
          </p>

          {plans.length === 0 ? (
            <p className="bg-gray-50 rounded-xl p-5 text-gray-500">
              No refill plans saved yet.
            </p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border border-green-100 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {plan.medicineName}
                    </h3>

                    <p className="text-sm text-gray-600 mt-1">
                      Current stock: {plan.currentQuantity} tablets
                    </p>

                    <p className="text-sm text-gray-600">
                      Daily usage: {plan.tabletsPerDay} tablets
                    </p>

                    <p className="text-green-700 font-bold mt-2">
                      Estimated duration: {plan.daysRemaining} days
                    </p>

                    <p className="text-sm text-gray-600">
                      Estimated run-out date: {plan.estimatedRunOutDate}
                    </p>
                  </div>

                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="rounded-lg bg-red-50 border border-red-200 text-red-600 font-semibold px-5 py-2 hover:bg-red-100"
                  >
                    Delete Plan
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-gray-500 text-center mt-6">
          This is an estimate based on entered stock and prescribed daily
          usage. It does not create a prescription or change medicine stock.
          Follow your doctor's prescription.
        </p>

      </div>
    </main>
  );
}
