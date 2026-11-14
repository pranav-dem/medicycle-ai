
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [register, setRegister] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (register) {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await updateProfile(result.user, {
          displayName: name,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      router.push("/");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 via-white to-emerald-100 p-5">

      {/* Background Decorations */}
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-green-200/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">

        {/* Left Side */}
        <section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 p-10 text-white md:p-12">

          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[30px] border-white/10" />
          <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full border-[30px] border-white/10" />

          <div className="relative z-10">

            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-4xl shadow-lg">
              💚
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              MediCycle
            </h1>

            <p className="mt-4 text-lg font-medium text-green-100">
              Smart Medicine Lifecycle Management
            </p>

            <p className="mt-8 leading-7 text-green-50">
              Take control of your medicines with one simple platform.
              Track inventory, manage reminders, understand medicine
              waste and learn about safe disposal.
            </p>

            <div className="mt-10 space-y-5">

              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">
                  💊
                </span>
                <span className="font-medium">Smart Medicine Tracking</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">
                  📊
                </span>
                <span className="font-medium">Medicine Waste Analysis</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl">
                  🌱
                </span>
                <span className="font-medium">Responsible Medicine Disposal</span>
              </div>

            </div>

          </div>

          <div className="relative z-10 mt-12 text-sm text-green-100">
            Better Medicine Management. Less Waste.
          </div>

        </section>

        {/* Right Side - Form */}
        <section className="flex flex-col justify-center p-8 md:p-12">

          <div className="mb-8">

            <p className="text-sm font-bold uppercase tracking-widest text-green-600">
              Welcome to MediCycle
            </p>

            <h2 className="mt-3 text-3xl font-extrabold text-gray-800">
              {register ? "Create Account" : "Welcome Back"}
            </h2>

            <p className="mt-3 text-sm text-gray-500">
              {register
                ? "Create your account to get started."
                : "Login to continue managing your medicines."}
            </p>

          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {register && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Full Name
                </label>

                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 outline-none transition focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Email Address
              </label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 outline-none transition focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Password
              </label>

              <input
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-gray-800 outline-none transition focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-100"
              />
            </div>

            {message && (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 p-4 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : register
                ? "Create My Account →"
                : "Login to MediCycle →"}
            </button>

          </form>

          <div className="mt-8 text-center">

            <p className="text-sm text-gray-500">
              {register
                ? "Already have an account?"
                : "Don't have an account?"}

              <button
                type="button"
                onClick={() => {
                  setRegister(!register);
                  setMessage("");
                }}
                className="ml-2 font-bold text-green-700 transition hover:text-green-900"
              >
                {register ? "Login" : "Register"}
              </button>
            </p>

          </div>

          <p className="mt-10 text-center text-xs text-gray-400">
            © 2026 MediCycle. All rights reserved.
          </p>

        </section>

      </div>
    </main>
  );
}
