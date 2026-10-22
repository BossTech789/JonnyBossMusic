"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const platforms = [
  { key: "spotify", name: "Spotify", color: "#1DB954" },
  { key: "appleMusic", name: "Apple Music", color: "#FA243C" },
  { key: "amazonMusic", name: "Amazon Music", color: "#146EB4" },
  { key: "audiomack", name: "Audiomack", color: "#FFA200" },
  { key: "boomplay", name: "Boomplay", color: "#0504aa" },
  { key: "youtubeMusic", name: "YouTube Music", color: "#FF0033" },
];

export default function PublicSmartLinkPage() {
  const params = useParams();
  const slug = params?.slug;

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function loadSmartLink() {
      setLoading(true);
      setError("");
      setSong(null);

      try {
        const smartLinksQuery = query(
          collection(db, "smartLinks"),
          where("slug", "==", slug),
          where("published", "==", true),
          limit(1)
        );

        const smartLinksSnapshot = await getDocs(smartLinksQuery);

        if (smartLinksSnapshot.empty) {
          throw new Error(
            "This SmartLink could not be found or is not published."
          );
        }

        const smartLink = smartLinksSnapshot.docs[0].data();

        if (!smartLink.songId) {
          throw new Error("This SmartLink has no song attached.");
        }

        const songRef = doc(db, "songs", smartLink.songId);
        const songSnapshot = await getDoc(songRef);

        if (!songSnapshot.exists()) {
          throw new Error(
            "The song connected to this SmartLink could not be found."
          );
        }

        const songData = songSnapshot.data();

        if (cancelled) return;

        setSong({
          ...songData,
          title: songData.title || smartLink.songTitle || "Untitled Song",
          streamingLinks: getSongLinks(songData),
          coverImage:
            songData.coverImage ||
            songData.imageUrl ||
            songData.artworkUrl ||
            "",
        });
      } catch (err) {
        console.error("SmartLink loading error:", err);

        if (!cancelled) {
          setError(
            err.code === "permission-denied"
              ? "Permission denied. Please check your Firestore rules."
              : err.message || "Unable to load this song."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSmartLink();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const availablePlatforms = platforms.filter((platform) =>
    isSafeExternalUrl(song?.streamingLinks?.[platform.key])
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#120906] px-5 text-[#f5eee8]">
        <div className="text-center">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-[#56301f] border-t-[#c9a17e]" />
          <p className="text-sm text-[#c9b9ae]">
            Loading Jonny Boss music...
          </p>
        </div>
      </main>
    );
  }

  if (error || !song) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#120906] px-5 py-12 text-[#f5eee8]">
        <div className="w-full max-w-md rounded-3xl border border-[#56301f] bg-[#1c0d08] p-8 text-center shadow-2xl">
          <div className="mb-4 text-5xl text-[#c9a17e]" aria-hidden="true">
            ♪
          </div>

          <h1 className="mb-3 text-2xl font-bold">
            SmartLink Unavailable
          </h1>

          <p className="mb-7 text-sm leading-6 text-[#c9b9ae]">
            {error || "We could not find this song."}
          </p>

          <Link
            href="/"
            className="inline-flex rounded-xl bg-[#c9a17e] px-6 py-3 font-semibold text-[#120906] transition hover:bg-[#dfbea0]"
          >
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#120906] px-5 py-12 text-[#f5eee8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-[#70432c]/25 blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-md">
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-black uppercase tracking-[0.35em] text-[#c9a17e] transition hover:text-[#f5eee8]"
          >
            Jonny Boss
          </Link>

          <p className="mt-3 text-xs uppercase tracking-[0.3em] text-[#a99587]">
            Official Music
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-[#56301f] bg-[#1c0d08] shadow-2xl shadow-black/40">
          <div className="aspect-square w-full bg-[#2b140d]">
            {isSafeExternalUrl(song.coverImage) ? (
              <img
                src={song.coverImage}
                alt={`${song.title} cover`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#70432c] via-[#2b140d] to-[#120906]">
                <span className="text-8xl text-[#d7ad88]" aria-hidden="true">
                  ♪
                </span>
              </div>
            )}
          </div>

          <div className="p-6 text-center sm:p-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#a97955]">
              Now Streaming
            </p>

            <h1 className="break-words text-3xl font-black sm:text-4xl">
              {song.title}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#c9b9ae]">
              Listen to the official release by Jonny Boss.
            </p>

            <div className="mt-7 space-y-3">
              {availablePlatforms.length > 0 ? (
                availablePlatforms.map((platform) => (
                  <a
                    key={platform.key}
                    href={song.streamingLinks[platform.key].trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left font-bold text-white transition hover:-translate-y-0.5 hover:brightness-110"
                    style={{ backgroundColor: platform.color }}
                  >
                    <span>Listen on {platform.name}</span>
                    <span aria-hidden="true" className="text-xl">
                      ↗
                    </span>
                  </a>
                ))
              ) : (
                <p className="rounded-xl border border-[#56301f] bg-[#120906] px-4 py-5 text-sm leading-6 text-[#c9b9ae]">
                  No streaming links are available for this song yet.
                </p>
              )}
            </div>

            <p className="mt-6 text-xs leading-5 text-[#a99587]">
              Choose your favourite platform to listen to this song.
            </p>
          </div>
        </section>

        <footer className="mt-8 text-center">
          <p className="text-xs text-[#a99587]">
            © {new Date().getFullYear()} Jonny Boss. All rights reserved.
          </p>

          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-[#c9a17e] transition hover:text-[#f5eee8]"
          >
            Visit Official Website →
          </Link>
        </footer>
      </div>
    </main>
  );
}

function getSongLinks(song) {
  const result = {};

  const sources = [
    song.streamingLinks,
    song.musicLinks,
    song.links,
    song.platforms,
    song,
  ];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;

    for (const platform of platforms) {
      const value = source[platform.key];

      if (typeof value === "string" && isSafeExternalUrl(value)) {
        result[platform.key] = value.trim();
      }
    }
  }

  return result;
}

function isSafeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsedUrl = new URL(value.trim());

    return (
      (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") &&
      Boolean(parsedUrl.hostname)
    );
  } catch {
    return false;
  }
}