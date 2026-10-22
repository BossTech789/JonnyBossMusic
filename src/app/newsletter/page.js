"use client";

import { useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function NewsletterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail) {
      setMessage("Please enter your name and email address.");
      return;
    }

    if (!consent) {
      setMessage("Please agree to receive newsletter updates.");
      return;
    }

    setSubmitting(true);

    try {
      await addDoc(collection(db, "newsletterSubscribers"), {
        name: cleanName,
        email: cleanEmail,
        status: "active",
        subscribedAt: serverTimestamp(),
      });

      setSuccess(true);
      setMessage(
        "You're subscribed! Thank you for joining the Jonny Boss community."
      );
      setName("");
      setEmail("");
      setConsent(false);
    } catch (error) {
      console.error("Newsletter subscription failed:", error);

      setMessage(
        "We couldn't complete your subscription. Please try again shortly."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-[75vh] items-center justify-center overflow-hidden bg-[#120906] px-4 py-14 text-[#f5eee8] sm:px-8 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#70432c]/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#56301f]/30 blur-3xl"
      />

      <section className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#56301f] bg-[#1c0d08]/95 shadow-2xl shadow-black/30">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#56301f] via-[#c9a17e] to-[#70432c]" />

        <div className="p-6 sm:p-10 lg:p-12">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-[#c9a17e] transition hover:text-[#f5eee8]"
          >
            <span aria-hidden="true">←</span> Back to Home
          </Link>

          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#70432c] bg-[#2b140d] text-3xl text-[#d7ad88]">
            <span aria-hidden="true">✉</span>
          </div>

          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#a97955] sm:text-sm">
            Stay Connected
          </p>

          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Join the
            <span className="block text-[#c9a17e] sm:inline">
              {" "}Newsletter
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-7 text-[#c9b9ae] sm:text-base">
            Be the first to hear about new music, official videos, upcoming
            releases, and news from Jonny Boss, delivered straight to your inbox.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-6">
            <div>
              <label
                htmlFor="newsletter-name"
                className="mb-2 block text-sm font-semibold text-[#f5eee8]"
              >
                Your name
              </label>

              <input
                id="newsletter-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                maxLength={100}
                required
                disabled={submitting}
                className="w-full rounded-xl border border-[#56301f] bg-[#120906] px-4 py-3.5 text-[#f5eee8] outline-none transition placeholder:text-[#806b5d] focus:border-[#c9a17e] focus:ring-2 focus:ring-[#70432c]/40 disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="newsletter-email"
                className="mb-2 block text-sm font-semibold text-[#f5eee8]"
              >
                Email address
              </label>

              <input
                id="newsletter-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                maxLength={254}
                required
                disabled={submitting}
                className="w-full rounded-xl border border-[#56301f] bg-[#120906] px-4 py-3.5 text-[#f5eee8] outline-none transition placeholder:text-[#806b5d] focus:border-[#c9a17e] focus:ring-2 focus:ring-[#70432c]/40 disabled:opacity-60"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-[#c9b9ae]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                required
                disabled={submitting}
                className="mt-1 h-4 w-4 shrink-0 accent-[#c9a17e]"
              />

              <span>
                I agree to receive email updates from Jonny Boss. I understand
                that I can unsubscribe from future emails.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#c9a17e] px-5 py-4 font-bold text-[#120906] transition hover:bg-[#dfbea0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Subscribing..." : "Subscribe to Newsletter"}
            </button>

            {message && (
              <p
                role="status"
                aria-live="polite"
                className={`rounded-xl border p-4 text-sm leading-6 ${
                  success
                    ? "border-[#70432c] bg-[#2b140d] text-[#e4c7ad]"
                    : "border-red-900 bg-red-950/30 text-red-300"
                }`}
              >
                {message}
              </p>
            )}
          </form>

          <div className="mt-8 border-t border-[#56301f] pt-6">
            <p className="text-xs leading-6 text-[#a99587]">
              Your email address will be used for Jonny Boss newsletter
              updates and will not be displayed publicly. You can unsubscribe
              from future communications.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}