
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
    <main className="flex min-h-screen items-center justify-center bg-green-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">

        <h1 className="text-center text-3xl font-bold text-green-800">
          MediCycle AI
        </h1>

        <p className="mt-2 text-center text-gray-500">
          Smart Medicine Reminder and Disposal System
        </p>

        <h2 className="mt-8 text-2xl font-bold text-gray-800">
          {register ? "Create Account" : "Welcome Back"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">

          {register && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border p-3 text-gray-800"
            />
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border p-3 text-gray-800"
          />

          <input
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            className="w-full rounded-lg border p-3 text-gray-800"
          />

          {message && (
            <p className="text-sm text-red-600">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-700 p-3 font-bold text-white hover:bg-green-800"
          >
            {loading
              ? "Please wait..."
              : register
              ? "Create Account"
              : "Login"}
          </button>

        </form>

        <p className="mt-6 text-center text-gray-600">
          {register
            ? "Already have an account?"
            : "Don't have an account?"}

          <button
            type="button"
            onClick={() => {
              setRegister(!register);
              setMessage("");
            }}
            className="ml-2 font-bold text-green-700"
          >
            {register ? "Login" : "Register"}
          </button>
        </p>

      </div>
    </main>
  );
}
