
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { getDoc } from "firebase/firestore";
import AdminNavbar from "@/components/AdminNavbar";
import { auth, db } from "@/lib/firebase";

function createSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SmartLinksPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [songs, setSongs] = useState([]);
  const [smartLinks, setSmartLinks] = useState([]);
  const [selectedSong, setSelectedSong] = useState("");
  const [slug, setSlug] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    const [songsSnapshot, linksSnapshot] = await Promise.all([
      getDocs(collection(db, "songs")),
      getDocs(
        query(
          collection(db, "smartLinks"),
          orderBy("createdAt", "desc")
        )
      ),
    ]);

    const songList = songsSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    const linkList = linksSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));

    setSongs(songList);
    setSmartLinks(linkList);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }

      try {
        const { getDoc } = await import("firebase/firestore");
        const userSnapshot = await getDoc(doc(db, "users", user.uid));

        if (
          !userSnapshot.exists() ||
          userSnapshot.data().role !== "admin" ||
          userSnapshot.data().active !== true
        ) {
          router.replace("/admin/login");
          return;
        }

        await loadData();
      } catch (err) {
        console.error(err);
        setError("Unable to load songs and SmartLinks. Check your Firestore rules.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  function handleSongChange(songId) {
    setSelectedSong(songId);
    setMessage("");
    setError("");

    const song = songs.find((item) => item.id === songId);

    if (song) {
      setSlug(createSlug(song.title || ""));
    } else {
      setSlug("");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!selectedSong) {
      setError("Please select a song.");
      return;
    }

    const cleanSlug = createSlug(slug);

    if (!cleanSlug) {
      setError("Please enter a valid SmartLink slug.");
      return;
    }

    setSaving(true);

    try {
      const existingLink = await getDocs(
        query(
          collection(db, "smartLinks"),
          where("slug", "==", cleanSlug)
        )
      );

      if (!existingLink.empty) {
        setError("This SmartLink slug already exists. Choose another one.");
        return;
      }

      const song = songs.find((item) => item.id === selectedSong);

      await addDoc(collection(db, "smartLinks"), {
        slug: cleanSlug,
        songId: selectedSong,
        songTitle: song.title || "Untitled song",
        published: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
      });

      setMessage("SmartLink created successfully!");
      setSelectedSong("");
      setSlug("");
      await loadData();
    } catch (err) {
      console.error(err);
      setError("Could not create the SmartLink. Check your Firestore rules and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(linkId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this SmartLink?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await deleteDoc(doc(db, "smartLinks", linkId));
      setSmartLinks((current) =>
        current.filter((item) => item.id !== linkId)
      );
      setMessage("SmartLink deleted.");
    } catch (err) {
      console.error(err);
      setError("Unable to delete this SmartLink.");
    }
  }

  async function copyLink(slugValue) {
    const url = `${window.location.origin}/listen/${slugValue}`;

    try {
      await navigator.clipboard.writeText(url);
      setMessage("SmartLink copied to clipboard!");
    } catch {
      setMessage(`Copy this link: ${url}`);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5eee8] text-[#1c0d08]">
  Loading SmartLinks...
</main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08] md:flex">
  <AdminNavbar />

  <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <Link
          href="/admin/dashboard"
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          ← Back to Dashboard
        </Link>

        <header className="mb-8 mt-5">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Jonny Boss
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            SmartLink Generator
          </h1>
          <p className="mt-3 max-w-2xl text-stone-400">
            Create one shareable link for each song. Fans will use it to find
            your music on their preferred streaming platforms.
          </p>
        </header>

        {message && (
          <div className="mb-5 rounded-lg border border-green-800 bg-green-950 p-4 text-green-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg border border-red-800 bg-red-950 p-4 text-red-300">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-stone-800 bg-stone-900 p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Create a SmartLink</h2>

          {songs.length === 0 ? (
            <p className="mt-4 text-stone-400">
              You have not added any songs yet. Add a song in{" "}
              <Link
                href="/admin/songs"
                className="text-amber-400 underline"
              >
                Songs Management
              </Link>{" "}
              first.
            </p>
          ) : (
            <form onSubmit={handleCreate} className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="song"
                  className="mb-2 block text-sm font-medium"
                >
                  Select a song
                </label>
                <select
                  id="song"
                  value={selectedSong}
                  onChange={(event) => handleSongChange(event.target.value)}
                  required
                  className="w-full rounded-lg border border-stone-700 bg-stone-950 px-4 py-3 text-white outline-none focus:border-amber-500"
                >
                  <option value="">Choose one of your songs</option>
                  {songs.map((song) => (
                    <option key={song.id} value={song.id}>
                      {song.title || "Untitled song"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="slug"
                  className="mb-2 block text-sm font-medium"
                >
                  Custom SmartLink name
                </label>
                <div className="flex flex-col overflow-hidden rounded-lg border border-stone-700 sm:flex-row">
                  <span className="bg-stone-800 px-3 py-3 text-sm text-stone-400 sm:whitespace-nowrap">
                    /listen/
                  </span>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="my-new-song"
                    required
                    className="min-w-0 flex-1 bg-stone-950 px-4 py-3 text-white outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Use letters, numbers, and hyphens. The song title fills this
                  in automatically, but you can change it.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-amber-500 px-6 py-3 font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create SmartLink"}
              </button>
            </form>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Your SmartLinks</h2>
            <span className="rounded-full bg-stone-800 px-3 py-1 text-sm text-stone-300">
              {smartLinks.length} total
            </span>
          </div>

          {smartLinks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-700 p-8 text-center text-stone-400">
              No SmartLinks created yet. Create your first one above.
            </div>
          ) : (
            <div className="space-y-4">
              {smartLinks.map((link) => (
                <article
                  key={link.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-stone-800 bg-stone-900 p-5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">
                      {link.songTitle || "Untitled song"}
                    </h3>
                    <p className="mt-1 break-all text-sm text-amber-400">
                      /listen/{link.slug}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(link.slug)}
                      className="rounded-lg border border-white-700 px-4 py-2 text-sm hover:border-amber-500 hover:text-amber-400"
                    >
                      Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(link.id)}
                      className="rounded-lg border border-red-900 px-4 py-2 text-sm text-red-400 hover:bg-red-950"
                    >
                      Delete
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
