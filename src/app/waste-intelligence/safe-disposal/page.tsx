
"use client";

import { useRouter } from "next/navigation";

const disposalTips = [
  {
    icon: "🔍",
    title: "Check the Medicine",
    description:
      "Check the medicine name, expiry date and packaging. Keep damaged or expired medicines separate.",
  },
  {
    icon: "💊",
    title: "Do Not Share Medicines",
    description:
      "Never give unused prescription medicines to another person. Medicines should only be used by the person they were prescribed for.",
  },
  {
    icon: "🏥",
    title: "Ask a Pharmacist",
    description:
      "Contact a pharmacist or healthcare professional to learn the appropriate disposal method for your medicine.",
  },
  {
    icon: "♻️",
    title: "Use Take-Back Facilities",
    description:
      "Where available, use an authorised medicine collection or take-back facility.",
  },
  {
    icon: "🔒",
    title: "Store Safely Until Disposal",
    description:
      "Keep unused medicines in their original packaging, away from children and pets, until you can dispose of them safely.",
  },
  {
    icon: "🚫",
    title: "Avoid Unsafe Disposal",
    description:
      "Do not throw medicines into open areas, burn them, or flush them unless official instructions specifically recommend it.",
  },
];

export default function SafeDisposalPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-5 py-10">
      <div className="max-w-5xl mx-auto">

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
            Safe Medicine Disposal Awareness
          </h1>

          <p className="text-green-50 text-base md:text-lg">
            Learn how to handle unused and expired medicines responsibly
            and protect people, animals and the environment.
          </p>
        </section>

        <section className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-green-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Why Is Safe Disposal Important?
          </h2>

          <p className="text-gray-600 leading-relaxed">
            Improper disposal of medicines can create risks for people,
            animals and the environment. Responsible disposal helps prevent
            accidental consumption, misuse and environmental contamination.
          </p>
        </section>

        <h2 className="text-2xl font-bold text-gray-800 mb-5">
          Safe Disposal Guidelines
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {disposalTips.map((tip) => (
            <div
              key={tip.title}
              className="bg-white rounded-2xl p-6 shadow-md border border-green-100 hover:shadow-lg transition"
            >
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-3xl mb-4">
                {tip.icon}
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-3">
                {tip.title}
              </h3>

              <p className="text-gray-600 leading-relaxed">
                {tip.description}
              </p>
            </div>
          ))}
        </div>

        <section className="rounded-2xl bg-amber-50 border border-amber-200 p-6 md:p-8 mb-8">
          <h2 className="text-xl font-bold text-amber-900 mb-3">
            Important Safety Reminder
          </h2>

          <p className="text-amber-900 leading-relaxed">
            Disposal methods depend on the type of medicine and local
            regulations. Always ask a pharmacist or follow official
            disposal instructions. Do not assume that every medicine
            can be disposed of in the same way.
          </p>
        </section>

        <section className="bg-white rounded-2xl p-6 md:p-8 shadow-md border border-green-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Official Disposal Guidance
          </h2>

          <p className="text-gray-600 mb-5">
            Refer to official guidance from India's Central Drugs Standard
            Control Organisation (CDSCO).
          </p>

          <a
            href="https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadPublic_NoticesFiles/Guidance%20document%20on%20disposal.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3"
          >
            View CDSCO Disposal Guidelines →
          </a>

          <p className="text-sm text-gray-500 mt-4">
            If the document is unavailable, visit the official CDSCO
            Public Notices page.
          </p>

          <a
            href="https://cdsco.gov.in/opencms/opencms/en/Notifications/Public-Notices/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 font-semibold underline"
          >
            CDSCO Public Notices →
          </a>
        </section>

        <div className="text-center mt-8">
          <button
            onClick={() => router.push("/waste-intelligence")}
            className="rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold px-7 py-3"
          >
            Back to All Features
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-7">
          MediCycle provides educational awareness only. Follow professional
          advice and applicable local disposal rules.
        </p>

      </div>
    </main>
  );
}
