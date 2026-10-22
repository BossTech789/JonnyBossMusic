
import Link from "next/link";

const socialLinks = [
  { name: "Facebook", url: "https://www.facebook.com/realjonnyboss1" },
  { name: "Instagram", url: "https://www.instagram.com/realjonnyboss" },
  { name: "X", url: "https://x.com/realjonnyboss" },
  { name: "Snapchat", url: "https://www.snapchat.com/add/realjonnyboss" },
  { name: "TikTok", url: "https://www.tiktok.com/@realjonnyboss" },
  { name: "Spotify Artist", url: "https://open.spotify.com/artist/7qy2Fy69zpEJVrWqU2CrlF" },
  { name: "Audiomack", url: "https://audiomack.com/realjonnyboss" },
  { name: "Apple Music Artist", url: "https://music.apple.com/ng/artist/jonny-boss/1625954922" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#56301f] bg-[#120906] text-[#f5eee8]">
      <div className="mx-auto max-w-[1200px] px-5 py-14 text-center sm:px-8">

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {socialLinks.map((social) =>
            social.url ? (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#56301f] px-4 py-2 text-sm text-[#f5eee8] transition hover:border-[#a97955] hover:bg-[#3d1f14] hover:text-white"
              >
                {social.name}
              </a>
            ) : (
              <span
                key={social.name}
                className="rounded-full border border-[#3d1f14] px-4 py-2 text-sm text-[#8d5b3d]"
                title="Add the official profile URL in Footer.js"
              >
                {social.name}
              </span>
            )
          )}
        </div>

        <div className="mt-10 border-t border-[#3d1f14] pt-6">
          <p className="text-xs text-[#c9b9ae]">
            © {year} Jonny Boss. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}