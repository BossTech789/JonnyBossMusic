
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";

function getYouTubeId(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }

      const match = parsed.pathname.match(
        /^\/(?:embed|shorts|live)\/([^/?]+)/
      );

      return match ? match[1] : "";
    }

    return "";
  } catch {
    return "";
  }
}

export default function AdminVideosPage() {
  const router = useRouter();

  const [videos, setVideos] = useState([]);
  const [songs, setSongs] = useState([]);

  const [title, setTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [songId, setSongId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [videoSnapshot, songSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(db, "videos"),
            orderBy("createdAt", "desc")
          )
        ),
        getDocs(collection(db, "songs")),
      ]);

      setVideos(
        videoSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setSongs(
        songSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    } catch (err) {
      console.error("Failed to load videos:", err);

      setError(
        err.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules for videos and songs."
          : err.message || "Unable to load music videos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const profile = await getDocs(
          query(
            collection(db, "users")
          )
        );

        // Verify the signed-in user's own administrator profile.
        const { getDoc } = await import("firebase/firestore");
        const userSnapshot = await getDoc(doc(db, "users", user.uid));

        if (
          !userSnapshot.exists() ||
          userSnapshot.data().role !== "admin" ||
          userSnapshot.data().active !== true
        ) {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        await loadData();
      } catch (err) {
        console.error("Admin verification failed:", err);
        setError("Unable to verify administrator access.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanTitle = title.trim();
    const cleanUrl = youtubeUrl.trim();
    const videoId = getYouTubeId(cleanUrl);

    if (!cleanTitle) {
      setError("Please enter a video title.");
      return;
    }

    if (!videoId) {
      setError("Enter a valid YouTube video URL.");
      return;
    }

    if (!songs.some((song) => song.id === songId)) {
      setError("Please select a song for this video.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "videos"), {
        title: cleanTitle,
        youtubeUrl: cleanUrl,
        videoId,
        songId,
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setYoutubeUrl("");
      setSongId("");

      setSuccess("Music video added successfully.");

      await loadData();
    } catch (err) {
      console.error("Failed to save video:", err);

      setError(
        err.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : err.message || "Unable to save the music video."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(video) {
    const confirmed = window.confirm(
      `Delete "${video.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(video.id);
    setError("");
    setSuccess("");

    try {
      await deleteDoc(doc(db, "videos", video.id));

      setVideos((current) =>
        current.filter((item) => item.id !== video.id)
      );

      setSuccess("Music video deleted successfully.");
    } catch (err) {
      console.error("Failed to delete video:", err);

      setError(
        err.code === "permission-denied"
          ? "Permission denied. Check your Firestore rules."
          : err.message || "Unable to delete the video."
      );
    } finally {
      setDeletingId("");
    }
  }

  function getSongTitle(id) {
    const song = songs.find((item) => item.id === id);
    return song?.title || "Unknown song";
  }

  return (
    <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08] md:flex">
      <AdminNavbar />

      <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#d9c6b8] pb-7">
          <div>
            <Link
              href="/admin/dashboard"
              className="mb-4 inline-block text-sm font-semibold text-[#70432c] hover:text-[#120906]"
            >
              ← Back to Dashboard
            </Link>

            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8d5b3d]">
              Music Library
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Music Videos
            </h1>

            <p className="mt-3 text-sm text-[#70432c]">
              Add YouTube videos and connect them to your songs.
            </p>
          </div>

          <div className="rounded-xl border border-[#d9c6b8] bg-white px-5 py-4">
            <p className="text-xs text-[#8d5b3d]">Total Videos</p>
            <p className="mt-1 text-3xl font-black">{videos.length}</p>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            {success}
          </div>
        )}

        <section className="mb-10 rounded-2xl border border-[#e0cfc2] bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-6 text-xl font-bold">
            Add New Music Video
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="videoTitle"
                className="mb-2 block text-sm font-semibold"
              >
                Video Title
              </label>

              <input
                id="videoTitle"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Jonny Boss - Official Music Video"
                maxLength={150}
                required
                className="w-full rounded-xl border border-[#d9c6b8] px-4 py-3 outline-none focus:border-[#8d5b3d]"
              />
            </div>

            <div>
              <label
                htmlFor="youtubeUrl"
                className="mb-2 block text-sm font-semibold"
              >
                YouTube Video URL
              </label>

              <input
                id="youtubeUrl"
                type="url"
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="w-full rounded-xl border border-[#d9c6b8] px-4 py-3 outline-none focus:border-[#8d5b3d]"
              />
            </div>

            <div>
              <label
                htmlFor="song"
                className="mb-2 block text-sm font-semibold"
              >
                Link to Song
              </label>

              <select
                id="song"
                value={songId}
                onChange={(event) => setSongId(event.target.value)}
                required
                className="w-full rounded-xl border border-[#d9c6b8] bg-white px-4 py-3 outline-none focus:border-[#8d5b3d]"
              >
                <option value="">Select a song</option>

                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.title || "Untitled Song"}
                  </option>
                ))}
              </select>

              {songs.length === 0 && !loading && (
                <p className="mt-2 text-sm text-[#8d5b3d]">
                  No songs found. Add a song before adding a video.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || loading || songs.length === 0}
              className="w-full rounded-xl bg-[#70432c] px-5 py-3 font-bold text-white transition hover:bg-[#56301f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Saving Video..." : "Add Music Video"}
            </button>
          </form>
        </section>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Your Music Videos</h2>
              <p className="mt-1 text-sm text-[#70432c]">
                Manage your existing video entries.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="rounded-lg border border-[#c9b9ae] bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[#f5eee8] disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {loading ? (
            <div className="rounded-xl border border-[#e0cfc2] bg-white p-8 text-center text-[#70432c]">
              Loading music videos...
            </div>
          ) : videos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#c9b9ae] bg-white p-10 text-center">
              <p className="text-lg font-bold">No music videos yet</p>
              <p className="mt-2 text-sm text-[#70432c]">
                Add your first YouTube video using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {videos.map((video) => (
                <article
                  key={video.id}
                  className="overflow-hidden rounded-2xl border border-[#e0cfc2] bg-white shadow-sm"
                >
                  <div className="aspect-video bg-[#120906]">
                    {video.videoId ? (
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}`}
                        title={video.title || "Music video"}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[#c9b9ae]">
                        Preview unavailable
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="break-words text-lg font-bold">
                      {video.title || "Untitled Video"}
                    </h3>

                    <p className="mt-2 text-sm text-[#70432c]">
                      Song: {getSongTitle(video.songId)}
                    </p>

                    {video.youtubeUrl && (
                      <a
                        href={video.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block text-sm font-semibold text-[#8d5b3d] hover:text-[#56301f]"
                      >
                        Open on YouTube ↗
                      </a>
                    )}

                    <div className="mt-5 border-t border-[#e0cfc2] pt-4">
                      <button
                        type="button"
                        onClick={() => handleDelete(video)}
                        disabled={deletingId === video.id}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === video.id
                          ? "Deleting..."
                          : "Delete Video"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
