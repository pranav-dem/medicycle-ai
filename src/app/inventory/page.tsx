
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
      alert(
        error instanceof Error
          ? error.message
          : "Error recording consumption."
      );
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
    if (!confirm("Are you sure you want to delete this medicine?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "medicines", id));
      alert("Medicine deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete medicine.");
    }
  };

  const deleteDisposal = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this disposal history?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "disposal", id));
      alert("Disposal history deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete disposal history.");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-green-50">
        <p className="text-lg font-semibold text-green-800">
          Loading MediCycle Inventory...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 p-5 md:p-8">

      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">

          <div>
            <h1 className="text-3xl font-extrabold text-green-900">
              MediCycle 💚
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Smart Medicine Inventory Management
            </p>
          </div>

          <button
            onClick={() => router.push("/")}
            className="rounded-xl bg-green-800 px-6 py-3 font-semibold text-white shadow transition hover:bg-green-900"
          >
            ← Dashboard
          </button>

        </header>

        {/* Add Medicine */}
        <button
          onClick={() => router.push("/medicines")}
          className="mb-8 rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
        >
          + Add New Medicine
        </button>

        {/* Inventory */}
        <section className="mb-10">

          <div className="mb-5">
            <p className="text-sm font-bold uppercase tracking-widest text-green-600">
              Your Medicines
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-gray-800">
              Medicine Inventory
            </h2>
          </div>

          {medicines.length === 0 ? (
            <div className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
              <div className="text-5xl">💊</div>
              <p className="mt-4 font-semibold text-gray-700">
                No medicines added yet.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Add your first medicine to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">

              {medicines.map((medicine) => {
                const courseFinished =
                  medicine.courseEndDate <
                  new Date().toISOString().split("T")[0];

                return (
                  <div
                    key={medicine.id}
                    className="overflow-hidden rounded-3xl border border-green-100 bg-white p-6 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >

                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-extrabold text-green-800">
                        {medicine.name}
                      </h3>

                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                        Medicine
                      </span>
                    </div>

                    {/* QR Code */}
                    <div className="my-5 rounded-2xl border border-green-100 bg-green-50 p-5 text-center">

                      <p className="mb-3 font-bold text-green-900">
                        Medicine QR Code
                      </p>

                      <div className="flex justify-center rounded-xl bg-white p-4">
                        <QRCodeSVG
                          value={`${window.location.origin}/medicine/${medicine.id}`}
                          size={150}
                        />
                      </div>

                      <p className="mt-3 text-xs text-gray-500">
                        Scan to access medicine record
                      </p>

                    </div>

                    {/* Medicine Information */}
                    <div className="space-y-2 rounded-2xl bg-gray-50 p-4">

                      <p className="text-gray-700">
                        <strong>Batch:</strong> {medicine.batchNumber}
                      </p>

                      <p className="text-gray-700">
                        <strong>Originally purchased:</strong>{" "}
                        {medicine.initialQuantity ?? medicine.quantity}
                      </p>

                      <p className="text-gray-700">
                        <strong>Tablets consumed:</strong>{" "}
                        {medicine.consumedQuantity ?? 0}
                      </p>

                      <p className="text-gray-700">
                        <strong>Tablets disposed:</strong>{" "}
                        {medicine.disposedQuantity ?? 0}
                      </p>

                      <p className="font-bold text-green-700">
                        Available stock: {medicine.quantity}
                      </p>

                      <p className="text-gray-700">
                        <strong>Expiry:</strong> {medicine.expiryDate}
                      </p>

                      <p className="text-gray-700">
                        <strong>Course end:</strong> {medicine.courseEndDate}
                      </p>

                      <p className="font-bold text-orange-600">
                        Status: {getStatus(medicine.expiryDate)}
                      </p>

                    </div>

                    {/* Unused Medicine Warning */}
                    {courseFinished && medicine.quantity > 0 && (
                      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">

                        <p className="font-bold text-orange-800">
                          ⚠️ Possible Unused Medicine Detected!
                        </p>

                        <p className="mt-2 text-sm text-gray-700">
                          {medicine.quantity} tablets remain after the
                          recorded course end date.
                        </p>

                        <p className="mt-2 text-xs text-gray-600">
                          This is an estimate based on recorded entries.
                          Ask a pharmacist before deciding what to do.
                        </p>

                      </div>
                    )}

                    {/* Consumption */}
                    <div className="mt-5 border-t border-gray-100 pt-5">

                      <label className="mb-2 block font-bold text-gray-700">
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
                        className="mb-3 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                      />

                      <button
                        onClick={() => recordConsumption(medicine)}
                        className="w-full rounded-xl bg-green-700 p-3 font-bold text-white transition hover:bg-green-800"
                      >
                        ✓ Record Consumption
                      </button>

                    </div>

                    {/* Delete Medicine */}
                    <button
                      onClick={() => deleteMedicine(medicine.id)}
                      className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-600 transition hover:bg-red-100"
                    >
                      🗑 Delete Medicine
                    </button>

                  </div>
                );
              })}

            </div>
          )}

        </section>

        {/* Disposal Form */}
        <section className="mb-10 rounded-3xl border border-purple-100 bg-white p-6 shadow-md md:p-8">

          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-widest text-purple-600">
              Responsible Disposal
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-gray-800">
              ♻️ Medicine Disposal
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Record medicine quantities handed over or intended for
              collection through an appropriate facility.
            </p>
          </div>

          <form onSubmit={recordDisposal} className="space-y-4">

            <div>
              <label className="mb-2 block font-semibold text-gray-700">
                Select Medicine
              </label>

              <select
                required
                value={disposalMedicine}
                onChange={(e) => setDisposalMedicine(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
              >
                <option value="">Choose medicine</option>

                {medicines.map((medicine) => (
                  <option key={medicine.id} value={medicine.id}>
                    {medicine.name} - {medicine.quantity} available
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block font-semibold text-gray-700">
                Quantity to Dispose
              </label>

              <input
                type="number"
                min="1"
                required
                value={disposalQuantity}
                onChange={(e) => setDisposalQuantity(e.target.value)}
                placeholder="Enter quantity"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-gray-700">
                Disposal Date
              </label>

              <input
                type="date"
                required
                value={disposalDate}
                onChange={(e) => setDisposalDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-gray-700">
                Disposal Method
              </label>

              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
              >
                <option>Pharmacy collection</option>
                <option>Authorized medicine take-back centre</option>
                <option>Other approved collection facility</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-purple-700 to-violet-600 p-4 font-bold text-white shadow-md transition hover:shadow-lg"
            >
              Save Disposal Record
            </button>

          </form>

        </section>

        {/* Disposal History */}
        <section className="rounded-3xl border border-green-100 bg-white p-6 shadow-md md:p-8">

          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-widest text-green-600">
              Your Records
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-gray-800">
              📋 Disposal History
            </h2>
          </div>

          {disposals.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-5 text-gray-500">
              No disposal records yet.
            </p>
          ) : (
            <div className="space-y-4">

              {disposals.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-5"
                >

                  <div className="flex flex-wrap items-center justify-between gap-2">

                    <h3 className="text-lg font-bold text-green-800">
                      {item.medicineName}
                    </h3>

                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
                      {item.status}
                    </span>

                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-700">

                    <p><strong>Batch:</strong> {item.batchNumber}</p>
                    <p><strong>Quantity disposed:</strong> {item.quantity}</p>
                    <p><strong>Date:</strong> {item.disposalDate}</p>
                    <p><strong>Method:</strong> {item.method}</p>

                  </div>

                  <button
                    onClick={() => deleteDisposal(item.id)}
                    className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    🗑 Delete Disposal History
                  </button>

                </div>
              ))}

            </div>
          )}

        </section>

        <footer className="py-8 text-center text-sm text-gray-400">
          © 2026 MediCycle. Smart Medicine Lifecycle Management.
        </footer>

      </div>
    </main>
  );
}
