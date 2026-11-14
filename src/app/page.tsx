
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.replace("/login");
      }
      setChecking(false);
    });

    return () => unsubscribe();
  }, [router]);

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  if (checking || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-green-50">
        <p className="text-lg font-semibold text-green-800">
          Loading MediCycle...
        </p>
      </div>
    );
  }

  const features = [
    {
      icon: "💊",
      title: "Add Medicine",
      description:
        "Add medicine name, batch number, quantity and expiry date.",
      button: "Add Medicine",
      path: "/medicines",
      color: "from-emerald-500 to-green-700",
      background: "bg-emerald-50",
    },
    {
      icon: "📦",
      title: "Medicine Inventory",
      description:
        "Manage saved medicines, monitor quantities and check expiry status.",
      button: "View Inventory",
      path: "/inventory",
      color: "from-blue-500 to-indigo-600",
      background: "bg-blue-50",
    },
    {
      icon: "📊",
      title: "Medicine Waste Management",
      description:
        "Analyze unused medicines, understand waste reasons and estimate financial loss.",
      button: "Explore Waste Management",
      path: "/waste-intelligence",
      color: "from-purple-500 to-violet-700",
      background: "bg-purple-50",
    },
    {
      icon: "⏰",
      title: "Medicine Reminders",
      description:
        "Manage your medicine schedules and daily reminders.",
      button: "View Reminders",
      path: "/reminders",
      color: "from-orange-400 to-amber-600",
      background: "bg-orange-50",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100">

      <div className="mx-auto max-w-7xl px-5 py-6 md:px-10">

        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-100 bg-white/90 p-5 shadow-sm">

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 text-2xl shadow-lg">
              💚
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-green-900">
                MediCycle
              </h1>
              <p className="text-xs font-medium text-gray-500">
                Smart Medicine Lifecycle Management
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-red-50 px-5 py-2.5 font-semibold text-red-600 transition hover:bg-red-100 hover:shadow"
          >
            ↪ Logout
          </button>

        </header>

        {/* Welcome Section */}
        <section className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-r from-green-800 via-green-700 to-emerald-600 p-8 text-white shadow-xl md:p-12">

          <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/10" />

          <div className="relative z-10 max-w-2xl">

            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-green-100">
              Your Personal Medicine Dashboard
            </p>

            <h2 className="text-3xl font-extrabold leading-tight md:text-5xl">
              Welcome back,
              <br />
              {user.displayName || user.email?.split("@")[0] || "User"}! 👋
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-7 text-green-50 md:text-base">
              Take control of your medicines. Track inventory,
              manage reminders, reduce medicine waste and
              encourage safe disposal.
            </p>

            <button
              onClick={() => router.push("/medicines")}
              className="mt-7 rounded-xl bg-white px-6 py-3 font-bold text-green-800 shadow-lg transition hover:-translate-y-1 hover:bg-green-50"
            >
              + Add New Medicine
            </button>

          </div>

          <div className="absolute bottom-5 right-8 hidden text-8xl opacity-20 md:block">
            💊
          </div>

        </section>

        {/* Section Heading */}
        <section className="mb-6 mt-10">

          <p className="text-sm font-bold uppercase tracking-widest text-green-600">
            Manage Your Health
          </p>

          <h2 className="mt-2 text-2xl font-extrabold text-gray-800 md:text-3xl">
            Explore Your Dashboard
          </h2>

          <p className="mt-2 text-gray-500">
            Choose a feature to manage your medicine lifecycle.
          </p>

        </section>

        {/* Feature Cards */}
        <section className="grid gap-6 sm:grid-cols-2">

          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-3xl border border-gray-100 bg-white p-7 shadow-md transition duration-300 hover:-translate-y-2 hover:shadow-xl"
            >

              <div className="flex items-start justify-between">

                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${feature.background} text-3xl transition group-hover:scale-110`}>
                  {feature.icon}
                </div>

                <span className="text-2xl text-gray-300 transition group-hover:translate-x-1 group-hover:text-green-600">
                  →
                </span>

              </div>

              <h3 className="mt-6 text-xl font-bold text-gray-800">
                {feature.title}
              </h3>

              <p className="mt-3 min-h-12 text-sm leading-6 text-gray-500">
                {feature.description}
              </p>

              <button
                onClick={() => router.push(feature.path)}
                className={`mt-6 w-full rounded-xl bg-gradient-to-r ${feature.color} px-5 py-3 font-bold text-white shadow-md transition hover:brightness-110 hover:shadow-lg`}
              >
                {feature.button} →
              </button>

            </div>
          ))}

        </section>

        {/* Bottom Information */}
        <section className="mt-10 rounded-2xl border border-green-100 bg-white p-6 text-center shadow-sm">

          <div className="text-3xl">🌱</div>

          <h3 className="mt-3 text-lg font-bold text-green-900">
            Better Medicine Management, Less Waste
          </h3>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            MediCycle helps you keep track of medicines,
            understand unused stock and learn about responsible
            medicine disposal.
          </p>

        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-sm text-gray-400">
          © 2026 MediCycle. Smart Medicine Lifecycle Management.
        </footer>

      </div>
    </main>
  );
}
