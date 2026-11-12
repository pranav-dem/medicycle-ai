
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  runTransaction,
  writeBatch,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type Medicine = {
  id: string;
  name: string;
  batchNumber: string;
  quantity: number;
  initialQuantity?: number;
  consumedQuantity?: number;
  disposedQuantity?: number;
  expiryDate: string;
  courseEndDate: string;
  userId: string;
};

type Disposal = {
  id: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  disposalDate: string;
  method: string;
  status: string;
};

export default function InventoryPage() {
  const router = useRouter();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [disposals, setDisposals] = useState<Disposal[]>([]);
  const [consumption, setConsumption] = useState<Record<string, string>>({});
  const [disposalMedicine, setDisposalMedicine] = useState("");
  const [disposalQuantity, setDisposalQuantity] = useState("");
  const [disposalDate, setDisposalDate] = useState("");
  const [method, setMethod] = useState("Pharmacy collection");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeMedicines: (() => void) | undefined;
    let unsubscribeDisposals: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
        setLoading(false);
        return;
      }

      const medicineQuery = query(
        collection(db, "medicines"),
        where("userId", "==", user.uid)
      );

      const disposalQuery = query(
        collection(db, "disposal"),
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
          setLoading(false);
        },
        (error) => {
          console.error(error);
          alert("Unable to load medicines.");
          setLoading(false);
        }
      );

      unsubscribeDisposals = onSnapshot(
        disposalQuery,
        (snapshot) => {
          setDisposals(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Disposal[]
          );
        },
        (error) => console.error(error)
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMedicines?.();
      unsubscribeDisposals?.();
    };
  }, [router]);

  const getStatus = (expiryDate: string) => {
    const today = new Date().toISOString().split("T")[0];

    if (expiryDate < today) return "Expired";
    if (expiryDate === today) return "Expires today";
    return "Not expired";
  };

  const recordConsumption = async (medicine: Medicine) => {
    const amount = Number(consumption[medicine.id]);

    if (!Number.isInteger(amount) || amount <= 0) {
      alert("Enter a valid quantity.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const medicineRef = doc(db, "medicines", medicine.id);
        const medicineDoc = await transaction.get(medicineRef);

        if (!medicineDoc.exists()) {
          throw new Error("Medicine not found.");
        }

        const data = medicineDoc.data();
        const available = Number(data.quantity || 0);

        if (amount > available) {
          throw new Error("Not enough tablets available.");
        }

        transaction.update(medicineRef, {
          quantity: available - amount,
          consumedQuantity:
            Number(data.consumedQuantity || 0) + amount,
        });
      });

      setConsumption((previous) => ({
        ...previous,
        [medicine.id]: "",
      }));

      alert("Consumption recorded successfully!");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error recording consumption.");
    }
  };

  const recordDisposal = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number(disposalQuantity);
    const medicine = medicines.find(
      (item) => item.id === disposalMedicine
    );

    if (!medicine || !Number.isInteger(amount) || amount <= 0) {
      alert("Select a medicine and enter a valid quantity.");
      return;
    }

    if (amount > medicine.quantity) {
      alert("Quantity exceeds available stock.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      const medicineRef = doc(db, "medicines", medicine.id);
      const disposalRef = doc(collection(db, "disposal"));
      const batch = writeBatch(db);

      batch.update(medicineRef, {
        quantity: medicine.quantity - amount,
        disposedQuantity:
          Number(medicine.disposedQuantity || 0) + amount,
      });

      batch.set(disposalRef, {
        medicineId: medicine.id,
        medicineName: medicine.name,
        batchNumber: medicine.batchNumber,
        quantity: amount,
        disposalDate,
        method,
        status: "Recorded - awaiting confirmation",
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setDisposalMedicine("");
      setDisposalQuantity("");
      setDisposalDate("");

      alert("Disposal record saved!");
    } catch (error) {
      console.error(error);
      alert("Could not save disposal record.");
    }
  };

  const deleteMedicine = async (id: string) => {
    if (!confirm("Delete this medicine?")) return;

    try {
      await deleteDoc(doc(db, "medicines", id));
      alert("Medicine deleted.");
    } catch (error) {
      console.error(error);
      alert("Could not delete medicine.");
    }
  };

  if (loading) {
    return <p className="p-8 text-gray-700">Loading inventory...</p>;
  }

  return (
    <main className="min-h-screen bg-gray-100 p-5 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap justify-between gap-3">
          <h1 className="text-3xl font-bold text-blue-800">
            MediCycle AI - Inventory
          </h1>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg bg-gray-700 px-4 py-2 text-white"
          >
            Dashboard
          </button>
        </div>

        <button
          onClick={() => router.push("/medicines")}
          className="mb-6 rounded-lg bg-blue-600 px-5 py-3 text-white"
        >
          + Add Medicine
        </button>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-bold text-gray-800">
            Medicine Inventory
          </h2>

          {medicines.length === 0 ? (
            <p className="rounded-lg bg-white p-5 text-gray-600">
              No medicines added yet.
            </p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {medicines.map((medicine) => {
                const courseFinished =
                  medicine.courseEndDate <
                  new Date().toISOString().split("T")[0];

                return (
                  <div key={medicine.id} className="rounded-xl bg-white p-5 shadow">
                    <h3 className="text-xl font-bold text-blue-700">
                      {medicine.name}
                    </h3>

                    <div className="my-4 rounded-lg bg-gray-50 p-4 text-center">
                      <p className="mb-2 font-semibold text-gray-700">
                        Medicine QR Code
                      </p>
                      <div className="flex justify-center">
                        <QRCodeSVG
                          value={`${window.location.origin}/medicine/${medicine.id}`}
                          size={150}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Scan to access medicine record
                      </p>
                    </div>

                    <p className="text-gray-700">Batch: {medicine.batchNumber}</p>
                    <p className="text-gray-700">
                      Originally purchased: {medicine.initialQuantity ?? medicine.quantity}
                    </p>
                    <p className="text-gray-700">
                      Tablets consumed: {medicine.consumedQuantity ?? 0}
                    </p>
                    <p className="text-gray-700">
                      Tablets disposed: {medicine.disposedQuantity ?? 0}
                    </p>
                    <p className="font-semibold text-green-700">
                      Available stock: {medicine.quantity}
                    </p>
                    <p className="text-gray-700">Expiry: {medicine.expiryDate}</p>
                    <p className="text-gray-700">
                      Course end: {medicine.courseEndDate}
                    </p>
                    <p className="mb-3 font-semibold text-orange-600">
                      Status: {getStatus(medicine.expiryDate)}
                    </p>

                    {courseFinished && medicine.quantity > 0 && (
                      <div className="mb-4 rounded-lg bg-orange-50 p-3">
                        <p className="font-bold text-orange-700">
                          Possible Unused Medicine Detected!
                        </p>
                        <p className="text-sm text-gray-700">
                          {medicine.quantity} tablets remain after the
                          recorded course end date.
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          This is an estimate based on recorded entries.
                          Ask a pharmacist before deciding what to do.
                        </p>
                      </div>
                    )}

                    <div className="mb-4 border-t pt-4">
                      <label className="mb-2 block font-semibold text-gray-700">
                        Record Tablets Consumed
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={medicine.quantity}
                        value={consumption[medicine.id] || ""}
                        onChange={(e) =>
                          setConsumption((previous) => ({
                            ...previous,
                            [medicine.id]: e.target.value,
                          }))
                        }
                        placeholder="Enter tablets consumed"
                        className="mb-2 w-full rounded-lg border p-2 text-gray-800"
                      />
                      <button
                        onClick={() => recordConsumption(medicine)}
                        className="w-full rounded-lg bg-green-600 p-2 text-white"
                      >
                        Record Consumption
                      </button>
                    </div>

                    <button
                      onClick={() => deleteMedicine(medicine.id)}
                      className="w-full rounded-lg bg-red-600 p-2 text-white"
                    >
                      Delete Medicine
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-blue-800">
            Medicine Disposal
          </h2>

          <form onSubmit={recordDisposal} className="space-y-4">
            <select
              required
              value={disposalMedicine}
              onChange={(e) => setDisposalMedicine(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-800"
            >
              <option value="">Choose medicine</option>
              {medicines.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name} - {medicine.quantity} available
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              required
              value={disposalQuantity}
              onChange={(e) => setDisposalQuantity(e.target.value)}
              placeholder="Quantity to dispose"
              className="w-full rounded-lg border p-3 text-gray-800"
            />

            <input
              type="date"
              required
              value={disposalDate}
              onChange={(e) => setDisposalDate(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-800"
            />

            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border p-3 text-gray-800"
            >
              <option>Pharmacy collection</option>
              <option>Authorized medicine take-back centre</option>
              <option>Other approved collection facility</option>
            </select>

            <button
              type="submit"
              className="w-full rounded-lg bg-purple-600 p-3 text-white"
            >
              Save Disposal Record
            </button>
          </form>
        </section>

        <section className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-2xl font-bold text-purple-800">
            Disposal History
          </h2>

          {disposals.length === 0 ? (
            <p className="text-gray-600">No disposal records yet.</p>
          ) : (
            <div className="space-y-3">
              {disposals.map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <p className="font-bold text-gray-800">{item.medicineName}</p>
                  <p className="text-gray-700">Batch: {item.batchNumber}</p>
                  <p className="text-gray-700">
                    Quantity disposed: {item.quantity}
                  </p>
                  <p className="text-gray-700">Date: {item.disposalDate}</p>
                  <p className="text-gray-700">Method: {item.method}</p>
                  <p className="mt-1 text-sm font-semibold text-orange-600">
                    {item.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
