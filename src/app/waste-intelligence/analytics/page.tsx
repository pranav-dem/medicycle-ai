
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { jsPDF } from "jspdf";

type WasteRecord = {
  id: string;
  medicineName: string;
  unusedQuantity: number;
  reason: string;
  pricePerTablet: number;
  estimatedValue: number;
  createdAt?: any;
};

const colors = [
  "#16a34a",
  "#2563eb",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
];

export default function WasteAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<WasteRecord[]>([]);

  useEffect(() => {
    let unsubscribeRecords: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const q = query(
        collection(db, "wasteRecords"),
        where("userId", "==", user.uid)
      );

      unsubscribeRecords = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as WasteRecord[];

          setRecords(data);
          setLoading(false);
        },
        (error) => {
          console.error(error);
          alert("Could not load analytics.");
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeRecords?.();
    };
  }, [router]);

  const totalTablets = records.reduce(
    (sum, item) => sum + Number(item.unusedQuantity || 0),
    0
  );

  const totalLoss = records.reduce(
    (sum, item) => sum + Number(item.estimatedValue || 0),
    0
  );

  const reasonData: Record<string, number> = {};
  const medicineData: Record<string, number> = {};
  const monthlyData: Record<string, number> = {};

  records.forEach((item) => {
    const reason = item.reason || "Other";
    const medicine = item.medicineName || "Unknown";
    const quantity = Number(item.unusedQuantity || 0);

    reasonData[reason] = (reasonData[reason] || 0) + quantity;
    medicineData[medicine] = (medicineData[medicine] || 0) + quantity;

    const date = item.createdAt?.toDate?.();

    if (date) {
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      const monthLabel = date.toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      });

      monthlyData[monthKey + "|" + monthLabel] =
        (monthlyData[monthKey + "|" + monthLabel] || 0) + quantity;
    }
  });

  const reasonEntries = Object.entries(reasonData);
  const medicineEntries = Object.entries(medicineData);

  const monthlyEntries = Object.entries(monthlyData).sort(
    ([a], [b]) => a.localeCompare(b)
  );

  const maxReason = Math.max(
    1,
    ...reasonEntries.map((item) => item[1])
  );

  const maxMedicine = Math.max(
    1,
    ...medicineEntries.map((item) => item[1])
  );

  const maxMonth = Math.max(
    1,
    ...monthlyEntries.map((item) => item[1])
  );

  let currentAngle = 0;

  const pieGradient =
    totalTablets > 0
      ? `conic-gradient(${reasonEntries
          .map(([reason, quantity], index) => {
            const start = currentAngle;
            currentAngle += (quantity / totalTablets) * 100;
            return `${colors[index % colors.length]} ${start}% ${currentAngle}%`;
          })
          .join(", ")})`
      : "#e5e7eb";

  const deleteRecord = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this waste record? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "wasteRecords", id));
      alert("Waste record deleted successfully.");
    } catch (error) {
      console.error(error);
      alert("Could not delete the record.");
    }
  };

  const downloadPDF = () => {
    if (records.length === 0) {
      alert("No records available to download.");
      return;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = 20;

    const addText = (value: string, size = 11) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(value, pageWidth - 30);

      if (y + lines.length * 7 > 275) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(lines, 15, y);
      y += lines.length * 7;
    };

    pdf.setFontSize(23);
    pdf.text("MediCycle", 15, y);
    y += 12;

    addText("Medicine Waste Analytics Report", 16);
    addText(`Generated: ${new Date().toLocaleDateString("en-IN")}`);
    y += 5;

    addText("SUMMARY", 14);
    addText(`Total unused tablets: ${totalTablets}`);
    addText(`Estimated financial loss: INR ${totalLoss.toFixed(2)}`);
    addText(`Total records: ${records.length}`);
    y += 5;

    addText("WASTE BY REASON", 14);

    reasonEntries.forEach(([reason, quantity]) => {
      addText(`${reason}: ${quantity} tablets`);
    });

    y += 5;
    addText("WASTE BY MEDICINE", 14);

    medicineEntries.forEach(([medicine, quantity]) => {
      addText(`${medicine}: ${quantity} tablets`);
    });

    y += 5;
    addText("MONTHLY WASTE TREND", 14);

    monthlyEntries.forEach(([key, quantity]) => {
      const month = key.split("|")[1];
      addText(`${month}: ${quantity} tablets`);
    });

    y += 5;
    addText("INDIVIDUAL RECORDS", 14);

    records.forEach((record, index) => {
      const date =
        record.createdAt?.toDate?.()?.toLocaleDateString("en-IN") ||
        "Date unavailable";

      addText(
        `${index + 1}. ${record.medicineName} | ${record.unusedQuantity} tablets | ${record.reason} | INR ${Number(record.estimatedValue || 0).toFixed(2)} | ${date}`
      );
    });

    y += 5;
    addText(
      "Note: Financial values are estimates based on user-entered prices. Waste records do not independently verify physical disposal."
    );

    pdf.save("MediCycle-Waste-Analytics-Report.pdf");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <p className="text-green-700 font-semibold">
          Loading MediCycle Analytics...
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-5 py-10">
      <div className="max-w-6xl mx-auto">

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
            Waste Analytics Dashboard
          </h1>

          <p className="text-green-50">
            Understand medicine waste through statistics, charts and reports.
          </p>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
            <p className="text-gray-500 text-sm">Total Unused Tablets</p>
            <h2 className="text-3xl font-bold text-green-700 mt-2">
              {totalTablets}
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
            <p className="text-gray-500 text-sm">Estimated Financial Loss</p>
            <h2 className="text-3xl font-bold text-orange-600 mt-2">
              ₹{totalLoss.toFixed(2)}
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
            <p className="text-gray-500 text-sm">Total Waste Records</p>
            <h2 className="text-3xl font-bold text-blue-700 mt-2">
              {records.length}
            </h2>
          </div>
        </div>

        <div className="flex justify-end mb-7">
          <button
            onClick={downloadPDF}
            disabled={records.length === 0}
            className="rounded-xl bg-green-700 px-6 py-3 text-white font-bold hover:bg-green-800 disabled:opacity-50"
          >
            Download Analytics Report (PDF)
          </button>
        </div>

        {records.length === 0 ? (
          <section className="bg-white rounded-2xl shadow-md p-8 text-center">
            <h2 className="text-xl font-bold text-gray-800">
              No Analytics Available Yet
            </h2>

            <p className="text-gray-500 mt-2">
              Add waste records to see your analytics and charts.
            </p>

            <button
              onClick={() => router.push("/waste-intelligence/analyzer")}
              className="mt-5 rounded-xl bg-green-700 px-6 py-3 text-white font-semibold"
            >
              Record Medicine Waste
            </button>
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

              <section className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">
                  Waste by Reason
                </h2>

                {reasonEntries.map(([reason, quantity], index) => (
                  <div key={reason} className="mb-5">
                    <div className="flex justify-between text-sm mb-2 gap-3">
                      <span className="text-gray-700">{reason}</span>
                      <strong>{quantity} tablets</strong>
                    </div>

                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(quantity / maxReason) * 100}%`,
                          backgroundColor: colors[index % colors.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">
                  Waste Distribution
                </h2>

                <div className="flex flex-col items-center">
                  <div
                    className="w-48 h-48 rounded-full flex items-center justify-center"
                    style={{ background: pieGradient }}
                  >
                    <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center">
                      <p className="font-bold text-gray-700 text-center">
                        {totalTablets}
                        <br />
                        Tablets
                      </p>
                    </div>
                  </div>

                  <div className="w-full space-y-3 mt-6">
                    {reasonEntries.map(([reason, quantity], index) => (
                      <div key={reason} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: colors[index % colors.length] }}
                        />
                        <span className="flex-1 text-gray-700">{reason}</span>
                        <strong>{quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">
                  Medicine-wise Waste
                </h2>

                {medicineEntries.map(([medicine, quantity], index) => (
                  <div key={medicine} className="mb-5">
                    <div className="flex justify-between text-sm mb-2 gap-3">
                      <span className="text-gray-700">{medicine}</span>
                      <strong>{quantity} tablets</strong>
                    </div>

                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(quantity / maxMedicine) * 100}%`,
                          backgroundColor: colors[index % colors.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </section>

              <section className="bg-white rounded-2xl p-6 shadow-md border border-green-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">
                  Monthly Waste Trend
                </h2>

                {monthlyEntries.length === 0 ? (
                  <p className="text-gray-500">
                    Monthly data will appear for records with saved dates.
                  </p>
                ) : (
                  monthlyEntries.map(([key, quantity]) => (
                    <div key={key} className="mb-5">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-700">
                          {key.split("|")[1]}
                        </span>
                        <strong>{quantity} tablets</strong>
                      </div>

                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${(quantity / maxMonth) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>

            <section className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-green-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-5">
                Individual Waste Records
              </h2>

              <div className="space-y-4">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-xl border border-green-100 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div>
                      <h3 className="font-bold text-gray-800 text-lg">
                        {record.medicineName}
                      </h3>

                      <p className="text-sm text-gray-600 mt-1">
                        Quantity: {record.unusedQuantity} tablets
                      </p>

                      <p className="text-sm text-gray-600">
                        Reason: {record.reason}
                      </p>

                      <p className="text-green-700 font-bold mt-2">
                        Estimated value: ₹
                        {Number(record.estimatedValue || 0).toFixed(2)}
                      </p>
                    </div>

                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="rounded-lg bg-red-50 border border-red-200 text-red-600 px-5 py-2 font-semibold hover:bg-red-100"
                    >
                      Delete Record
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <p className="text-center text-xs text-gray-500 mt-7">
          MediCycle analytics use user-entered information and estimates.
          Deleting a waste record does not change medicine inventory or
          disposal history.
        </p>
      </div>
    </main>
  );
}
