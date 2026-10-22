"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const platforms = [
  { key: "spotify", label: "Spotify" },
  { key: "appleMusic", label: "Apple Music" },
  { key: "amazonMusic", label: "Amazon Music" },
  { key: "audiomack", label: "Audiomack" },
  { key: "boomplay", label: "Boomplay" },
  { key: "youtubeMusic", label: "YouTube Music" },
];

function getSongLinks(song) {
  const links = {};

  for (const field of [
    song.platforms,
    song.links,
    song.musicLinks,
    song.streamingLinks,
  ]) {
    if (field && typeof field === "object" && !Array.isArray(field)) {
      Object.assign(links, field);
    }
  }

  for (const platform of platforms) {
    if (typeof song[platform.key] === "string") {
      links[platform.key] = song[platform.key];
    }
  }

  return links;
}

function formatReleaseDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isSafeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function MusicPage() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSongs() {
      try {
        const songsQuery = query(
          collection(db, "songs"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(songsQuery);

        if (!active) return;

        setSongs(
          snapshot.docs.map((songDoc) => ({
            id: songDoc.id,
            ...songDoc.data(),
          }))
        );
      } catch (err) {
        console.error("Unable to load songs:", err);

        if (active) {
          setError(
            "Unable to load music right now. Please try again later."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSongs();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08]">
      <section className="relative overflow-hidden bg-[#1c0d08] px-4 py-16 text-[#f5eee8] sm:px-8 md:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#70432c]/30 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#d9b99f] transition hover:text-white"
          >
            <span aria-hidden="true">←</span>
            Back to Home
          </Link>

          <header className="mt-12 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#c9a184] sm:text-sm">
              Official Releases
            </p>

            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl md:text-7xl">
              Jonny Boss
              <span className="mt-2 block text-[#c9a184]">
                Music Collection
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c9b9ae] sm:text-base">
              Discover the music, explore the releases, and listen on your
              favourite streaming platform.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#eadfd5]">
                {loading ? "Loading releases..." : `${songs.length} releases`}
              </span>
              <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#eadfd5]">
                Official music links
              </span>
            </div>
          </header>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 md:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8d5b3d]">
              Explore the catalogue
            </p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Music & Releases
            </h2>
          </div>

          {!loading && !error && songs.length > 0 && (
            <p className="text-sm text-[#70432c]">
              {songs.length} {songs.length === 1 ? "song" : "songs"} available
            </p>
          )}
        </div>

        {loading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-[#e0cfc2] bg-white"
              >
                <div className="aspect-square animate-pulse bg-[#eadfd5]" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-[#eadfd5]" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-[#f0e5dc]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"
          >
            <h2 className="font-bold">Music could not be loaded</h2>
            <p className="mt-2 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && songs.length === 0 && (
          <div className="rounded-2xl border border-[#e0cfc2] bg-white px-6 py-16 text-center">
            <span className="text-4xl text-[#8d5b3d]" aria-hidden="true">
              ♫
            </span>
            <h2 className="mt-5 text-2xl font-bold">Music coming soon</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#70432c]">
              New releases from Jonny Boss will appear here. Please check
              back soon.
            </p>
          </div>
        )}

        {!loading && !error && songs.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((song) => {
              const links = getSongLinks(song);
              const title = song.title || song.songTitle || "Untitled Song";
              const cover =
                song.coverImage || song.imageUrl || song.artworkUrl || "";

              const availablePlatforms = platforms.filter(({ key }) =>
                isSafeExternalUrl(links[key])
              );

              return (
                <article
                  key={song.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e0cfc2] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#a97955] hover:shadow-xl"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#2b140d]">
                    {isSafeExternalUrl(cover) ? (
                      <img
                        src={cover}
                        alt={`${title} cover artwork`}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#70432c] via-[#2b140d] to-[#120906]">
                        <div className="px-5 text-center">
                          <span className="text-5xl text-[#c9a184]">♫</span>
                          <p className="mt-4 text-xl font-black tracking-[0.2em] text-[#f5eee8]">
                            JONNY BOSS
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 pt-16">
                      <span className="inline-block rounded-full border border-white/30 bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        Official Release
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h3 className="break-words text-xl font-black">
                      {title}
                    </h3>

                    {song.releaseDate && (
                      <p className="mt-2 text-sm text-[#8d5b3d]">
                        Released: {formatReleaseDate(song.releaseDate)}
                      </p>
                    )}

                    <div className="mt-5">
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-[#70432c]">
                        Listen on
                      </p>

                      {availablePlatforms.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {availablePlatforms.map((platform) => (
                            <a
                              key={platform.key}
                              href={links[platform.key].trim()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-[#c9a184] bg-[#faf4ef] px-3 py-2 text-xs font-semibold text-[#56301f] transition hover:border-[#56301f] hover:bg-[#56301f] hover:text-white sm:text-sm"
                            >
                              {platform.label}
                              <span className="ml-1" aria-hidden="true">
                                ↗
                              </span>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-[#8d5b3d]">
                          Streaming links will be available soon.
                        </p>
                      )}
                    </div>

                    {song.slug && (
                      <Link
                        href={`/listen/${encodeURIComponent(song.slug)}`}
                        className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-[#70432c] transition hover:text-[#a97955]"
                      >
                        Open SmartLink
                        <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
