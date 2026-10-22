
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const defaults = {
  artistName: "JONNY BOSS",
  backgroundColor: "#120906",
  textColor: "#ffffff",
  overlayOpacity: 30,
  imageUrl: "",
};

const musicPlatforms = [
  ["spotifyLink", "Spotify"],
  ["appleLink", "Apple Music"],
  ["audiomackLink", "Audiomack"],
  ["amazonLink", "Amazon Music"],
  ["youtubeMusicLink", "YouTube Music"],
  ["boomplayLink", "Boomplay"],
];

function getYouTubeId(url) {
  if (!url || typeof url !== "string") return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (
      ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }

      const match = parsed.pathname.match(
        /^\/(embed|shorts|live)\/([^/?]+)/
      );

      return match ? match[2] : "";
    }
  } catch {
    return "";
  }

  return "";
}

function formatPlatformUrl(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getSongImage(song) {
  return song.imageUrl || song.image || song.coverImage || "";
}

export default function Home() {
  const [settings, setSettings] = useState(defaults);
  const [songs, setSongs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterError, setNewsletterError] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "siteSettings", "homepage"),
      (snapshot) => {
        if (snapshot.exists()) {
          setSettings((current) => ({
            ...current,
            ...snapshot.data(),
          }));
        }
      },
      (error) => console.error("Homepage settings:", error)
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    async function loadSongs() {
      try {
        const songsQuery = query(
          collection(db, "songs"),
          orderBy("createdAt", "desc"),
          limit(4)
        );

        const snapshot = await getDocs(songsQuery);

        setSongs(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      } catch (error) {
        console.error("Unable to load latest songs:", error);
      } finally {
        setLoadingSongs(false);
      }
    }

    loadSongs();
  }, []);

  useEffect(() => {
    async function loadVideos() {
      try {
        const videosQuery = query(
          collection(db, "videos"),
          orderBy("createdAt", "desc"),
          limit(4)
        );

        const snapshot = await getDocs(videosQuery);

        setVideos(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      } catch (error) {
        console.error("Unable to load latest videos:", error);
      } finally {
        setLoadingVideos(false);
      }
    }

    loadVideos();
  }, []);

  async function handleSubscribe(event) {
    event.preventDefault();
    setSubmitting(true);
    setNewsletterMessage("");
    setNewsletterError("");

    try {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        throw new Error("Please enter your email address.");
      }

      // Check for an existing subscriber before creating a record.
      const subscriberQuery = query(
        collection(db, "newsletterSubscribers")
      );
      const subscriberSnapshot = await getDocs(subscriberQuery);

      const existingSubscriber = subscriberSnapshot.docs.find(
        (item) =>
          String(item.data().email || "").toLowerCase() === cleanEmail
      );

      if (existingSubscriber) {
        const status = existingSubscriber.data().status;

        if (status === "active") {
          setNewsletterMessage(
            "This email address is already subscribed."
          );
          return;
        }

        if (status === "unsubscribed") {
          setNewsletterError(
            "This email has unsubscribed. Please contact us if you want to subscribe again."
          );
          return;
        }

        throw new Error(
          "We could not process this subscription. Please try again later."
        );
      }

      await addDoc(collection(db, "newsletterSubscribers"), {
        name: cleanName,
        email: cleanEmail,
        status: "active",
        subscribedAt: serverTimestamp(),
      });

      setName("");
      setEmail("");
      setNewsletterMessage(
        "Thank you for subscribing! You'll receive updates from Jonny Boss."
      );
    } catch (error) {
      console.error("Newsletter subscription:", error);
      setNewsletterError(
        error.message ||
          "Subscription failed. Please try again later."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const overlayOpacity = Math.min(
    100,
    Math.max(0, Number(settings.overlayOpacity ?? 30))
  );

  return (
    <main className="bg-[#120906] text-[#f5eee8]">
      {/* HERO */}
      <section
        className="relative flex min-h-[78vh] items-center justify-center overflow-hidden px-5 py-24 text-center sm:min-h-[85vh]"
        style={{ backgroundColor: settings.backgroundColor }}
      >
        {settings.imageUrl && (
          <img
            src={settings.imageUrl}
            alt={settings.artistName || "Jonny Boss"}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}

        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity / 100 }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center">
          <p
            className="text-xs font-bold uppercase tracking-[0.4em] sm:text-sm"
            style={{ color: settings.textColor }}
          >
            Official Website
          </p>

          <h1
            className="mt-6 text-5xl font-black uppercase leading-tight tracking-[0.08em] sm:text-7xl md:text-8xl"
            style={{ color: settings.textColor }}
          >
            {settings.artistName || "JONNY BOSS"}
          </h1>

          <p
            className="mt-5 text-base sm:text-xl"
            style={{ color: settings.textColor }}
          >
            Real music. Real emotion.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link
              href="/music"
              className="rounded-lg bg-[#70432c] px-7 py-3.5 font-bold text-white transition hover:bg-[#8d5b3d]"
            >
              Explore Music
            </Link>

            <Link
              href="/videos"
              className="rounded-lg border border-[#c9b9ae] px-7 py-3.5 font-bold transition hover:bg-[#f5eee8] hover:text-[#120906]"
            >
              Watch Videos
            </Link>
          </div>
        </div>
      </section>

      {/* LATEST MUSIC */}
      <section className="bg-[#1c0d08] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#a97955]">
              Music
            </p>

            <h2 className="mt-4 text-3xl font-black sm:text-5xl">
              Latest Music
            </h2>

            <p className="mt-4 leading-7 text-[#c9b9ae]">
              Discover the latest music from Jonny Boss.
            </p>
          </div>

          {loadingSongs ? (
            <p className="py-10 text-center text-[#c9b9ae]">
              Loading latest music...
            </p>
          ) : songs.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/10 px-6 py-12 text-center">
              <p className="text-[#c9b9ae]">
                No music has been released yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {songs.map((song) => {
                const image = getSongImage(song);

                return (
                  <article
                    key={song.id}
                    className="overflow-hidden rounded-xl border border-white/10 bg-[#2b140d] transition duration-300 hover:-translate-y-1 hover:border-[#8d5b3d]"
                  >
                    <div className="aspect-square overflow-hidden bg-[#3d1f14]">
                      {image ? (
                        <img
                          src={image}
                          alt={song.title || "Jonny Boss release"}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center p-6 text-center text-2xl font-black tracking-widest text-[#a97955]">
                          JONNY BOSS
                        </div>
                      )}
                    </div>

                    <div className="p-5 text-center">
                      {song.type && (
                        <p className="text-xs font-bold uppercase tracking-wider text-[#a97955]">
                          {song.type}
                        </p>
                      )}

                      <h3 className="mt-2 text-lg font-bold">
                        {song.title || "Untitled Song"}
                      </h3>

                      <p className="mt-1 text-sm text-[#c9b9ae]">
                        {song.artist || "Jonny Boss"}
                      </p>

                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {musicPlatforms.map(([field, label]) => {
                          const url = formatPlatformUrl(song[field]);

                          if (!url) return null;

                          return (
                            <a
                              key={field}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-[#70432c] px-3 py-1.5 text-xs font-semibold text-[#f5eee8] transition hover:bg-[#70432c]"
                            >
                              {label}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/music"
              className="inline-flex rounded-lg border border-[#a97955] px-7 py-3 font-semibold text-[#f5eee8] transition hover:bg-[#70432c]"
            >
              View All Music
            </Link>
          </div>
        </div>
      </section>

      {/* LATEST VIDEOS */}
      <section className="bg-[#120906] px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#a97955]">
              Videos
            </p>

            <h2 className="mt-4 text-3xl font-black sm:text-5xl">
              Latest Videos
            </h2>

            <p className="mt-4 leading-7 text-[#c9b9ae]">
              Watch the latest videos from Jonny Boss.
            </p>
          </div>

          {loadingVideos ? (
            <p className="py-10 text-center text-[#c9b9ae]">
              Loading latest videos...
            </p>
          ) : videos.length === 0 ? (
            <div className="rounded-xl border border-white/10 px-6 py-12 text-center">
              <p className="text-[#c9b9ae]">
                No videos available yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {videos.map((video) => {
                const youtubeId =
                  video.videoId || video.youtubeId ||
                  getYouTubeId(video.youtubeUrl);

                const videoImage =
                  video.imageUrl ||
                  video.image ||
                  video.coverImage ||
                  (youtubeId
                    ? `https://img.youtube.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`
                    : "");

                const linkedSong = songs.find(
                  (song) =>
                    song.id === video.songId ||
                    song.id === video.musicId
                );

                return (
                  <article
                    key={video.id}
                    className="overflow-hidden rounded-xl border border-white/10 bg-[#1c0d08] transition duration-300 hover:-translate-y-1 hover:border-[#8d5b3d]"
                  >
                    <a
                      href={
                        youtubeId
                          ? `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`
                          : "/videos"
                      }
                      target={youtubeId ? "_blank" : undefined}
                      rel={youtubeId ? "noopener noreferrer" : undefined}
                      aria-label={`Watch ${video.title || "music video"}`}
                      className="group relative block aspect-video overflow-hidden bg-[#2b140d]"
                    >
                      {videoImage ? (
                        <img
                          src={videoImage}
                          alt={video.title || "Jonny Boss music video"}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xl font-black text-[#a97955]">
                          JONNY BOSS
                        </div>
                      )}

                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/40">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-[#56301f]/90 text-xl text-white">
                          ▶
                        </span>
                      </span>
                    </a>

                    <div className="p-5 text-center">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#a97955]">
                        Music Video
                      </p>

                      <h3 className="mt-2 text-lg font-bold">
                        {video.title || "Untitled Video"}
                      </h3>

                      <p className="mt-1 text-sm text-[#c9b9ae]">
                        {linkedSong?.artist ||
                          video.artist ||
                          "Jonny Boss"}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <Link
              href="/videos"
              className="inline-flex rounded-lg border border-[#a97955] px-7 py-3 font-semibold text-[#f5eee8] transition hover:bg-[#70432c]"
            >
              View All Videos
            </Link>
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section
        id="newsletter-section"
        className="bg-[#2b140d] px-5 py-20 sm:px-8"
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#a97955]">
              Newsletter
            </p>

            <h2 className="mt-4 text-3xl font-black sm:text-5xl">
              Stay Updated
            </h2>

            <p className="mt-4 leading-7 text-[#c9b9ae]">
              Subscribe to receive new music, videos and updates from
              Jonny Boss.
            </p>
          </div>

          {newsletterMessage && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-green-700/60 bg-green-950/40 p-4 text-sm text-green-200"
            >
              {newsletterMessage}
            </div>
          )}

          {newsletterError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-700/60 bg-red-950/40 p-4 text-sm text-red-200"
            >
              {newsletterError}
            </div>
          )}

          <form onSubmit={handleSubscribe} className="space-y-5">
            <div>
              <label
                htmlFor="newsletter-name"
                className="mb-2 block text-sm font-semibold"
              >
                Name
              </label>

              <input
                id="newsletter-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-[#70432c] bg-[#120906] px-4 py-3.5 text-white outline-none transition placeholder:text-[#8d5b3d] focus:border-[#a97955]"
              />
            </div>

            <div>
              <label
                htmlFor="newsletter-email"
                className="mb-2 block text-sm font-semibold"
              >
                Email Address
              </label>

              <input
                id="newsletter-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Your email address"
                className="w-full rounded-lg border border-[#70432c] bg-[#120906] px-4 py-3.5 text-white outline-none transition placeholder:text-[#8d5b3d] focus:border-[#a97955]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#8d5b3d] px-6 py-4 font-bold text-white transition hover:bg-[#a97955] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Subscribing..." : "Subscribe"}
            </button>

            <p className="text-center text-xs leading-6 text-[#c9b9ae]">
              By subscribing, you agree to receive email updates from
              Jonny Boss. You can unsubscribe at any time.
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
