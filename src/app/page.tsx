
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
    return <p className="p-8">Loading...</p>;
  }

  return (
    <main className="min-h-screen bg-green-50 p-6">
      <div className="mx-auto max-w-5xl">

        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-green-800">
            MediCycle AI
          </h1>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-5 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </header>

        <section className="mt-10 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, {user.displayName || user.email}!
          </h2>

          <p className="mt-3 text-gray-600">
            Your Smart Medicine Reminder and Disposal System.
          </p>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">

          <div className="rounded-2xl bg-white p-7 shadow">
            <div className="text-4xl">💊</div>

            <h2 className="mt-4 text-xl font-bold text-green-800">
              Add Medicine
            </h2>

            <p className="mt-2 text-gray-600">
              Add medicine name, batch number, quantity and expiry date.
            </p>

            <button
              onClick={() => router.push("/medicines")}
              className="mt-5 w-full rounded-lg bg-green-700 p-3 font-semibold text-white hover:bg-green-800"
            >
              Add Medicine
            </button>
          </div>

          <div className="rounded-2xl bg-white p-7 shadow">
            <div className="text-4xl">📦</div>

            <h2 className="mt-4 text-xl font-bold text-green-800">
              Medicine Inventory
            </h2>

            <p className="mt-2 text-gray-600">
              View saved medicines, quantities and expiry status.
            </p>

            <button
              onClick={() => router.push("/inventory")}
              className="mt-5 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white hover:bg-blue-800"
            >
              View Inventory
            </button>
          </div>

        </section>

        <footer className="mt-10 text-center text-sm text-gray-500">
          MediCycle AI - Smart Medicine Lifecycle Management
        </footer>

      </div>
    </main>
  );
}
