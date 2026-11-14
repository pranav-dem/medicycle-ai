
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const features = [
  {
    icon: "📊",
    title: "Waste Analyzer & Financial Loss Calculator",
    description:
      "Record why medicines remain unused and estimate their financial value.",
    tag: "Waste Tracking & Cost Estimation",
    color: "from-green-500 to-emerald-600",
    path: "/waste-intelligence/analyzer",
  },
  {
    icon: "📈",
    title: "Waste Analytics",
    description:
      "View waste statistics, charts, medicine-wise reports and download PDF reports.",
    tag: "Reports & Insights",
    color: "from-blue-500 to-cyan-600",
    path: "/waste-intelligence/analytics",
  },
  {
    icon: "🔔",
    title: "Smart Medicine Refill Planner",
    description:
      "Estimate how many days your current medicine stock will last.",
    tag: "Stock Planning",
    color: "from-purple-500 to-violet-600",
    path: "/waste-intelligence/refill",
  },
  {
    icon: "♻️",
    title: "Safe Medicine Disposal Awareness",
    description:
      "Learn responsible ways to handle and dispose of unused medicines.",
    tag: "Safety & Awareness",
    color: "from-orange-500 to-amber-600",
    path: "/waste-intelligence/safe-disposal",
  },
];

export default function WasteIntelligencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <p className="text-green-700 font-medium">Loading MediCycle...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-5 py-10">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/")}
          className="mb-8 rounded-xl border border-green-200 bg-white px-5 py-2.5 text-green-700 font-semibold hover:bg-green-50"
        >
          ← Back to Dashboard
        </button>

        <section className="rounded-3xl bg-gradient-to-r from-green-700 to-emerald-500 p-8 md:p-12 text-white shadow-xl mb-10">
          <p className="text-green-100 font-semibold tracking-wider text-sm mb-3">
            MEDICYCLE
          </p>

          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Smart Medicine Waste Intelligence
          </h1>

          <p className="text-green-50 text-base md:text-lg max-w-2xl">
            Understand medicine waste, estimate financial loss, plan refills
            and learn responsible medicine disposal.
          </p>
        </section>

        <div className="mb-7">
          <h2 className="text-2xl font-bold text-gray-800">
            Explore Features
          </h2>
          <p className="text-gray-600 mt-2">
            Select a feature to continue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <button
              key={feature.path}
              onClick={() => router.push(feature.path)}
              className="group text-left rounded-2xl bg-white border border-green-100 p-7 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-3xl shadow-md`}
                >
                  {feature.icon}
                </div>

                <span className="text-xs font-semibold text-green-700 bg-green-50 rounded-full px-3 py-2">
                  {feature.tag}
                </span>
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-green-700">
                {feature.title}
              </h3>

              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>

              <div className="mt-6 text-green-700 font-semibold">
                Open Feature →
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-gray-500 mt-10">
          MediCycle – Manage medicines responsibly and reduce avoidable waste.
        </p>
      </div>
    </main>
  );
}
