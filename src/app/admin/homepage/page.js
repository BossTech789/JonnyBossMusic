
"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";

const defaults = {
  artistName: "JONNY BOSS",
  backgroundColor: "#120906",
  textColor: "#f5eee8",
  overlayOpacity: 30,
  imageUrl: "",
};

export default function HomepageManagement() {
  const router = useRouter();

  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const profile = await getDoc(doc(db, "users", user.uid));

        if (
          !profile.exists() ||
          profile.data().role !== "admin" ||
          profile.data().active !== true
        ) {
          await signOut(auth);
          router.replace("/login");
          return;
        }

        const homepage = await getDoc(
          doc(db, "siteSettings", "homepage")
        );

        if (homepage.exists()) {
          setSettings((current) => ({
            ...current,
            ...homepage.data(),
          }));
        }

        setLoading(false);
      } catch (error) {
        console.error("Unable to load homepage settings:", error);
        setMessage("Unable to load homepage settings.");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  function updateSetting(field, value) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Please choose an image smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    setUploadingImage(true);
    setMessage("");

    try {
      const cloudName =
        process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset =
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error(
          "Cloudinary settings are missing from .env.local."
        );
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error?.message || "Image upload failed."
        );
      }

      updateSetting("imageUrl", result.secure_url);
      setMessage(
        "Photo uploaded. Click Save Homepage Settings to save your changes."
      );
    } catch (error) {
      console.error("Image upload failed:", error);
      setMessage(error.message || "Could not upload the image.");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      await setDoc(
        doc(db, "siteSettings", "homepage"),
        {
          artistName: settings.artistName.trim() || "JONNY BOSS",
          backgroundColor: settings.backgroundColor,
          textColor: settings.textColor,
          overlayOpacity: Number(settings.overlayOpacity),
          imageUrl: settings.imageUrl || "",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setMessage("Homepage settings saved successfully!");
    } catch (error) {
      console.error("Saving homepage settings failed:", error);
      setMessage(
        "Could not save settings. Check your Firestore permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#120906] text-[#f5eee8]">
        Loading homepage settings...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08] md:flex">
      <AdminNavbar />

      <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <button
          type="button"
          onClick={() => router.push("/admin/dashboard")}
          className="mb-6 text-sm font-semibold text-[#70432c] hover:text-[#120906]"
        >
          ← Back to Dashboard
        </button>

        <header className="border-b border-[#d9c6b8] pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8d5b3d]">
            Website Appearance
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Homepage Management
          </h1>
          <p className="mt-3 text-sm text-[#70432c]">
            Customize your artist photo, name, and homepage colors.
          </p>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <form
            onSubmit={saveSettings}
            className="space-y-6 rounded-2xl border border-[#e0cfc2] bg-white p-6 shadow-sm"
          >
            <div>
              <label
                htmlFor="artist-photo"
                className="mb-2 block text-sm font-semibold"
              >
                Artist homepage photo
              </label>

              <input
                id="artist-photo"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="block w-full rounded-lg border border-[#d9c6b8] bg-[#f5eee8] p-3 text-sm"
              />

              {uploadingImage && (
                <p className="mt-2 text-sm text-[#8d5b3d]">
                  Uploading photo...
                </p>
              )}

              {settings.imageUrl && (
                <img
                  src={settings.imageUrl}
                  alt="Artist homepage preview"
                  className="mt-4 h-48 w-full rounded-xl object-cover"
                />
              )}
            </div>

            <div>
              <label
                htmlFor="artist-name"
                className="mb-2 block text-sm font-semibold"
              >
                Artist name
              </label>
              <input
                id="artist-name"
                value={settings.artistName}
                onChange={(event) =>
                  updateSetting("artistName", event.target.value)
                }
                maxLength={60}
                required
                className="w-full rounded-lg border border-[#d9c6b8] px-4 py-3 outline-none focus:border-[#8d5b3d]"
              />
            </div>

            <div>
              <label
                htmlFor="background-color"
                className="mb-2 block text-sm font-semibold"
              >
                Background color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="background-color"
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(event) =>
                    updateSetting("backgroundColor", event.target.value)
                  }
                  className="h-12 w-16 cursor-pointer rounded border-0"
                />
                <span className="text-sm text-[#70432c]">
                  {settings.backgroundColor}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="text-color"
                className="mb-2 block text-sm font-semibold"
              >
                Artist name color
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="text-color"
                  type="color"
                  value={settings.textColor}
                  onChange={(event) =>
                    updateSetting("textColor", event.target.value)
                  }
                  className="h-12 w-16 cursor-pointer rounded border-0"
                />
                <span className="text-sm text-[#70432c]">
                  {settings.textColor}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="overlay-opacity"
                className="mb-2 block text-sm font-semibold"
              >
                Dark photo overlay: {settings.overlayOpacity}%
              </label>
              <input
                id="overlay-opacity"
                type="range"
                min="0"
                max="80"
                value={settings.overlayOpacity}
                onChange={(event) =>
                  updateSetting(
                    "overlayOpacity",
                    Number(event.target.value)
                  )
                }
                className="w-full accent-[#70432c]"
              />
            </div>

            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="w-full rounded-lg bg-[#70432c] px-5 py-3 font-bold text-white transition hover:bg-[#56301f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Homepage Settings"}
            </button>

            {message && (
              <p
                aria-live="polite"
                className="rounded-lg bg-[#f5eee8] p-3 text-sm text-[#56301f]"
              >
                {message}
              </p>
            )}
          </form>

          <section>
            <p className="mb-3 text-sm font-semibold text-[#70432c]">
              Live preview
            </p>

            <div
              className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border border-[#d9c6b8] shadow-sm"
              style={{ backgroundColor: settings.backgroundColor }}
            >
              {settings.imageUrl && (
                <img
                  src={settings.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}

              <div
                className="absolute inset-0 bg-black"
                style={{
                  opacity: Number(settings.overlayOpacity) / 100,
                }}
              />

              <h2
                className="relative z-10 px-4 text-center text-4xl font-black uppercase tracking-[0.15em] sm:text-5xl"
                style={{ color: settings.textColor }}
              >
                {settings.artistName || "JONNY BOSS"}
              </h2>
            </div>

            <p className="mt-3 text-xs leading-5 text-[#8d5b3d]">
              Changes appear here immediately. Save your settings to store
              them in Firestore.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
