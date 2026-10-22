"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const [authorized, setAuthorized] = useState(false);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const subscribersQuery = query(
        collection(db, "newsletterSubscribers"),
        orderBy("subscribedAt", "desc")
      );

      const snapshot = await getDocs(subscribersQuery);

      setSubscribers(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    } catch (err) {
      console.error("Subscriber loading error:", err);
      setError(
        "Unable to load subscribers. Check your admin access and Firestore rules."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    setCampaignsError("");

    try {
      const user = auth.currentUser;

      if (!user) {
        setCampaignsError(
          "Please sign in to your administrator account to view campaign history."
        );
        return;
      }

      const token = await user.getIdToken();

      const response = await fetch("/api/admin/newsletter/send", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const responseText = await response.text();
      let result = {};

      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(
            `Invalid server response (HTTP ${response.status}).`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Unable to load campaigns (HTTP ${response.status}).`
        );
      }

      setCampaigns(
        Array.isArray(result.campaigns) ? result.campaigns : []
      );
    } catch (err) {
      console.error("Campaign history error:", err);
      setCampaignsError(
        err.message || "Unable to load campaign history."
      );
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      if (!user) {
        setAuthorized(false);
        setLoading(false);
        setCampaignsLoading(false);
        window.location.replace("/login");
        return;
      }

      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const userSnapshot = await getDoc(doc(db, "users", user.uid));

        if (!active) return;

        const profile = userSnapshot.exists()
          ? userSnapshot.data()
          : null;

        if (
          !profile ||
          profile.role !== "admin" ||
          profile.active !== true
        ) {
          setAuthorized(false);
          window.location.replace("/login");
          return;
        }

        setAuthorized(true);
        await Promise.all([loadSubscribers(), loadCampaigns()]);
      } catch (err) {
        console.error("Admin authorization error:", err);

        if (active) {
          setAuthorized(false);
          setLoading(false);
          setCampaignsLoading(false);
          setError("Unable to verify administrator access.");
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadSubscribers, loadCampaigns]);

  const activeSubscribers = subscribers.filter(
    (subscriber) => subscriber.status === "active"
  );

  const unsubscribedSubscribers = subscribers.filter(
    (subscriber) => subscriber.status === "unsubscribed"
  );

  const otherSubscribers = subscribers.filter(
    (subscriber) =>
      subscriber.status !== "active" &&
      subscriber.status !== "unsubscribed"
  );

  async function handleSendCampaign(event) {
    event.preventDefault();
    setNotice("");

    if (!subject.trim() || !message.trim()) {
      setNotice("Enter an email subject and message.");
      return;
    }

    if (!auth.currentUser) {
      setNotice("Please sign in to your admin account first.");
      return;
    }

    if (activeSubscribers.length === 0) {
      setNotice("There are no active subscribers to email.");
      return;
    }

    const confirmed = window.confirm(
      `Send this campaign to ${activeSubscribers.length} active subscribers? This will email real subscribers.`
    );

    if (!confirmed) return;

    setSending(true);

    try {
      const token = await auth.currentUser.getIdToken();

      const response = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const responseText = await response.text();
      let result = {};

      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch {
          throw new Error(
            `Invalid server response (HTTP ${response.status}). Check your terminal for errors.`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            `Unable to send campaign (HTTP ${response.status}).`
        );
      }

      setNotice(result.message || "Campaign finished.");
      setSubject("");
      setMessage("");

      await Promise.all([loadCampaigns(), loadSubscribers()]);
    } catch (err) {
      console.error("Newsletter campaign error:", err);
      setNotice(
        err.message || "Unable to send the campaign. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  function formatDate(value) {
    if (!value) return "—";

    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (typeof value === "number") {
      date = new Date(value);
    } else if (typeof value === "string") {
      date = new Date(value);
    } else if (value?.seconds) {
      date = new Date(value.seconds * 1000);
    } else {
      return "—";
    }

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  }

  function readableStatus(status) {
    return (status || "unknown")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function subscriberStatusClasses(status) {
    if (status === "active") {
      return "bg-green-100 text-green-800";
    }

    if (status === "unsubscribed") {
      return "bg-red-100 text-red-800";
    }

    return "bg-[#eadfd5] text-[#56301f]";
  }

  function campaignStatusClasses(status) {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800";
      case "sending":
        return "bg-amber-100 text-amber-800";
      case "partially_sent":
        return "bg-orange-100 text-orange-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-[#eadfd5] text-[#56301f]";
    }
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5eee8] text-[#56301f]">
        <p>Verifying administrator access...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08] md:flex">
      <AdminNavbar />

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/admin/dashboard"
            className="text-sm font-medium text-[#70432c] transition hover:text-[#a97955]"
          >
            ← Back to Dashboard
          </Link>

          <header className="mt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#8d5b3d]">
              Jonny Boss
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Newsletter Management
            </h1>
            <p className="mt-2 max-w-2xl text-[#70432c]">
              Manage subscribers, send music updates, and track email campaigns.
            </p>
          </header>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-[#e4d4c8] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#70432c]">Total subscribers</p>
              <p className="mt-2 text-3xl font-bold">
                {loading ? "..." : subscribers.length}
              </p>
            </div>

            <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-[#70432c]">Active subscribers</p>
              <p className="mt-2 text-3xl font-bold text-green-700">
                {loading ? "..." : activeSubscribers.length}
              </p>
              <p className="mt-1 text-xs text-[#8d5b3d]">
                Eligible for campaigns
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-[#70432c]">Unsubscribed</p>
              <p className="mt-2 text-3xl font-bold text-red-700">
                {loading ? "..." : unsubscribedSubscribers.length}
              </p>
              <p className="mt-1 text-xs text-[#8d5b3d]">
                Excluded from campaigns
              </p>
            </div>

            <div className="rounded-2xl border border-[#e4d4c8] bg-white p-5 shadow-sm">
              <p className="text-sm text-[#70432c]">Other statuses</p>
              <p className="mt-2 text-3xl font-bold text-[#8d5b3d]">
                {loading ? "..." : otherSubscribers.length}
              </p>
              <p className="mt-1 text-xs text-[#8d5b3d]">
                Pending or unclassified
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-[#e4d4c8] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-bold">Create an email campaign</h2>
            <p className="mt-2 text-sm text-[#70432c]">
              Only subscribers whose status is active should receive campaigns.
            </p>

            <form onSubmit={handleSendCampaign} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="subject"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email subject
                </label>
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={150}
                  required
                  placeholder="New music is out now!"
                  className="w-full rounded-xl border border-[#d9c4b4] bg-[#fffdfb] px-4 py-3 outline-none transition focus:border-[#8d5b3d] focus:ring-2 focus:ring-[#8d5b3d]/20"
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email message
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={10000}
                  required
                  rows={8}
                  placeholder="Hello, thank you for subscribing to Jonny Boss updates..."
                  className="w-full resize-y rounded-xl border border-[#d9c4b4] bg-[#fffdfb] px-4 py-3 outline-none transition focus:border-[#8d5b3d] focus:ring-2 focus:ring-[#8d5b3d]/20"
                />
                <p className="mt-2 text-xs text-[#8d5b3d]">
                  Plain text message, up to 10,000 characters.
                </p>
              </div>

              {notice && (
                <div
                  role="status"
                  className="whitespace-pre-wrap rounded-xl border border-[#e4d4c8] bg-[#faf4ef] p-4 text-sm text-[#56301f]"
                >
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={sending || loading || activeSubscribers.length === 0}
                className="rounded-xl bg-[#56301f] px-6 py-3 font-semibold text-white transition hover:bg-[#70432c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending
                  ? "Sending campaign..."
                  : `Send to ${activeSubscribers.length} active subscribers`}
              </button>

              <p className="text-xs text-[#8d5b3d]">
                Campaigns are sent through Gmail SMTP. Sending emails contacts real subscribers.
              </p>
            </form>
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-[#e4d4c8] bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-[#eadfd5] p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">Campaign History</h2>
                <p className="mt-1 text-sm text-[#70432c]">
                  Your latest campaigns and their delivery results.
                </p>
              </div>

              <button
                type="button"
                onClick={loadCampaigns}
                disabled={campaignsLoading}
                className="rounded-xl border border-[#d9c4b4] px-4 py-2 text-sm font-semibold transition hover:border-[#8d5b3d] hover:bg-[#faf4ef] disabled:opacity-50"
              >
                {campaignsLoading ? "Refreshing..." : "Refresh history"}
              </button>
            </div>

            {campaignsLoading ? (
              <p className="p-6 text-[#70432c]">Loading campaign history...</p>
            ) : campaignsError ? (
              <div className="p-6">
                <p className="text-red-700">{campaignsError}</p>
                <button
                  type="button"
                  onClick={loadCampaigns}
                  className="mt-3 text-sm font-semibold text-[#70432c] hover:text-[#a97955]"
                >
                  Try again
                </button>
              </div>
            ) : campaigns.length === 0 ? (
              <p className="p-6 text-[#70432c]">No campaigns found yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f5eee8] text-[#56301f]">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-4">Subject</th>
                      <th className="whitespace-nowrap px-5 py-4">Created</th>
                      <th className="whitespace-nowrap px-5 py-4">Recipients</th>
                      <th className="whitespace-nowrap px-5 py-4">Sent</th>
                      <th className="whitespace-nowrap px-5 py-4">Failed</th>
                      <th className="whitespace-nowrap px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className="border-t border-[#eadfd5] align-top"
                      >
                        <td className="max-w-xs px-5 py-4 font-medium">
                          <span className="break-words">
                            {campaign.subject || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-[#70432c]">
                          {formatDate(campaign.createdAt)}
                        </td>
                        <td className="px-5 py-4">
                          {campaign.recipientCount ?? 0}
                        </td>
                        <td className="px-5 py-4 text-green-700">
                          {campaign.sentCount ?? 0}
                        </td>
                        <td className="px-5 py-4 text-red-700">
                          {campaign.failedCount ?? 0}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${campaignStatusClasses(
                              campaign.status
                            )}`}
                          >
                            {readableStatus(campaign.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-[#e4d4c8] bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-[#eadfd5] p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold">Subscribers</h2>
                <p className="mt-1 text-sm text-[#70432c]">
                  Active subscribers receive updates; unsubscribed addresses are excluded.
                </p>
              </div>

              <button
                type="button"
                onClick={loadSubscribers}
                disabled={loading}
                className="rounded-xl border border-[#d9c4b4] px-4 py-2 text-sm font-semibold transition hover:border-[#8d5b3d] hover:bg-[#faf4ef] disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh subscribers"}
              </button>
            </div>

            {loading ? (
              <p className="p-6 text-[#70432c]">Loading subscribers...</p>
            ) : error ? (
              <div className="p-6">
                <p className="text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={loadSubscribers}
                  className="mt-3 text-sm font-semibold text-[#70432c] hover:text-[#a97955]"
                >
                  Try again
                </button>
              </div>
            ) : subscribers.length === 0 ? (
              <p className="p-6 text-[#70432c]">No subscribers found yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f5eee8] text-[#56301f]">
                    <tr>
                      <th className="whitespace-nowrap px-5 py-4">Name</th>
                      <th className="whitespace-nowrap px-5 py-4">Email</th>
                      <th className="whitespace-nowrap px-5 py-4">Status</th>
                      <th className="whitespace-nowrap px-5 py-4">Subscribed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((subscriber) => (
                      <tr
                        key={subscriber.id}
                        className="border-t border-[#eadfd5] align-top"
                      >
                        <td className="px-5 py-4">
                          {subscriber.name || "—"}
                        </td>
                        <td className="break-all px-5 py-4 text-[#70432c]">
                          {subscriber.email || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${subscriberStatusClasses(
                              subscriber.status
                            )}`}
                          >
                            {readableStatus(subscriber.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-[#70432c]">
                          {formatDate(subscriber.subscribedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="py-8 text-center text-sm text-[#8d5b3d]">
            Jonny Boss · Newsletter Administration
          </footer>
        </div>
      </div>
    </main>
  );
}
