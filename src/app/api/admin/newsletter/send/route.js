
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { randomBytes, createHash } from "node:crypto";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

async function verifyAdmin(request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "You must sign in as an administrator." },
        { status: 401 }
      ),
    };
  }

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(
      authorization.substring(7)
    );
  } catch {
    return {
      error: NextResponse.json(
        { error: "Your session is invalid or expired. Please sign in again." },
        { status: 401 }
      ),
    };
  }

  const userDoc = await adminDb
    .collection("users")
    .doc(decodedToken.uid)
    .get();

  if (
    !userDoc.exists ||
    userDoc.data().role !== "admin" ||
    userDoc.data().active !== true
  ) {
    return {
      error: NextResponse.json(
        { error: "You are not authorized to perform this action." },
        { status: 403 }
      ),
    };
  }

  return { decodedToken };
}

// GET: Load campaign history.
export async function GET(request) {
  try {
    const verification = await verifyAdmin(request);

    if (verification.error) {
      return verification.error;
    }

    const snapshot = await adminDb
      .collection("newsletterCampaigns")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const campaigns = snapshot.docs.map((campaignDoc) => {
      const data = campaignDoc.data();

      return {
        id: campaignDoc.id,
        subject: data.subject || "",
        status: data.status || "unknown",
        recipientCount: data.recipientCount || 0,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || 0,
        createdAt: data.createdAt?.toDate?.().toISOString() || null,
        completedAt: data.completedAt?.toDate?.().toISOString() || null,
      };
    });

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Newsletter history API error:", error);

    return NextResponse.json(
      { error: "Unable to load newsletter campaign history." },
      { status: 500 }
    );
  }
}

// POST: Send a newsletter campaign.
export async function POST(request) {
  let transporter;

  try {
    const verification = await verifyAdmin(request);

    if (verification.error) {
      return verification.error;
    }

    const { decodedToken } = verification;

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const subject =
      typeof body.subject === "string" ? body.subject.trim() : "";

    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (
      !subject ||
      subject.length > 150 ||
      /[\r\n]/.test(subject) ||
      !message ||
      message.length > 10000
    ) {
      return NextResponse.json(
        { error: "Enter a valid subject and message." },
        { status: 400 }
      );
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      return NextResponse.json(
        { error: "Gmail SMTP is not configured on the server." },
        { status: 500 }
      );
    }

    // Set NEXT_PUBLIC_SITE_URL to your website's base URL.
    // Local development can use http://localhost:3000.
    const configuredSiteUrl = process.env.SITE_URL;

    if (!configuredSiteUrl) {
      return NextResponse.json(
        {
          error:
            "Website URL is missing. Set NEXT_PUBLIC_SITE_URL in .env.local and restart the server.",
        },
        { status: 500 }
      );
    }

    let siteUrl;

    try {
      const parsedUrl = new URL(configuredSiteUrl);

      if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        (parsedUrl.protocol === "http:" &&
          !["localhost", "127.0.0.1"].includes(parsedUrl.hostname))
      ) {
        throw new Error("Invalid website URL.");
      }

      siteUrl = parsedUrl.origin;
    } catch {
      return NextResponse.json(
        {
          error:
            "NEXT_PUBLIC_SITE_URL must be a valid HTTPS website URL, or localhost for development.",
        },
        { status: 500 }
      );
    }

    const subscribersSnapshot = await adminDb
      .collection("newsletterSubscribers")
      .where("status", "==", "active")
      .get();

    const subscribers = subscribersSnapshot.docs.filter((subscriberDoc) => {
      const data = subscriberDoc.data();

      return (
        typeof data.email === "string" &&
        data.email.trim().length > 3
      );
    });

    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: "There are no active subscribers to email." },
        { status: 400 }
      );
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    // Verify SMTP connectivity before creating the campaign record.
    await transporter.verify();

    const campaignRef = await adminDb
      .collection("newsletterCampaigns")
      .add({
        subject,
        message,
        status: "sending",
        recipientCount: subscribers.length,
        sentCount: 0,
        failedCount: 0,
        createdBy: decodedToken.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

    let sentCount = 0;
    let failedCount = 0;

    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message);

    for (const subscriberDoc of subscribers) {
      const subscriber = subscriberDoc.data();

      try {
        // Generate an unpredictable token; store only its hash.
        const unsubscribeToken = randomBytes(32).toString("hex");
        const tokenHash = hashToken(unsubscribeToken);

        await subscriberDoc.ref.update({
          unsubscribeTokenHashes: FieldValue.arrayUnion(tokenHash),
        });

        const unsubscribeUrl =
          `${siteUrl}/api/newsletter/unsubscribe?token=${unsubscribeToken}`;

        const plainText = [
          message,
          "",
          "Unsubscribe from Jonny Boss newsletter updates:",
          unsubscribeUrl,
        ].join("\n");

        const htmlMessage = safeMessage.replace(/\r?\n/g, "<br>");


   
const html = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Jonny Boss Fan Newsletter</title>
    </head>

    <body style="
      margin:0;
      padding:30px 12px;
      background-color:#1c1410;
      color:#f5e6d3;
      font-family:Arial,Helvetica,sans-serif;
    ">

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
              style="
                max-width:600px;
                margin:0 auto;
                background-color:#2b1e18;
                border:1px solid #5c4030;
                border-radius:16px;
                overflow:hidden;
              ">

              <!-- Header -->
              <tr>
                <td align="center" style="
                  padding:40px 24px;
                  background-color:#3b281e;
                  border-bottom:3px solid #b8895b;
                ">

                  <p style="
                    margin:0 0 12px;
                    color:#d6b18a;
                    font-size:11px;
                    letter-spacing:4px;
                    text-transform:uppercase;
                  ">
                    OFFICIAL FAN NEWSLETTER
                  </p>

                  <h1 style="
                    margin:0;
                    color:#f5e6d3;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:36px;
                    letter-spacing:3px;
                  ">
                    JONNY BOSS
                  </h1>

                  <p style="
                    margin:14px 0 0;
                    color:#d6b18a;
                    font-size:13px;
                    letter-spacing:2px;
                  ">
                    MUSIC • LOVE • APPRECIATION
                  </p>

                </td>
              </tr>

              <!-- Newsletter Content -->
              <tr>
                <td align="center" style="padding:35px 28px;">

                  <h2 style="
                    margin:0 0 24px;
                    color:#e7bc8c;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:26px;
                    line-height:1.5;
                    text-align:center;
                  ">
                    ${safeSubject}
                  </h2>

                  <div style="
                    color:#f5e9dc;
                    font-size:15px;
                    line-height:1.9;
                    text-align:center;
                    overflow-wrap:break-word;
                  ">
                    ${htmlMessage}
                  </div>

                  <!-- Appreciation Message -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                    style="
                      margin-top:30px;
                      background-color:#3b281e;
                      border:1px solid #654832;
                      border-radius:10px;
                    ">
                    <tr>
                      <td align="center" style="padding:24px 18px;">

                        <p style="
                          margin:0 0 12px;
                          color:#e7bc8c;
                          font-family:Georgia,'Times New Roman',serif;
                          font-size:19px;
                          font-style:italic;
                          line-height:1.7;
                        ">
                          Every song has a story, and every fan is part of mine.
                        </p>

                        <p style="
                          margin:0;
                          color:#d6b18a;
                          font-size:13px;
                          line-height:1.8;
                        ">
                          Thank you for being part of the Jonny Boss family.
                          Your love and support mean everything.
                        </p>

                      </td>
                    </tr>
                  </table>

                  <p style="
                    margin:28px 0 8px;
                    color:#e7bc8c;
                    font-size:15px;
                    font-weight:bold;
                    text-align:center;
                  ">
                    Stay connected. Stay inspired.
                  </p>

                  <p style="
                    margin:0;
                    color:#d6c1ad;
                    font-size:14px;
                    line-height:1.8;
                    text-align:center;
                  ">
                    More music, exciting news, and special updates are on the way.
                    Keep spreading love and enjoying the journey with me!
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="
                  padding:28px 22px;
                  background-color:#211712;
                  border-top:1px solid #5c4030;
                ">

                  <p style="
                    margin:0 0 10px;
                    color:#e7bc8c;
                    font-family:Georgia,'Times New Roman',serif;
                    font-size:20px;
                    letter-spacing:2px;
                  ">
                    WITH LOVE, JONNY BOSS
                  </p>

                  <p style="
                    margin:0 0 20px;
                    color:#bda895;
                    font-size:12px;
                    line-height:1.8;
                    text-align:center;
                  ">
                    One family. One love. One beautiful journey.
                  </p>

                  <div style="
                    height:1px;
                    background-color:#493326;
                    margin:20px 0;
                  "></div>

                  <p style="
                    margin:0 0 14px;
                    color:#a99481;
                    font-size:11px;
                    line-height:1.8;
                    text-align:center;
                  ">
                    You received this email because you subscribed to
                    Jonny Boss updates.
                  </p>

                  <a href="${unsubscribeUrl}" style="
                    display:inline-block;
                    padding:10px 20px;
                    color:#f5e6d3;
                    background-color:#493326;
                    border:1px solid #b8895b;
                    border-radius:6px;
                    font-size:12px;
                    text-decoration:none;
                  ">
                    Unsubscribe from these emails
                  </a>

                </td>
              </tr>

            </table>

            <p style="
              margin:20px 0 0;
              color:#8c7665;
              font-size:11px;
              text-align:center;
            ">
              &copy; ${new Date().getFullYear()} Jonny Boss. All rights reserved.
            </p>

          </td>
        </tr>
      </table>

    </body>
  </html>
`;

        await transporter.sendMail({
          from: `"Jonny Boss" <${gmailUser}>`,
          to: subscriber.email.trim(),
          subject,
          text: plainText,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
          },
        });

        sentCount++;
      } catch (error) {
        failedCount++;

        console.error(
          `Newsletter delivery failed for subscriber ${subscriberDoc.id}:`,
          error.message
        );
      }

      // Keep campaign history updated as each recipient is processed.
      await campaignRef.update({
        sentCount,
        failedCount,
      });
    }

    const status =
      failedCount === 0
        ? "sent"
        : sentCount === 0
          ? "failed"
          : "partially_sent";

    await campaignRef.update({
      status,
      sentCount,
      failedCount,
      completedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      message: `Campaign finished. Sent: ${sentCount}. Failed: ${failedCount}.`,
      campaignId: campaignRef.id,
      sentCount,
      failedCount,
    });
  }  catch (error) {
  console.error("Newsletter API error:", {
    message: error?.message,
    code: error?.code,
    name: error?.name,
    command: error?.command,
    responseCode: error?.responseCode,
  });

  return NextResponse.json(
    {
      error:
        error?.message ||
        "The newsletter campaign could not be completed.",
    },
    { status: 500 }
  );
  } finally {
    if (transporter) {
      transporter.close();
    }
  }
}
