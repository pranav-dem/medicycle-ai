
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type OCRResult = {
  text: string;
  score: number;
};

type MedicineDetails = {
  name: string;
  batch: string;
  quantity: number | null;
  expiry: string;
  pricePerUnit: number | null;
  priceMessage: string;
};

export default function AddMedicine() {
  const router = useRouter();

  const engineRef = useRef<any>(null);
  const initializationRef = useRef<Promise<any> | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [courseEndDate, setCourseEndDate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [libraryReady, setLibraryReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState<OCRResult[]>([]);
  const [ocrMessage, setOcrMessage] = useState("Loading OCR library...");
  const [priceMessage, setPriceMessage] = useState("");

  // Load PaddleOCR in the browser
  useEffect(() => {
    let active = true;

    if ((window as any).PaddleOCR) {
      setLibraryReady(true);
      setOcrMessage("OCR ready. Select a medicine image.");
      return;
    }

    let script = document.querySelector(
      'script[data-mc-ocr-loader="true"]'
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (!active) return;

      if ((window as any).PaddleOCR) {
        setLibraryReady(true);
        setOcrMessage("OCR ready. Select a medicine image.");
      } else {
        setOcrMessage("PaddleOCR could not initialize.");
      }
    };

    const handleError = () => {
      if (!active) return;

      setOcrMessage(
        "Unable to load OCR library. Check your internet connection and refresh."
      );
    };

    if (!script) {
      script = document.createElement("script");
      script.type = "module";
      script.src = "/ocr-loader.js";
      script.dataset.mcOcrLoader = "true";
    }

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!script.isConnected) {
      document.head.appendChild(script);
    }

    return () => {
      active = false;
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);

  // Initialize PaddleOCR
  async function initializeOCR() {
    if (engineRef.current) {
      return engineRef.current;
    }

    if (initializationRef.current) {
      return initializationRef.current;
    }

    const PaddleOCR = (window as any).PaddleOCR;

    if (!PaddleOCR) {
      throw new Error("PaddleOCR library is not available.");
    }

    const initialization = PaddleOCR.create({
      textDetectionModelName: "PP-OCRv6_tiny_det",
      textRecognitionModelName: "PP-OCRv6_tiny_rec",
      worker: false,
      ortOptions: {
        backend: "auto",
        numThreads: 1,
      },
    });

    initializationRef.current = initialization;

    try {
      const engine = await initialization;
      engineRef.current = engine;
      return engine;
    } catch (error) {
      initializationRef.current = null;
      throw error;
    }
  }

  // Parse expiry date
  function parseExpiryDate(text: string): string {
    const normalized = text.replace(/\s+/g, " ").trim();

    const labelPattern =
      /(?:EXP(?:IRY)?(?:\s+DATE)?|EXPIRES|USE\s+BEFORE)\s*[:.-]?\s*/i;

    const labelMatch = normalized.match(labelPattern);

    const dateText = labelMatch
      ? normalized.slice(labelMatch.index! + labelMatch[0].length)
      : normalized;

    let match = dateText.match(
      /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\b/
    );

    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const date = new Date(year, month - 1, day);

      if (
        year >= 2000 &&
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // MM/YYYY
    match = dateText.match(
      /\b(0?[1-9]|1[0-2])[\/.-](\d{4})\b/
    );

    if (match) {
      const month = Number(match[1]);
      const year = Number(match[2]);

      if (year >= 2000) {
        const lastDay = new Date(year, month, 0).getDate();

        return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      }
    }

    // YYYY/MM
    match = dateText.match(
      /\b(\d{4})[\/.-](0?[1-9]|1[0-2])\b/
    );

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);

      if (year >= 2000) {
        const lastDay = new Date(year, month, 0).getDate();

        return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      }
    }

    return "";
  }

  // Extract MRP from OCR text
  function extractMRP(text: string): number | null {
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (!/\bM\s*\.?\s*R\s*\.?\s*P\s*\.?\b/i.test(line)) {
        continue;
      }

      const afterMRP = line.replace(
        /^.*?\bM\s*\.?\s*R\s*\.?\s*P\s*\.?\b/i,
        ""
      );

      const priceMatch = afterMRP.match(
        /(?:₹|RS\.?|INR)?\s*(\d{1,5}(?:[.,]\d{1,2})?)\b/i
      );

      if (priceMatch) {
        const amount = Number(priceMatch[1].replace(",", "."));

        if (Number.isFinite(amount) && amount > 0 && amount < 100000) {
          return amount;
        }
      }
    }

    return null;
  }

  // Extract medicine information
  function extractMedicineDetails(
    results: OCRResult[]
  ): MedicineDetails {
    const lines = results
      .map((item) => item.text.replace(/^[-•]\s*/, "").trim())
      .filter((line) => line.length > 1);

    const fullText = lines.join("\n");

    let batch = "";

    for (let i = 0; i < lines.length; i++) {
      const sameLineMatch = lines[i].match(
        /\b(?:BATCH|LOT)\s*(?:NO\.?|NUMBER)?\s*[:#-]?\s*([A-Z0-9/-]{3,})/i
      );

      if (sameLineMatch) {
        batch = sameLineMatch[1];
        break;
      }

      if (
        /^\s*(?:BATCH|LOT)\s*(?:NO\.?|NUMBER)?\s*[:#-]?\s*$/i.test(
          lines[i]
        )
      ) {
        const nextLine = lines[i + 1] || "";

        if (/^[A-Z0-9/-]{3,}$/i.test(nextLine)) {
          batch = nextLine;
          break;
        }
      }
    }

    const quantityMatch = fullText.match(
      /\b(\d{1,3})\s*(?:TABLETS?|TABS?|CAPSULES?|CAPS?)\b/i
    );

    const extractedQuantity = quantityMatch
      ? Number(quantityMatch[1])
      : null;

    const mrp = extractMRP(fullText);

    let extractedPrice: number | null = null;
    let extractedPriceMessage = "";

    if (mrp !== null && extractedQuantity !== null && extractedQuantity > 0) {
      extractedPrice = Number((mrp / extractedQuantity).toFixed(2));
      extractedPriceMessage =
        `MRP ₹${mrp.toFixed(2)} detected. ` +
        `Divided by ${extractedQuantity} tablets per pack. ` +
        `Please verify the price.`;
    } else if (mrp !== null) {
      extractedPriceMessage =
        `MRP ₹${mrp.toFixed(2)} detected, but pack size was not detected. ` +
        "Enter the price per tablet manually.";
    } else {
      extractedPriceMessage =
        "MRP was not detected. Please enter the price per tablet manually.";
    }

    const excludedWords =
      /BATCH|LOT|EXPIRY|EXPIRES|MFG|MANUFACTURED|MRP|PRICE|QTY|CAPSULE|TABLET|SCHEDULE|STORAGE|CAUTION|PRIVATE|LIMITED|DISTRICT|PLOT|LIC|COMPOSITION|DOSAGE|STRIP|TABLETS|CAPSULES/i;

    const possibleName =
      lines.find((line) =>
        /ECOSPRIN|PARACETAMOL|ASPIRIN/i.test(line)
      ) ||
      lines.find(
        (line) =>
          /^[A-Z][A-Z0-9\s+-]{3,35}$/i.test(line) &&
          !excludedWords.test(line) &&
          !/^\d+$/.test(line) &&
          !/\d+\s*(?:MG|MCG|ML|IU)\b/i.test(line)
      ) ||
      "";

    return {
      name: possibleName,
      batch,
      quantity: extractedQuantity,
      expiry: parseExpiryDate(fullText),
      pricePerUnit: extractedPrice,
      priceMessage: extractedPriceMessage,
    };
  }

  // Handle selected image from camera or gallery
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;

    if (selectedFile && !selectedFile.type.startsWith("image/")) {
      alert("Please select a valid image.");
      event.target.value = "";
      return;
    }

    if (selectedFile && selectedFile.size > 15 * 1024 * 1024) {
      alert("Please select an image smaller than 15 MB.");
      event.target.value = "";
      return;
    }

    setPhoto(selectedFile);
    setOcrText([]);
    setPriceMessage("");

    if (selectedFile) {
      setOcrMessage("Image selected. Ready to scan.");
    } else {
      setOcrMessage("Please select a medicine image.");
    }

    // Allows selecting the same image again
    event.target.value = "";
  }

  // Scan medicine image
  async function handleScan() {
    if (!photo) {
      alert("Please select a medicine photo first.");
      return;
    }

    if (!libraryReady) {
      setOcrMessage("OCR library is still loading.");
      return;
    }

    try {
      setScanning(true);
      setOcrText([]);
      setOcrMessage("Initializing medicine scanner...");

      const engine = await initializeOCR();

      setOcrMessage("Reading medicine image...");

      const [result] = await engine.predict(photo);

      const extracted: OCRResult[] = (result?.items || [])
        .filter((item: any) => item.text?.trim())
        .map((item: any) => ({
          text: item.text.trim(),
          score: Number(item.score ?? 0),
        }));

      setOcrText(extracted);

      if (extracted.length === 0) {
        setOcrMessage(
          "No readable text found. Try a clearer image or enter details manually."
        );
        return;
      }

      const details = extractMedicineDetails(extracted);

      if (details.name) setName(details.name);
      if (details.batch) setBatchNumber(details.batch);

      if (details.quantity !== null) {
        setQuantity(String(details.quantity));
      }

      if (details.expiry) setExpiryDate(details.expiry);

      if (details.pricePerUnit !== null) {
        setPricePerUnit(details.pricePerUnit.toFixed(2));
      }

      setPriceMessage(details.priceMessage);

      setOcrMessage(
        "Scan completed! Check and correct every extracted detail before saving."
      );
    } catch (error) {
      console.error("PaddleOCR error:", error);

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setOcrMessage("OCR failed: " + errorMessage);
    } finally {
      setScanning(false);
    }
  }

  // Save medicine to Firebase
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      alert("Please login first.");
      router.push("/login");
      return;
    }

    if (
      !name.trim() ||
      !batchNumber.trim() ||
      !expiryDate ||
      !courseEndDate
    ) {
      alert("Please complete all required medicine details.");
      return;
    }

    const totalQuantity = Number(quantity);

    if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) {
      alert("Please enter a valid whole number of tablets.");
      return;
    }

    const unitPrice = Number(pricePerUnit);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      alert("Please enter a valid medicine price.");
      return;
    }

    if (courseEndDate > expiryDate) {
      alert(
        "Course end date cannot be after the medicine expiry date."
      );
      return;
    }

    const totalPurchaseValue = Number(
      (totalQuantity * unitPrice).toFixed(2)
    );

    try {
      setLoading(true);

      await addDoc(collection(db, "medicines"), {
        name: name.trim(),
        batchNumber: batchNumber.trim(),
        quantity: totalQuantity,
        initialQuantity: totalQuantity,
        consumedQuantity: 0,
        disposedQuantity: 0,
        pricePerUnit: unitPrice,
        totalPurchaseValue,
        expiryDate,
        courseEndDate,
        disposalStatus: "Not disposed",
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      alert("Medicine added successfully!");
      router.push("/inventory");
    } catch (error) {
      console.error(error);
      alert("Error adding medicine. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Calculate total purchase value
  const totalValue = (
    (Number(quantity) || 0) * (Number(pricePerUnit) || 0)
  ).toFixed(2);

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 p-5 md:p-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-extrabold text-green-900">
              MediCycle 💚
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Smart Medicine Lifecycle Management
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl bg-green-800 px-4 py-2.5 font-semibold text-white"
          >
            ← Dashboard
          </button>
        </header>

        <section className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-gradient-to-r from-green-800 to-emerald-600 p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-4xl">
                💊
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-green-100">
                  Medicine Management
                </p>
                <h2 className="mt-1 text-3xl font-extrabold">
                  Add Medicine
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-green-50">
              Scan your medicine packaging or enter your medicine details manually.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 p-6 md:p-8"
          >
            {/* OCR SCANNER */}
            <div className="rounded-2xl border-2 border-dashed border-green-300 bg-green-50 p-5">
              <h3 className="text-lg font-extrabold text-green-900">
                📷 Scan Medicine Packaging
              </h3>

              <p className="mt-2 text-sm text-gray-600">
                Take a new photo using your camera or choose an existing medicine image from your gallery.
              </p>

              {/* Camera input */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Gallery input */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="rounded-xl bg-green-800 p-4 font-bold text-white hover:bg-green-900"
                >
                  📸 Take Photo
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="rounded-xl border-2 border-green-700 bg-white p-4 font-bold text-green-800 hover:bg-green-100"
                >
                  🖼️ Choose from Gallery
                </button>
              </div>

              {photo && (
                <div className="mt-3 rounded-lg bg-white p-3">
                  <p className="break-all text-sm font-medium text-green-800">
                    Selected: {photo.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {(photo.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      setOcrText([]);
                      setPriceMessage("");
                      setOcrMessage("Please select a medicine image.");
                    }}
                    className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                  >
                    Remove selected image
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleScan}
                disabled={!photo || scanning || !libraryReady}
                className="mt-4 w-full rounded-xl bg-green-800 p-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning
                  ? "Scanning Medicine..."
                  : !libraryReady
                    ? "Loading OCR..."
                    : "🔍 Scan with PaddleOCR"}
              </button>

              <div
                className="mt-3 rounded-lg bg-white p-3 text-sm text-gray-700"
                aria-live="polite"
              >
                {ocrMessage}
              </div>

              {priceMessage && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  💰 {priceMessage}
                </div>
              )}

              {ocrText.length > 0 && (
                <div className="mt-4 rounded-xl bg-white p-4">
                  <h4 className="font-bold text-green-900">
                    Extracted Text
                  </h4>

                  <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-gray-700">
                    {ocrText.map((item, index) => (
                      <li key={index}>
                        <p className="break-words">{item.text}</p>
                        <span className="text-xs text-gray-400">
                          Confidence: {(item.score * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-3 text-xs text-gray-500">
                OCR may make mistakes. Always verify medicine details against the original packaging.
              </p>
            </div>

            {/* MEDICINE NAME */}
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                💊 Medicine Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Paracetamol"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
            </div>

            {/* BATCH NUMBER */}
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                🏷️ Batch Number
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="Enter batch number"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
            </div>

            {/* QUANTITY */}
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                📦 Total Tablets / Capsules
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter actual number of tablets"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                Enter the actual number of tablets or capsules you have. Check this value before saving.
              </p>
            </div>

            {/* MEDICINE PRICE */}
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                💰 Price per Tablet / Capsule (₹)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(e.target.value)}
                placeholder="Example: 2.50"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                Enter the price of one tablet or capsule, not the entire strip. Verify any automatically detected price.
              </p>
            </div>

            {/* PURCHASE VALUE PREVIEW */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">
                Estimated Total Purchase Value
              </p>
              <p className="mt-1 text-2xl font-extrabold text-green-900">
                ₹{totalValue}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Total quantity × price per tablet/capsule
              </p>
            </div>

            {/* EXPIRY DATE */}
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                📅 Medicine Expiry Date
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                If only month and year are printed, OCR uses the last day of that month as a placeholder. Verify it manually.
              </p>
            </div>

            {/* COURSE END DATE */}
            <div>
              <label className="mb-2 block font-bold text-gray-700">
                🩺 Prescribed Course End Date
              </label>
              <input
                type="date"
                required
                value={courseEndDate}
                onChange={(e) => setCourseEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-800 outline-none focus:border-green-600 focus:bg-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                Enter the end date given in your prescription.
              </p>
            </div>

            {/* SAVE MEDICINE */}
            <button
              type="submit"
              disabled={loading || scanning}
              className="w-full rounded-xl bg-gradient-to-r from-green-700 to-emerald-600 p-4 font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Saving Medicine..." : "+ Save Medicine"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/inventory")}
              className="w-full rounded-xl border border-green-200 bg-green-50 p-3 font-semibold text-green-800 hover:bg-green-100"
            >
              View Medicine Inventory
            </button>
          </form>
        </section>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 MediCycle. Smart Medicine Lifecycle Management.
        </p>
      </div>
    </main>
  );
}
