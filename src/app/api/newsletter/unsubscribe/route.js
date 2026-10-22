
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function confirmationPage(token, message = "") {
  const safeToken = token.replace(/[^a-f0-9]/gi, "");

  const notice = message
    ? `<p style="color:#b91c1c">${message}</p>`
    : "";

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribe | Jonny Boss</title>
</head>
<body style="margin:0;background:#1c1917;color:#fafaf9;font-family:Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px">
  <main style="max-width:460px;background:#292524;padding:32px;border-radius:16px;text-align:center">
    <h1 style="color:#fbbf24">Jonny Boss</h1>
    <h2>Unsubscribe from updates</h2>
    <p>Would you like to stop receiving Jonny Boss music and newsletter updates?</p>
    ${notice}
    <form method="POST" action="/api/newsletter/unsubscribe">
      <input type="hidden" name="token" value="${safeToken}">
      <button type="submit" style="background:#f59e0b;border:0;border-radius:8px;padding:14px 20px;font-weight:bold;cursor:pointer">
        Confirm Unsubscribe
      </button>
    </form>
  </main>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function GET(request) {
  const token = request.nextUrl.searchParams.get("token") || "";

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return new NextResponse("Invalid or missing unsubscribe link.", {
      status: 400,
    });
  }

  return confirmationPage(token);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const token = String(formData.get("token") || "");

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return new NextResponse("Invalid unsubscribe link.", {
        status: 400,
      });
    }

    const tokenHash = hashToken(token);

    const snapshot = await adminDb
      .collection("newsletterSubscribers")
      .where("unsubscribeTokenHashes", "array-contains", tokenHash)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return new NextResponse(
        "This unsubscribe link is invalid or has expired.",
        { status: 404 }
      );
    }

    const subscriberDoc = snapshot.docs[0];
    const subscriber = subscriberDoc.data();

    if (subscriber.status !== "unsubscribed") {
      await subscriberDoc.ref.update({
        status: "unsubscribed",
        unsubscribedAt: FieldValue.serverTimestamp(),
      });
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed | Jonny Boss</title>
</head>
<body style="margin:0;background:#1c1917;color:#fafaf9;font-family:Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:20px">
  <main style="max-width:460px;background:#292524;padding:32px;border-radius:16px;text-align:center">
    <h1 style="color:#fbbf24">Jonny Boss</h1>
    <h2>You've been unsubscribed</h2>
    <p>You will no longer receive newsletter campaigns at this email address.</p>
  </main>
</body>
</html>`,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);

    return new NextResponse(
      "We couldn't process your request. Please try again later.",
      { status: 500 }
    );
  }
}
