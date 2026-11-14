
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-5">
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-3 text-4xl">💊</div>
          <p className="font-semibold text-green-800">
            Loading medicine details...
          </p>
        </div>
      </main>
    );
  }

  if (message || !medicine) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="text-5xl">⚠️</div>

          <h2 className="mt-4 text-2xl font-bold text-gray-800">
            Medicine Details
          </h2>

          <p className="mt-3 text-red-600">{message}</p>

          <button
            onClick={() => router.push("/inventory")}
            className="mt-6 w-full rounded-xl bg-green-700 p-3 font-semibold text-white transition hover:bg-green-800"
          >
            Back to Inventory
          </button>
        </div>
      </main>
    );
  }

  const details = [
    {
      icon: "💊",
      label: "Medicine Name",
      value: medicine.name || "Not available",
    },
    {
      icon: "🏷️",
      label: "Batch Number",
      value: medicine.batchNumber || "Not available",
    },
    {
      icon: "📦",
      label: "Available Quantity",
      value: `${medicine.quantity ?? 0} tablets`,
    },
    {
      icon: "📅",
      label: "Expiry Date",
      value: medicine.expiryDate || "Not available",
    },
    {
      icon: "🩺",
      label: "Course End Date",
      value: medicine.courseEndDate || "Not specified",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 p-5 md:p-10">
      <div className="mx-auto max-w-3xl">

        {/* MediCycle Header */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-green-700 to-emerald-500 p-6 text-white shadow-lg">
          <div>
            <h1 className="text-3xl font-extrabold">
              MediCycle 💚
            </h1>
            <p className="mt-1 text-sm text-green-100">
              Smart Medicine Lifecycle Management
            </p>
          </div>

          <span className="rounded-full bg-white/20 px-4 py-2 text-sm font-bold">
            QR Medicine Details
          </span>
        </header>

        {/* Medicine Information */}
        <section className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-xl">

          <div className="bg-gradient-to-r from-green-800 to-emerald-600 p-9 text-center text-white">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 text-6xl shadow-lg">
              💊
            </div>

            <h2 className="mt-5 text-3xl font-extrabold">
              Medicine Information
            </h2>

            <p className="mt-2 text-sm text-green-100">
              Your saved medicine details in one place
            </p>
          </div>

          <div className="p-6 md:p-9">
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-800">
                <span className="mr-2">✓</span>
                Medicine record loaded successfully
              </p>
              <p className="mt-1 text-sm text-green-700">
                These details are retrieved from your MediCycle inventory.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {details.map((item, index) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-5 transition hover:-translate-y-1 hover:shadow-md ${
                    index === 0 ? "md:col-span-2" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                      {item.icon}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        {item.label}
                      </p>

                      <p className="mt-1 break-words text-lg font-bold text-gray-800">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <button
                onClick={() => router.push("/inventory")}
                className="w-full rounded-xl bg-gradient-to-r from-green-700 to-emerald-500 p-4 font-bold text-white shadow-md transition hover:from-green-800 hover:to-emerald-600"
              >
                ← Back to Inventory
              </button>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-gray-500">
          MediCycle | Smart Medicine Lifecycle Management
        </p>
      </div>
    </main>
  );
}

export default function MedicineDetails() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-green-50">
          <p className="font-semibold text-green-800">
            Loading medicine page...
          </p>
        </main>
      }
    >
      <MedicineDetailsContent />
    </Suspense>
  );
}
