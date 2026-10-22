"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import AdminNavbar from "@/components/AdminNavbar";

const sections = [
  {
    title: "Homepage",
    description: "Manage your artist name, homepage photo, text, and appearance.",
    href: "/admin/homepage",
    icon: "⌂",
    status: "Homepage settings",
  },
  {
    title: "Songs",
    description: "Manage music releases, cover images, and streaming links.",
    href: "/admin/songs",
    icon: "♫",
    status: "Music library",
  },
  {
    title: "Music Videos",
    description: "Manage YouTube videos and connect videos to their songs.",
    href: "/admin/videos",
    icon: "▷",
    status: "Video library",
  },
  {
    title: "Newsletter",
    description: "View subscribers, create campaigns, and send email updates.",
    href: "/admin/newsletter",
    icon: "✉",
    status: "Email campaigns",
  },
];

const platforms = [
  { key: "spotify", label: "Spotify" },
  { key: "appleMusic", label: "Apple Music" },
  { key: "amazonMusic", label: "Amazon Music" },
  { key: "audiomack", label: "Audiomack" },
  { key: "boomplay", label: "Boomplay" },
  { key: "youtubeMusic", label: "YouTube Music" },
];

function getDate(value) {
  if (!value) return null;

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (value.seconds) {
    date = new Date(value.seconds * 1000);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

function getActivityDate(item, type) {
  if (type === "song") {
    return getDate(item.releaseDate) || getDate(item.createdAt);
  }

  return getDate(item.createdAt) || getDate(item.releaseDate);
}

function hasStreamingLinks(song) {
  const links = song.streamingLinks || {};

  return platforms.some(({ key }) => {
    const value = links[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function getPlatformCounts(songs) {
  return platforms.map((platform) => ({
    ...platform,
    count: songs.filter((song) => {
      const value = song.streamingLinks?.[platform.key];
      return typeof value === "string" && value.trim().length > 0;
    }).length,
  }));
}

function getMonthlyActivity(songs, videos) {
  const now = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - index),
      1
    );

    const nextMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      1
    );

    const songCount = songs.filter((song) => {
      const activityDate = getActivityDate(song, "song");
      return (
        activityDate &&
        activityDate >= date &&
        activityDate < nextMonth
      );
    }).length;

    const videoCount = videos.filter((video) => {
      const activityDate = getActivityDate(video, "video");
      return (
        activityDate &&
        activityDate >= date &&
        activityDate < nextMonth
      );
    }).length;

    return {
      label: date.toLocaleDateString("en", { month: "short" }),
      songs: songCount,
      videos: videoCount,
    };
  });
}

function AnalyticsCard({ label, value, description, icon }) {
  return (
    <article className="rounded-2xl border border-[#e0cfc2] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#70432c]">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5eee8] text-xl text-[#70432c]">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-black tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#8d5b3d]">
        {description}
      </p>
    </article>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [analyticsError, setAnalyticsError] = useState("");

  const [songs, setSongs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        const userData = userSnapshot.exists()
          ? userSnapshot.data()
          : null;

        if (!active) return;

        if (
          !userData ||
          userData.role !== "admin" ||
          userData.active !== true
        ) {
          await signOut(auth);
          if (active) router.replace("/login");
          return;
        }

        setAdminEmail(user.email || "Administrator");
        setLoading(false);

        setAnalyticsLoading(true);
        setAnalyticsError("");

        try {
          const [songsSnapshot, videosSnapshot] = await Promise.all([
            getDocs(collection(db, "songs")),
            getDocs(collection(db, "videos")),
          ]);

          if (!active) return;

          setSongs(
            songsSnapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }))
          );

          setVideos(
            videosSnapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            }))
          );

          setLastUpdated(new Date());
        } catch (error) {
          console.error("Analytics loading failed:", error);

          if (active) {
            setAnalyticsError(
              "Unable to load music analytics. Check your Firestore rules and the songs/videos collection names."
            );
          }
        } finally {
          if (active) setAnalyticsLoading(false);
        }
      } catch (error) {
        console.error("Admin verification failed:", error);

        if (active) {
          await signOut(auth);
          router.replace("/login");
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  async function refreshAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError("");

    try {
      const [songsSnapshot, videosSnapshot] = await Promise.all([
        getDocs(collection(db, "songs")),
        getDocs(collection(db, "videos")),
      ]);

      setSongs(
        songsSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setVideos(
        videosSnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Analytics refresh failed:", error);
      setAnalyticsError(
        "Unable to refresh analytics. Check your Firestore rules."
      );
    } finally {
      setAnalyticsLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#120906] text-[#f5eee8]">
        <p className="text-sm text-[#c9b9ae]">
          Verifying administrator...
        </p>
      </main>
    );
  }

  const songsWithLinks = songs.filter(hasStreamingLinks);
  const songsWithoutLinks = songs.length - songsWithLinks.length;

  const linkedVideos = videos.filter((video) => {
    return Boolean(video.songId) &&
      songs.some((song) => song.id === video.songId);
  });

  const unlinkedVideos = videos.length - linkedVideos.length;

  const platformCounts = getPlatformCounts(songs);
  const maxPlatformCount = Math.max(
    1,
    ...platformCounts.map((item) => item.count)
  );

  const monthlyActivity = getMonthlyActivity(songs, videos);
  const maxMonthlyCount = Math.max(
    1,
    ...monthlyActivity.flatMap((item) => [
      item.songs,
      item.videos,
    ])
  );

  const recentSongs = [...songs]
    .sort((a, b) => {
      const dateA = getActivityDate(a, "song")?.getTime() || 0;
      const dateB = getActivityDate(b, "song")?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const recentVideos = [...videos]
    .sort((a, b) => {
      const dateA = getActivityDate(a, "video")?.getTime() || 0;
      const dateB = getActivityDate(b, "video")?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-[#f5eee8] text-[#1c0d08] md:flex">
      <AdminNavbar />

      <section className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d9c6b8] pb-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8d5b3d]">
              Website Management
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-3 text-sm text-[#70432c]">
              Welcome back, {adminEmail}
            </p>
          </div>

          <span className="rounded-full border border-[#d9c6b8] bg-white px-4 py-2 text-xs font-semibold text-[#56301f]">
            Administrator
          </span>
        </header>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8d5b3d]">
                Performance Overview
              </p>
              <h2 className="mt-2 text-2xl font-black">
                Music & Video Analytics
              </h2>
              <p className="mt-2 text-sm text-[#70432c]">
                An overview of your published content and streaming links.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshAnalytics}
              disabled={analyticsLoading}
              className="rounded-xl bg-[#56301f] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#70432c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analyticsLoading ? "Refreshing..." : "↻ Refresh analytics"}
            </button>
          </div>

          {analyticsError && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {analyticsError}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AnalyticsCard
              label="Total songs"
              value={analyticsLoading ? "…" : songs.length}
              description="Songs saved in your music library"
              icon="♫"
            />
            <AnalyticsCard
              label="Total music videos"
              value={analyticsLoading ? "…" : videos.length}
              description="Videos saved in your video library"
              icon="▷"
            />
            <AnalyticsCard
              label="Songs with streaming links"
              value={analyticsLoading ? "…" : songsWithLinks.length}
              description="Songs with at least one supported music link"
              icon="↗"
            />
            <AnalyticsCard
              label="Videos linked to songs"
              value={analyticsLoading ? "…" : linkedVideos.length}
              description="Videos linked to an existing song"
              icon="🔗"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AnalyticsCard
              label="Songs missing streaming links"
              value={analyticsLoading ? "…" : songsWithoutLinks}
              description="Songs that may need streaming platform links"
              icon="!"
            />
            <AnalyticsCard
              label="Videos not linked to songs"
              value={analyticsLoading ? "…" : unlinkedVideos}
              description="Videos that may need a song association"
              icon="◇"
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-[#e0cfc2] bg-white p-5 shadow-sm sm:p-6">
              <div>
                <h3 className="text-lg font-bold">
                  Content activity
                </h3>
                <p className="mt-1 text-sm text-[#70432c]">
                  Songs by release date and videos by creation date, over the last six months.
                </p>
              </div>

              {analyticsLoading ? (
                <p className="mt-8 text-sm text-[#70432c]">
                  Loading chart...
                </p>
              ) : (
                <>
                  <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-[#70432c]" />
                      Songs
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm bg-[#c9a184]" />
                      Videos
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-6 gap-3">
                    {monthlyActivity.map((month) => (
                      <div key={month.label} className="min-w-0 text-center">
                        <div className="flex h-44 items-end justify-center gap-1 border-b border-[#eadfd5] pb-2">
                          <div
                            title={`${month.songs} songs`}
                            className="w-3 rounded-t bg-[#70432c] transition-all sm:w-5"
                            style={{
                              height: `${Math.max(
                                month.songs > 0 ? 5 : 0,
                                (month.songs / maxMonthlyCount) * 100
                              )}%`,
                            }}
                          />
                          <div
                            title={`${month.videos} videos`}
                            className="w-3 rounded-t bg-[#c9a184] transition-all sm:w-5"
                            style={{
                              height: `${Math.max(
                                month.videos > 0 ? 5 : 0,
                                (month.videos / maxMonthlyCount) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="mt-3 text-xs text-[#70432c]">
                          {month.label}
                        </p>
                        <p className="mt-1 text-[10px] text-[#8d5b3d]">
                          {month.songs}S / {month.videos}V
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-4 text-xs leading-5 text-[#8d5b3d]">
                    S = songs, V = videos. Older records without usable dates may not appear in this chart.
                  </p>
                </>
              )}
            </section>

            <section className="rounded-2xl border border-[#e0cfc2] bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-bold">
                Streaming platform coverage
              </h3>
              <p className="mt-1 text-sm text-[#70432c]">
                Number of songs that have a link for each platform.
              </p>

              {analyticsLoading ? (
                <p className="mt-8 text-sm text-[#70432c]">
                  Loading platform data...
                </p>
              ) : (
                <div className="mt-6 space-y-5">
                  {platformCounts.map((platform) => (
                    <div key={platform.key}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium">
                          {platform.label}
                        </span>
                        <span className="text-[#70432c]">
                          {platform.count} / {songs.length}
                        </span>
                      </div>

                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-[#f0e5dc]"
                        role="progressbar"
                        aria-label={`${platform.label} song coverage`}
                        aria-valuemin={0}
                        aria-valuemax={songs.length}
                        aria-valuenow={platform.count}
                      >
                        <div
                          className="h-full rounded-full bg-[#70432c] transition-all"
                          style={{
                            width: `${
                              songs.length
                                ? (platform.count / songs.length) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="mt-8 rounded-2xl border border-[#e0cfc2] bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Content health check</h3>
                <p className="mt-1 text-sm text-[#70432c]">
                  Find content that may need attention.
                </p>
              </div>
            </div>

            {analyticsLoading ? (
              <p className="mt-5 text-sm text-[#70432c]">
                Checking your content...
              </p>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-[#faf4ef] p-4">
                  <p className="text-sm font-semibold">Streaming links</p>
                  <p className="mt-2 text-sm text-[#70432c]">
                    {songsWithoutLinks === 0
                      ? "Every song has at least one supported streaming link."
                      : `${songsWithoutLinks} song(s) have no supported streaming links yet.`}
                  </p>
                  <Link
                    href="/admin/songs"
                    className="mt-3 inline-block text-sm font-bold text-[#70432c] hover:text-[#a97955]"
                  >
                    Manage songs →
                  </Link>
                </div>

                <div className="rounded-xl bg-[#faf4ef] p-4">
                  <p className="text-sm font-semibold">Video associations</p>
                  <p className="mt-2 text-sm text-[#70432c]">
                    {unlinkedVideos === 0
                      ? "Every video is linked to a song in your library."
                      : `${unlinkedVideos} video(s) are not linked to an existing song.`}
                  </p>
                  <Link
                    href="/admin/videos"
                    className="mt-3 inline-block text-sm font-bold text-[#70432c] hover:text-[#a97955]"
                  >
                    Manage videos →
                  </Link>
                </div>
              </div>
            )}
          </section>

          {lastUpdated && !analyticsLoading && (
            <p className="mt-4 text-right text-xs text-[#8d5b3d]">
              Analytics last refreshed: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold">Manage Your Website</h2>
          <p className="mt-2 text-sm leading-6 text-[#70432c]">
            Choose a section below to manage your official Jonny Boss website.
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-2">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-[#e0cfc2] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#a97955] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5eee8] text-2xl font-bold text-[#70432c]">
                    {section.icon}
                  </div>
                  <span className="rounded-full bg-[#f5eee8] px-3 py-1 text-xs font-semibold text-[#70432c]">
                    {section.status}
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold">
                  {section.title}
                </h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-[#70432c]">
                  {section.description}
                </p>

                <Link
                  href={section.href}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#70432c] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#56301f]"
                >
                  Open {section.title}
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-10 border-t border-[#d9c6b8] pt-5 text-xs text-[#8d5b3d]">
          Jonny Boss Admin Panel
        </footer>
      </section>
    </main>
  );
}
