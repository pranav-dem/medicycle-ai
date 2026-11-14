
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  doc,
  runTransaction,
  serverTimestamp,
  deleteDoc,
  updateDoc,
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
  reason?: string;
  status: string;
};

type DisposalPlan = {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  plannedDate: string;
  plannedTime: string;
  reason: string;
  method: string;
  status: string;
  userId: string;
};

function getIndiaDateTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export default function InventoryPage() {
  const router = useRouter();

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [disposals, setDisposals] = useState<Disposal[]>([]);
  const [disposalPlans, setDisposalPlans] = useState<DisposalPlan[]>([]);
  const [consumption, setConsumption] = useState<Record<string, string>>({});

  // Disposal planner states
  const [disposalMedicine, setDisposalMedicine] = useState("");
  const [disposalQuantity, setDisposalQuantity] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [plannedTime, setPlannedTime] = useState("");
  const [disposalReason, setDisposalReason] = useState("Expired");
  const [method, setMethod] = useState(
    "Followed product/package instructions"
  );
  const [disposalStep, setDisposalStep] = useState(1);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [savingDisposal, setSavingDisposal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [origin, setOrigin] = useState("");

  const selectedMedicine = medicines.find(
    (item) => item.id === disposalMedicine
  );

  useEffect(() => {
    const indiaTime = getIndiaDateTime();
    setToday(indiaTime.date);
    setCurrentTime(indiaTime.time);
    setOrigin(window.location.origin);

    let unsubscribeMedicines: (() => void) | undefined;
    let unsubscribeDisposals: (() => void) | undefined;
    let unsubscribePlans: (() => void) | undefined;

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

      const plansQuery = query(
        collection(db, "disposalPlans"),
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

      unsubscribePlans = onSnapshot(
        plansQuery,
        (snapshot) => {
          setDisposalPlans(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as DisposalPlan[]
          );
        },
        (error) => {
          console.error(error);
          alert("Unable to load disposal plans. Please check Firestore permissions.");
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeMedicines?.();
      unsubscribeDisposals?.();
      unsubscribePlans?.();
    };
  }, [router]);

  const getStatus = (expiryDate: string) => {
    if (!today) return "Checking date...";
    if (expiryDate < today) return "Expired";
    if (expiryDate === today) return "Expires today";
    return "Not expired";
  };

  const validatePlannedDateTime = (
    date: string,
    time: string
  ) => {
    const now = getIndiaDateTime();

    if (!date || !time) {
      alert("Please select both a disposal date and time.");
      return false;
    }

    if (date < now.date) {
      alert("Please select today or a future date.");
      return false;
    }

    if (date === now.date && time <= now.time) {
      alert("Please select a future time.");
      return false;
    }

    return true;
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

        if (data.userId !== auth.currentUser?.uid) {
          throw new Error("You cannot update this medicine.");
        }

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

  // Step 1: Validate details before showing safety guidance
  const goToSafetyInstructions = () => {
    const amount = Number(disposalQuantity);

    if (!selectedMedicine) {
      alert("Please select a medicine.");
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      alert("Enter a valid quantity.");
      return;
    }

    if (amount > selectedMedicine.quantity) {
      alert("Quantity exceeds available stock.");
      return;
    }

    if (!validatePlannedDateTime(plannedDate, plannedTime)) {
      return;
    }

    setDisposalStep(2);
  };

  // Step 2: Require safety acknowledgement
  const goToDisposalReview = () => {
    if (!safetyAcknowledged) {
      alert("Please confirm that you have read the safety guidance.");
      return;
    }

    setDisposalStep(3);
  };

  // Step 3: Save a plan without changing inventory
  const scheduleDisposal = async () => {
    const amount = Number(disposalQuantity);
    const user = auth.currentUser;

    if (!user || !selectedMedicine) {
      alert("Please sign in and select a medicine.");
      return;
    }

    if (!safetyAcknowledged) {
      alert("Please acknowledge the safety instructions.");
      setDisposalStep(2);
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      alert("Enter a valid quantity.");
      setDisposalStep(1);
      return;
    }

    if (!validatePlannedDateTime(plannedDate, plannedTime)) {
      setDisposalStep(1);
      return;
    }

    setSavingDisposal(true);

    try {
      const medicineRef = doc(db, "medicines", selectedMedicine.id);

      const medicineDoc = await runTransaction(db, async (transaction) => {
        const result = await transaction.get(medicineRef);

        if (!result.exists()) {
          throw new Error("Medicine not found.");
        }

        const data = result.data();

        if (data.userId !== user.uid) {
          throw new Error("You cannot access this medicine.");
        }

        if (amount > Number(data.quantity || 0)) {
          throw new Error("Available stock has changed. Please check again.");
        }

        return data;
      });

      await addDoc(collection(db, "disposalPlans"), {
        medicineId: selectedMedicine.id,
        medicineName: medicineDoc.name,
        batchNumber: medicineDoc.batchNumber || "",
        quantity: amount,
        plannedDate,
        plannedTime,
        reason: disposalReason,
        method,
        status: "Scheduled",
        safetyAcknowledged: true,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      setDisposalMedicine("");
      setDisposalQuantity("");
      setPlannedDate("");
      setPlannedTime("");
      setDisposalReason("Expired");
      setMethod("Followed product/package instructions");
      setDisposalStep(1);
      setSafetyAcknowledged(false);

      alert(
        "Disposal plan scheduled successfully! Your inventory has NOT been reduced."
      );
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not schedule disposal."
      );
    } finally {
      setSavingDisposal(false);
    }
  };

  // Mark a scheduled plan as physically completed
  const markPlanDisposed = async (plan: DisposalPlan) => {
    if (
      !confirm(
        `Have you physically disposed of ${plan.quantity} units of ${plan.medicineName}?\n\nOnly confirm after completing the disposal.`
      )
    ) {
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      alert("Please sign in again.");
      return;
    }

    setSavingDisposal(true);

    try {
      const planRef = doc(db, "disposalPlans", plan.id);
      const medicineRef = doc(db, "medicines", plan.medicineId);
      const historyRef = doc(collection(db, "disposal"));
      const actualDate = getIndiaDateTime().date;

      await runTransaction(db, async (transaction) => {
        // Read all documents before writing
        const planDoc = await transaction.get(planRef);
        const medicineDoc = await transaction.get(medicineRef);

        if (!planDoc.exists()) {
          throw new Error("Disposal plan not found.");
        }

        if (!medicineDoc.exists()) {
          throw new Error("Medicine record not found.");
        }

        const planData = planDoc.data();
        const medicineData = medicineDoc.data();

        if (planData.userId !== user.uid) {
          throw new Error("You cannot update this disposal plan.");
        }

        if (planData.status !== "Scheduled") {
          throw new Error("This plan is no longer scheduled.");
        }

        if (medicineData.userId !== user.uid) {
          throw new Error("You cannot update this medicine.");
        }

        const available = Number(medicineData.quantity || 0);
        const amount = Number(planData.quantity);

        if (amount > available) {
          throw new Error(
            "Not enough medicine remains in inventory. Please check your stock."
          );
        }

        transaction.update(medicineRef, {
          quantity: available - amount,
          disposedQuantity:
            Number(medicineData.disposedQuantity || 0) + amount,
        });

        transaction.set(historyRef, {
          medicineId: plan.medicineId,
          medicineName: medicineData.name,
          batchNumber: medicineData.batchNumber || "",
          quantity: amount,
          disposalDate: actualDate,
          reason: planData.reason,
          method: planData.method,
          status: "User-reported disposal completed",
          userId: user.uid,
          planId: plan.id,
          safetyAcknowledged: true,
          createdAt: serverTimestamp(),
        });

        transaction.update(planRef, {
          status: "Completed",
          completedDate: actualDate,
          completedAt: serverTimestamp(),
        });
      });

      alert("Disposal completed! Inventory and disposal history updated.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not complete disposal."
      );
    } finally {
      setSavingDisposal(false);
    }
  };

  // Reschedule a plan
  const reschedulePlan = async (plan: DisposalPlan) => {
    const newDate = window.prompt(
      "Enter the new date (YYYY-MM-DD):",
      plan.plannedDate
    );

    if (!newDate) return;

    const newTime = window.prompt(
      "Enter the new time (HH:MM, 24-hour format):",
      plan.plannedTime
    );

    if (!newTime) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      alert("Please enter the date in YYYY-MM-DD format.");
      return;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) {
      alert("Please enter the time in HH:MM format.");
      return;
    }

    if (!validatePlannedDateTime(newDate, newTime)) {
      return;
    }

    try {
      await updateDoc(doc(db, "disposalPlans", plan.id), {
        plannedDate: newDate,
        plannedTime: newTime,
      });

      alert("Disposal plan rescheduled successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not reschedule this plan.");
    }
  };

  // Cancel a plan without changing stock
  const cancelPlan = async (plan: DisposalPlan) => {
    if (
      !confirm(
        `Cancel the disposal plan for ${plan.medicineName}?\n\nYour medicine stock will not change.`
      )
    ) {
      return;
    }

    try {
      await updateDoc(doc(db, "disposalPlans", plan.id), {
        status: "Cancelled",
      });

      alert("Disposal plan cancelled.");
    } catch (error) {
      console.error(error);
      alert("Could not cancel the disposal plan.");
    }
  };

  // Delete a plan
  const deletePlan = async (plan: DisposalPlan) => {
    if (
      !confirm(
        `Delete the disposal plan for ${plan.medicineName}?\n\nThis deletes only the plan. It does not change medicine stock or delete disposal history.`
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "disposalPlans", plan.id));
      alert("Disposal plan deleted.");
    } catch (error) {
      console.error(error);
      alert("Could not delete the disposal plan.");
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
        "Delete this disposal history? This removes only the history record. It will NOT restore the medicine quantity."
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
                const courseFinished = Boolean(
                  today && medicine.courseEndDate < today
                );

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
                          value={
                            origin
                              ? `${origin}/medicine/${medicine.id}`
                              : `/medicine/${medicine.id}`
                          }
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

        {/* Smart Disposal Planner */}
        <section className="mb-10 rounded-3xl border border-purple-100 bg-white p-6 shadow-md md:p-8">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-widest text-purple-600">
              Smart Disposal Planner
            </p>

            <h2 className="mt-2 text-2xl font-extrabold text-gray-800">
              ♻️ Plan Your Medicine Disposal
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Choose when you plan to dispose of unused or expired
              medicine. MediCycle will send you a reminder at your
              selected date and time.
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8 grid grid-cols-3 gap-2">
            {[
              { number: 1, label: "Details" },
              { number: 2, label: "Safety Guide" },
              { number: 3, label: "Schedule" },
            ].map((step) => (
              <div
                key={step.number}
                className={`rounded-xl p-3 text-center text-sm font-bold ${
                  disposalStep === step.number
                    ? "bg-purple-700 text-white"
                    : disposalStep > step.number
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <div>{step.number}</div>
                <div>{step.label}</div>
              </div>
            ))}
          </div>

          {/* STEP 1 */}
          {disposalStep === 1 && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-800">
                Step 1: Disposal Details
              </h3>

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Select Medicine
                </label>

                <select
                  value={disposalMedicine}
                  onChange={(e) => setDisposalMedicine(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
                >
                  <option value="">Choose medicine</option>

                  {medicines
                    .filter((medicine) => medicine.quantity > 0)
                    .map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>
                        {medicine.name} - {medicine.quantity} available
                      </option>
                    ))}
                </select>
              </div>

              {selectedMedicine && (
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 text-sm text-gray-700">
                  <p>
                    <strong>Medicine:</strong> {selectedMedicine.name}
                  </p>
                  <p>
                    <strong>Batch:</strong> {selectedMedicine.batchNumber}
                  </p>
                  <p>
                    <strong>Available stock:</strong>{" "}
                    {selectedMedicine.quantity}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Quantity to Dispose
                </label>

                <input
                  type="number"
                  min="1"
                  max={selectedMedicine?.quantity || undefined}
                  value={disposalQuantity}
                  onChange={(e) => setDisposalQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Reason for Disposal
                </label>

                <select
                  value={disposalReason}
                  onChange={(e) => setDisposalReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
                >
                  <option>Expired</option>
                  <option>Unused medicine</option>
                  <option>Damaged medicine</option>
                  <option>Course discontinued</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Planned Disposal Date
                </label>

                <input
                  type="date"
                  min={today || undefined}
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Reminder Time
                </label>

                <input
                  type="time"
                  value={plannedTime}
                  onChange={(e) => setPlannedTime(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
                />

                <p className="mt-2 text-xs text-gray-500">
                  Select your preferred reminder time (India time).
                </p>
              </div>

              <button
                type="button"
                onClick={goToSafetyInstructions}
                className="w-full rounded-xl bg-purple-700 p-4 font-bold text-white transition hover:bg-purple-800"
              >
                Continue to Safety Guide →
              </button>
            </div>
          )}

          {/* STEP 2 */}
          {disposalStep === 2 && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-800">
                Step 2: Safety Guidance
              </h3>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
                <h4 className="font-bold text-orange-800">
                  ⚠️ Important Medicine Safety Instructions
                </h4>

                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                  <li>
                    Check the medicine packaging and follow its specific
                    disposal instructions.
                  </li>
                  <li>
                    Do not flush medicines into toilets or sinks unless
                    official product-specific instructions say to do so.
                  </li>
                  <li>
                    Do not burn, crush or mix medicines with ordinary
                    household waste unless authoritative guidance permits it.
                  </li>
                  <li>
                    Keep unused medicines away from children and pets.
                  </li>
                  <li>
                    For special medicines, including chemotherapy,
                    hormone-based, controlled or other high-risk medicines,
                    consult a pharmacist or local health authority.
                  </li>
                  <li>
                    If you are unsure about the correct disposal method,
                    ask a pharmacist or local health authority before
                    proceeding.
                  </li>
                </ul>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-gray-700">
                  Which guidance will you follow?
                </label>

                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800 outline-none focus:border-purple-500"
                >
                  <option>
                    Followed product/package instructions
                  </option>
                  <option>
                    Followed pharmacist guidance
                  </option>
                  <option>
                    Followed local health authority guidance
                  </option>
                  <option>Other approved guidance</option>
                </select>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50 p-4 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={safetyAcknowledged}
                  onChange={(e) =>
                    setSafetyAcknowledged(e.target.checked)
                  }
                  className="mt-1 h-4 w-4 accent-purple-700"
                />

                <span>
                  I have read the safety instructions and will follow
                  appropriate product-specific or pharmacist/health
                  authority guidance before disposal.
                </span>
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDisposalStep(1)}
                  className="w-full rounded-xl border border-gray-300 bg-white p-4 font-bold text-gray-700 hover:bg-gray-50"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={goToDisposalReview}
                  className="w-full rounded-xl bg-purple-700 p-4 font-bold text-white hover:bg-purple-800"
                >
                  Review Schedule →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {disposalStep === 3 && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-gray-800">
                Step 3: Review and Schedule
              </h3>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <h4 className="mb-4 font-bold text-green-900">
                  Check your disposal plan
                </h4>

                <div className="space-y-3 text-sm text-gray-700">
                  <p>
                    <strong>Medicine:</strong>{" "}
                    {selectedMedicine?.name || "Not selected"}
                  </p>

                  <p>
                    <strong>Batch:</strong>{" "}
                    {selectedMedicine?.batchNumber || "Not available"}
                  </p>

                  <p>
                    <strong>Quantity:</strong> {disposalQuantity}
                  </p>

                  <p>
                    <strong>Reason:</strong> {disposalReason}
                  </p>

                  <p>
                    <strong>Planned date:</strong> {plannedDate}
                  </p>

                  <p>
                    <strong>Reminder time:</strong> {plannedTime}
                  </p>

                  <p>
                    <strong>Guidance:</strong> {method}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <strong>Remember:</strong> This only schedules a reminder.
                Your medicine stock will not decrease now. After you
                physically complete the disposal, return here and select
                Mark as Disposed.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  disabled={savingDisposal}
                  onClick={() => setDisposalStep(2)}
                  className="w-full rounded-xl border border-gray-300 bg-white p-4 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  disabled={savingDisposal}
                  onClick={scheduleDisposal}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-700 to-violet-600 p-4 font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingDisposal ? "Scheduling..." : "✓ Schedule Disposal Reminder"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Scheduled Disposal Plans */}
        <section className="mb-10 rounded-3xl border border-purple-100 bg-white p-6 shadow-md md:p-8">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-widest text-purple-600">
              Upcoming Activities
            </p>

            <h2 className="mt-2 text-2xl font-extrabold text-gray-800">
              🔔 My Disposal Plans
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              View, reschedule, cancel or complete your planned disposals.
            </p>
          </div>

          {disposalPlans.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-5 text-gray-500">
              No disposal plans scheduled yet.
            </p>
          ) : (
            <div className="space-y-4">
              {disposalPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-purple-100 bg-purple-50/50 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-purple-900">
                      {plan.medicineName}
                    </h3>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        plan.status === "Scheduled"
                          ? "bg-blue-100 text-blue-800"
                          : plan.status === "Completed"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Batch:</strong> {plan.batchNumber}
                    </p>

                    <p>
                      <strong>Quantity planned:</strong> {plan.quantity}
                    </p>

                    <p>
                      <strong>Reason:</strong> {plan.reason}
                    </p>

                    <p>
                      <strong>Planned date:</strong> {plan.plannedDate}
                    </p>

                    <p>
                      <strong>Reminder time:</strong> {plan.plannedTime}
                    </p>
                  </div>

                  {plan.status === "Scheduled" && (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button
                        disabled={savingDisposal}
                        onClick={() => markPlanDisposed(plan)}
                        className="rounded-xl bg-green-700 p-3 font-bold text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        ✓ Mark as Disposed
                      </button>

                      <button
                        onClick={() => reschedulePlan(plan)}
                        className="rounded-xl bg-blue-700 p-3 font-bold text-white hover:bg-blue-800"
                      >
                        Reschedule
                      </button>

                      <button
                        onClick={() => cancelPlan(plan)}
                        className="rounded-xl border border-orange-200 bg-orange-50 p-3 font-semibold text-orange-700 hover:bg-orange-100"
                      >
                        Cancel Plan
                      </button>

                      <button
                        onClick={() => deletePlan(plan)}
                        className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-600 hover:bg-red-100"
                      >
                        🗑 Delete Plan
                      </button>
                    </div>
                  )}

                  {plan.status !== "Scheduled" && (
                    <button
                      onClick={() => deletePlan(plan)}
                      className="mt-5 w-full rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-600 hover:bg-red-100"
                    >
                      🗑 Delete Plan
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
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

                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-gray-700">
                    <p>
                      <strong>Batch:</strong> {item.batchNumber}
                    </p>

                    <p>
                      <strong>Quantity disposed:</strong> {item.quantity}
                    </p>

                    <p>
                      <strong>Reason:</strong>{" "}
                      {item.reason || "Not specified"}
                    </p>

                    <p>
                      <strong>Actual disposal date:</strong> {item.disposalDate}
                    </p>

                    <p>
                      <strong>Guidance followed:</strong> {item.method}
                    </p>
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
