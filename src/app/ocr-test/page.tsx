"use client";

import { useEffect, useRef, useState } from "react";

type OCRResult = {
  text: string;
  score: number;
};

export default function OCRTestPage() {
  const engineRef = useRef<any>(null);

  const [file, setFile] = useState<File | null>(null);
  const [libraryReady, setLibraryReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Loading OCR library...");
  const [results, setResults] = useState<OCRResult[]>([]);
  const [scanTime, setScanTime] = useState<number | null>(null);

  // Load PaddleOCR directly in the browser
  useEffect(() => {
    let active = true;

    if ((window as any).PaddleOCR) {
      setLibraryReady(true);
      setStatus("OCR library ready. Select a medicine image.");
      return;
    }

    let script = document.querySelector(
      'script[data-mc-ocr-loader="true"]'
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (!active) return;

      if ((window as any).PaddleOCR) {
        setLibraryReady(true);
        setStatus("OCR library ready. Select a medicine image.");
      } else {
        setStatus("PaddleOCR could not initialize.");
      }
    };

    const handleError = () => {
      if (!active) return;

      setStatus(
        "Failed to load OCR library. Check your internet connection and refresh."
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

  // Initialize the lightweight OCR engine
  async function initializeOCR() {
    if (engineRef.current) {
      return engineRef.current;
    }

    const PaddleOCR = (window as any).PaddleOCR;

    if (!PaddleOCR) {
      throw new Error("PaddleOCR library is not available.");
    }

    setStatus("Downloading lightweight OCR models...");

    const engine = await PaddleOCR.create({
      textDetectionModelName: "PP-OCRv6_tiny_det",
      textRecognitionModelName: "PP-OCRv6_tiny_rec",

      worker: false,

      ortOptions: {
        backend: "auto",
        numThreads: 1,
      },
    });

    engineRef.current = engine;

    return engine;
  }

  // Scan medicine image
  async function scanImage() {
    if (!file) {
      setStatus("Please select a medicine image first.");
      return;
    }

    if (!libraryReady) {
      setStatus("OCR library is still loading.");
      return;
    }

    setLoading(true);
    setResults([]);
    setScanTime(null);

    const startTime = performance.now();

    try {
      const engine = await initializeOCR();

      setStatus("Reading medicine image...");

      const [result] = await engine.predict(file);

      const extracted: OCRResult[] = (result?.items || [])
        .filter((item: any) => item.text?.trim())
        .map((item: any) => ({
          text: item.text.trim(),
          score: Number(item.score ?? 0),
        }));

      setResults(extracted);

      const duration = (
        (performance.now() - startTime) / 1000
      ).toFixed(2);

      setScanTime(Number(duration));

      if (extracted.length > 0) {
        setStatus("Medicine image scanned successfully!");
      } else {
        setStatus(
          "No readable text found. Try a clearer image with better lighting."
        );
      }
    } catch (error) {
      console.error("PaddleOCR error:", error);

      const message =
        error instanceof Error ? error.message : String(error);

      setStatus("OCR failed: " + message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0] || null;

    setFile(selectedFile);
    setResults([]);
    setScanTime(null);

    if (selectedFile) {
      setStatus("Image selected. Ready to scan.");
    } else {
      setStatus("Please select a medicine image.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-5 shadow-md sm:p-8">

        <h1 className="mb-2 text-2xl font-bold">
          MediCycle AI - OCR Test
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          Scan medicine strips and boxes to extract printed text.
        </p>

        <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="font-medium text-blue-800">
            Lightweight Mobile OCR
          </p>
          <p className="mt-1 text-sm text-blue-700">
            Uses PP-OCRv6 Tiny for browser-based text recognition.
          </p>
        </div>

        <label className="mb-2 block font-semibold">
          Capture or upload medicine image
        </label>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="block w-full rounded-lg border p-3 text-sm"
        />

        {file && (
          <div className="mt-3 rounded-lg bg-gray-100 p-3">
            <p className="text-sm font-medium">
              Selected image:
            </p>
            <p className="break-all text-sm text-gray-600">
              {file.name}
            </p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}

        <button
          onClick={scanImage}
          disabled={!file || loading || !libraryReady}
          className="mt-5 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Scanning medicine..." : "Scan Medicine"}
        </button>

        <div
          className="mt-5 rounded-lg border bg-gray-50 p-4"
          aria-live="polite"
        >
          <p className="font-medium">Status</p>
          <p className="mt-1 break-words text-sm text-gray-700">
            {status}
          </p>
        </div>

        {scanTime !== null && (
          <div className="mt-3 rounded-lg bg-green-50 p-3">
            <p className="font-medium text-green-800">
              Scan time: {scanTime} seconds
            </p>
          </div>
        )}

        {results.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 text-xl font-bold">
              Extracted Medicine Text
            </h2>

            <p className="mb-3 text-sm text-gray-500">
              Detected {results.length} text lines.
            </p>

            <div className="space-y-3">
              {results.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border p-3"
                >
                  <p className="break-words font-medium">
                    {item.text}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Confidence
                    </span>

                    <span className="text-xs font-semibold">
                      {(item.score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-7 text-center text-xs text-gray-400">
          MediCycle AI | Browser-based OCR testing
        </p>

      </div>
    </main>
  );
}