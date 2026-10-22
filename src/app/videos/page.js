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

export default function VideosPage() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadVideos() {
      try {
        const videosQuery = query(
          collection(db, "videos"),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(videosQuery);

        const videoList = snapshot.docs.map((videoDoc) => ({
          id: videoDoc.id,
          ...videoDoc.data(),
        }));

        setVideos(videoList);
      } catch (err) {
        console.error("Error loading videos:", err);
        setError(
          "Unable to load music videos. Please check your connection and Firestore rules."
        );
      } finally {
        setLoading(false);
      }
    }

    loadVideos();
  }, []);

  return (
    <main className="min-h-screen bg-[#120906] px-4 py-10 text-[#f5eee8] sm:px-8 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-[#c9a17e] transition hover:text-[#f5eee8]"
        >
          <span aria-hidden="true">←</span> Back to Home
        </Link>

        <header className="mb-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[#a97955] sm:text-sm">
            Official Videos
          </p>

          <h1 className="text-4xl font-black leading-tight sm:text-6xl">
            Jonny Boss
            <span className="block text-[#c9a17e] sm:inline">
              {" "}Music Videos
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#c9b9ae] sm:text-base">
            Watch the latest official music videos, performances, and visual
            releases from Jonny Boss.
          </p>
        </header>

        {loading && (
          <div
            className="grid grid-cols-1 gap-8 md:grid-cols-2"
            aria-label="Loading music videos"
          >
            {[1, 2].map((item) => (
              <div
                key={item}
                className="overflow-hidden rounded-2xl border border-[#56301f] bg-[#1c0d08]"
              >
                <div className="aspect-video animate-pulse bg-[#3d1f14]" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-[#3d1f14]" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-[#2b140d]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-xl border border-red-900 bg-red-950/30 p-5 text-red-200"
          >
            {error}
          </div>
        )}

        {!loading && !error && videos.length === 0 && (
          <div className="rounded-2xl border border-[#56301f] bg-[#1c0d08] px-6 py-14 text-center">
            <div className="mb-4 text-4xl" aria-hidden="true">
              ♪
            </div>

            <h2 className="text-2xl font-bold">
              No Videos Yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#c9b9ae]">
              Music videos will appear here when they are added through the
              admin dashboard.
            </p>
          </div>
        )}

        {!loading && !error && videos.length > 0 && (
          <>
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#56301f] pb-4">
              <h2 className="text-lg font-bold sm:text-xl">
                Video Collection
              </h2>

              <span className="rounded-full border border-[#70432c] bg-[#2b140d] px-3 py-1 text-xs font-semibold text-[#e1c2a7]">
                {videos.length} {videos.length === 1 ? "Video" : "Videos"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
              {videos.map((video) => {
                const youtubeId = getYouTubeId(
                  video.videoId || video.youtubeUrl || video.url || ""
                );

                return (
                  <article
                    key={video.id}
                    className="group overflow-hidden rounded-2xl border border-[#56301f] bg-[#1c0d08] transition duration-300 hover:border-[#a97955] hover:shadow-xl hover:shadow-black/20"
                  >
                    {youtubeId ? (
                      <div className="aspect-video w-full bg-black">
                        <iframe
                          className="h-full w-full"
                          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
                          title={video.title || "Jonny Boss music video"}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video items-center justify-center bg-[#2b140d] p-6 text-center text-sm text-[#c9b9ae]">
                        This video has an invalid or missing YouTube URL.
                      </div>
                    )}

                    <div className="p-5 sm:p-6">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#a97955]">
                        Jonny Boss
                      </p>

                      <h2 className="text-xl font-bold leading-snug text-[#f5eee8] transition group-hover:text-[#d7ad88] sm:text-2xl">
                        {video.title || "Untitled Video"}
                      </h2>

                      {video.songId && (
                        <p className="mt-3 text-sm text-[#c9b9ae]">
                          Official music video
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function getYouTubeId(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  try {
    // Allow either a YouTube URL or a stored video ID.
    const input = value.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }

    const parsedUrl = new URL(
      input.startsWith("www.") ? `https://${input}` : input
    );

    const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsedUrl.pathname === "/watch") {
        videoId = parsedUrl.searchParams.get("v") || "";
      } else {
        const match = parsedUrl.pathname.match(
          /^\/(embed|shorts|live)\/([^/?]+)/
        );

        videoId = match ? match[2] : "";
      }
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : "";
  } catch {
    return "";
  }
}