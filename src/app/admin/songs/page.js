
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import AdminNavbar from "@/components/AdminNavbar";
import { auth, db } from "@/lib/firebase";

const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const streamingPlatforms = [
  { key: "spotify", label: "Spotify" },
  { key: "appleMusic", label: "Apple Music" },
  { key: "amazonMusic", label: "Amazon Music" },
  { key: "audiomack", label: "Audiomack" },
  { key: "boomplay", label: "Boomplay" },
  { key: "youtubeMusic", label: "YouTube Music" },
];

const emptyLinks = {
  spotify: "",
  appleMusic: "",
  amazonMusic: "",
  audiomack: "",
  boomplay: "",
  youtubeMusic: "",
};

export default function SongsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [streamingLinks, setStreamingLinks] = useState({
    ...emptyLinks,
  });

  const showMessage = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  // Load all songs from Firestore.
  const loadSongs = useCallback(async () => {
    const songsQuery = query(
      collection(db, "songs"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(songsQuery);

    setSongs(
      snapshot.docs.map((songDoc) => ({
        id: songDoc.id,
        ...songDoc.data(),
      }))
    );
  }, []);

  // Verify that the signed-in user is an active admin.
  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      if (!user) {
        setLoading(false);
        router.replace("/admin/login");
        return;
      }

      try {
        // Read only the signed-in user's profile.
        const profile = await getDoc(
          doc(db, "users", user.uid)
        );

        if (cancelled) return;

        if (
          !profile.exists() ||
          profile.data().role !== "admin" ||
          profile.data().active !== true
        ) {
          await signOut(auth);

          if (!cancelled) {
            router.replace("/admin/login");
          }

          return;
        }

        await loadSongs();

        if (!cancelled) {
          setMessage("");
        }
      } catch (error) {
        console.error("Songs page loading error:", error);

        if (!cancelled) {
          showMessage(
            error.code
              ? `Could not load songs: ${error.code}`
              : "Could not load songs. Check your connection and Firebase permissions."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router, loadSongs]);

  // Upload a song cover image to Cloudinary.
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showMessage("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage("The cover image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      showMessage(
        "Cloudinary is not configured. Check your .env.local variables."
      );
      event.target.value = "";
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", "jonny-boss/songs");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.secure_url) {
        throw new Error(
          result.error?.message ||
            "Cloudinary image upload failed."
        );
      }

      setCoverImage(result.secure_url);
      showMessage("Cover image uploaded successfully.", "success");
    } catch (error) {
      console.error("Cover upload error:", error);
      showMessage(
        error.message || "Could not upload the cover image."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // Update a streaming platform URL.
  const handleLinkChange = (platform, value) => {
    setStreamingLinks((current) => ({
      ...current,
      [platform]: value,
    }));
  };

  // Add a new song.
  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    const user = auth.currentUser;

    if (!user) {
      showMessage("Your session has expired. Please log in again.");
      router.replace("/admin/login");
      return;
    }

    if (!title.trim()) {
      showMessage("Please enter the song title.");
      return;
    }

    if (uploading) {
      showMessage("Please wait for the cover image upload to finish.");
      return;
    }

    // Validate each supplied streaming URL.
    const links = {};

    for (const platform of streamingPlatforms) {
      const url = streamingLinks[platform.key].trim();

      if (!url) continue;

      try {
        const parsedUrl = new URL(url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          showMessage(`Enter a valid ${platform.label} URL.`);
          return;
        }

        links[platform.key] = url;
      } catch {
        showMessage(`Enter a valid ${platform.label} URL.`);
        return;
      }
    }

    setSaving(true);

    try {
      // Verify admin status before saving.
      const profile = await getDoc(doc(db, "users", user.uid));

      if (
        !profile.exists() ||
        profile.data().role !== "admin" ||
        profile.data().active !== true
      ) {
        showMessage("You are not authorized to add songs.");
        router.replace("/admin/login");
        return;
      }

      await addDoc(collection(db, "songs"), {
        title: title.trim(),
        releaseDate: releaseDate || "",
        coverImage: coverImage || "",
        streamingLinks: links,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });

      setTitle("");
      setReleaseDate("");
      setCoverImage("");
      setStreamingLinks({ ...emptyLinks });

      await loadSongs();

      showMessage("Song added successfully!", "success");
    } catch (error) {
      console.error("Add song error:", error);

      showMessage(
        error.code
          ? `Could not save song: ${error.code}`
          : "Could not save the song. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete a song.
  const handleDelete = async (song) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${song.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setMessage("");

    try {
      const user = auth.currentUser;

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const profile = await getDoc(doc(db, "users", user.uid));

      if (
        !profile.exists() ||
        profile.data().role !== "admin" ||
        profile.data().active !== true
      ) {
        showMessage("You are not authorized to delete songs.");
        return;
      }

      await deleteDoc(doc(db, "songs", song.id));

      setSongs((current) =>
        current.filter((item) => item.id !== song.id)
      );

      showMessage("Song deleted successfully.", "success");
    } catch (error) {
      console.error("Delete song error:", error);

      showMessage(
        error.code
          ? `Could not delete song: ${error.code}`
          : "Could not delete the song. Please try again."
      );
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950 text-amber-50">
        <p>Loading songs...</p>
      </main>
    );
  }

    return (
  <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08] md:flex">
    <AdminNavbar />

    <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        {/* Page heading */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-amber-500">
              Jonny Boss
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Songs Management
            </h1>

            <p className="mt-2 text-stone-400">
              Add songs and manage their streaming links.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="rounded-lg border border-stone-700 px-4 py-2 text-sm transition hover:border-amber-500 hover:text-amber-400"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Success and error messages */}
        {message && (
          <div
            role="status"
            className={`mb-6 rounded-lg border p-4 text-sm ${
              messageType === "success"
                ? "border-green-800 bg-green-950 text-green-300"
                : "border-red-800 bg-red-950 text-red-300"
            }`}
          >
            {message}
          </div>
        )}

        {/* Add song form */}
        <section className="mb-12 rounded-2xl border border-stone-800 bg-stone-900 p-5 sm:p-8">
          <h2 className="mb-6 text-xl font-semibold text-amber-400">
            Add a New Song
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Song title */}
            <div>
              <label
                htmlFor="songTitle"
                className="mb-2 block text-sm font-medium"
              >
                Song title *
              </label>

              <input
                id="songTitle"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                maxLength={150}
                placeholder="Enter song title"
                className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-amber-500"
              />
            </div>

            {/* Release date */}
            <div>
              <label
                htmlFor="releaseDate"
                className="mb-2 block text-sm font-medium"
              >
                Release date
              </label>

              <input
                id="releaseDate"
                type="date"
                value={releaseDate}
                onChange={(event) =>
                  setReleaseDate(event.target.value)
                }
                className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-amber-500"
              />
            </div>

            {/* Cover image */}
            <div>
              <label
                htmlFor="coverImage"
                className="mb-2 block text-sm font-medium"
              >
                Song cover image
              </label>

              <input
                id="coverImage"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="block w-full rounded-lg border border-stone-700 bg-stone-950 p-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-semibold file:text-stone-950"
              />

              {uploading && (
                <p className="mt-2 text-sm text-amber-400">
                  Uploading cover image...
                </p>
              )}

              {coverImage && (
                <div className="mt-4 flex items-center gap-4">
                  <img
                    src={coverImage}
                    alt="Song cover preview"
                    className="h-28 w-28 rounded-lg border border-stone-700 object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            {/* Streaming links */}
            <div>
              <h3 className="mb-3 font-semibold">
                Streaming links
              </h3>

              <p className="mb-4 text-sm text-stone-400">
                Add links where listeners can stream this song.
                Leave a platform blank if the song is not available there.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {streamingPlatforms.map((platform) => (
                  <div key={platform.key}>
                    <label
                      htmlFor={platform.key}
                      className="mb-2 block text-sm text-stone-300"
                    >
                      {platform.label}
                    </label>

                    <input
                      id={platform.key}
                      type="url"
                      value={streamingLinks[platform.key]}
                      onChange={(event) =>
                        handleLinkChange(
                          platform.key,
                          event.target.value
                        )
                      }
                      placeholder="https://..."
                      className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 outline-none focus:border-amber-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving || uploading}
              className="w-full rounded-lg bg-amber-500 px-6 py-3 font-bold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {saving ? "Saving song..." : "Add Song"}
            </button>
          </form>
        </section>

        {/* Existing songs */}
        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Your Songs</h2>

            <span className="rounded-full border border-stone-700 px-3 py-1 text-sm text-stone-300">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </span>
          </div>

          {songs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-700 p-10 text-center">
              <p className="text-lg font-medium">No songs yet</p>

              <p className="mt-2 text-sm text-stone-400">
                Add your first song using the form above.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {songs.map((song) => (
                <article
                  key={song.id}
                  className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900"
                >
                  {song.coverImage ? (
                    <img
                      src={song.coverImage}
                      alt={`${song.title} cover`}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-stone-800 text-stone-500">
                      No cover image
                    </div>
                  )}

                  <div className="p-5">
                    <h3 className="break-words text-lg font-semibold">
                      {song.title}
                    </h3>

                    {song.releaseDate && (
                      <p className="mt-1 text-sm text-stone-400">
                        Released: {song.releaseDate}
                      </p>
                    )}

                    {/* Display saved streaming links */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {streamingPlatforms.map((platform) => {
                        const url =
                          song.streamingLinks?.[platform.key];

                        if (!url) return null;

                        return (
                          <a
                            key={platform.key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-stone-700 px-2 py-1 text-xs text-amber-400 hover:border-amber-500"
                          >
                            {platform.label}
                          </a>
                        );
                      })}
                    </div>

                    {/* Delete song */}
                    <button
                      type="button"
                      onClick={() => handleDelete(song)}
                      className="mt-5 w-full rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-950"
                    >
                      Delete Song
                    </button>
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
