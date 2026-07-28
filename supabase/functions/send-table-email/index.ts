// Supabase Edge Runtime types.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();
const TELEGRAM_MAX_AGE_SECONDS = 24 * 60 * 60;
const MINUTE_LIMIT = 1;
const DAILY_LIMIT = 20;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value: unknown) {
  const email = normalizeEmail(value);
  return email.length >= 5 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function maskEmail(value: unknown) {
  const email = normalizeEmail(value);
  const at = email.indexOf("@");
  if (at <= 0) return "";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

function normalizeTitle(value: unknown) {
  const title = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return title || "Практическая таблица";
}

function normalizeKind(value: unknown) {
  const kind = String(value || "table").trim().toLowerCase();
  return ["table", "example", "instruction"].includes(kind) ? kind : "table";
}

function normalizeGoogleSheetUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "docs.google.com") return null;
    if (url.username || url.password) return null;
    if (!/^\/spreadsheets\/d\/[A-Za-z0-9_-]{20,}(?:\/|$)/.test(url.pathname)) return null;
    if (url.href.length > 2048) return null;
    return url.href;
  } catch (_error) {
    return null;
  }
}

function escapeHtml(value: unknown) {
  return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] || char);
}

function bytesToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: unknown, right: unknown) {
  const a = String(left || "").toLowerCase();
  const b = String(right || "").toLowerCase();
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function hmacSha256(keyBytes: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(message));
}

export async function validateTelegramInitData(initData: string, botToken: string) {
  if (!initData || !botToken) {
    return { ok: false as const, error: "OPEN_FROM_TELEGRAM_REQUIRED" };
  }

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch (_error) {
    return { ok: false as const, error: "TELEGRAM_DATA_INVALID" };
  }

  const receivedHash = params.get("hash") || "";
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return { ok: false as const, error: "TELEGRAM_DATA_INVALID" };
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const calculatedHash = bytesToHex(
    await hmacSha256(new Uint8Array(secretKey), dataCheckString),
  );

  if (!constantTimeEqual(calculatedHash, receivedHash)) {
    return { ok: false as const, error: "TELEGRAM_DATA_INVALID" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || authDate > nowSeconds + 300) {
    return { ok: false as const, error: "TELEGRAM_DATA_INVALID" };
  }
  if (nowSeconds - authDate > TELEGRAM_MAX_AGE_SECONDS) {
    return { ok: false as const, error: "TELEGRAM_DATA_EXPIRED" };
  }

  let user: Record<string, unknown>;
  try {
    user = JSON.parse(params.get("user") || "{}") as Record<string, unknown>;
  } catch (_error) {
    return { ok: false as const, error: "TELEGRAM_DATA_INVALID" };
  }

  const telegramId = String(user.id != null ? user.id : "");
  if (!/^\d{1,20}$/.test(telegramId)) {
    return { ok: false as const, error: "TELEGRAM_DATA_INVALID" };
  }

  return {
    ok: true as const,
    telegramId,
    user: {
      id: telegramId,
      firstName: String(user.first_name || "").slice(0, 120),
      lastName: String(user.last_name || "").slice(0, 120),
      username: String(user.username || "").replace(/^@/, "").slice(0, 120),
    },
  };
}

function databaseNotReady(error: unknown) {
  const candidate = error as { code?: string; message?: string } | null;
  const code = String(candidate?.code || "");
  const message = String(candidate?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("app_table_email_");
}

async function countRecentSends(
  supabaseAdmin: any,
  telegramId: string,
  fromIso: string,
) {
  const { count, error } = await supabaseAdmin
    .from("app_table_email_sends")
    .select("id", { count: "exact", head: true })
    .eq("telegram_id", telegramId)
    .gte("created_at", fromIso);

  if (error) throw error;
  return Number(count || 0);
}

function emailHtml({ title, url }: { title: string; url: string }) {
  const safeTitle = escapeHtml(title);
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif;color:#172536;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e4dfd4;">
          <tr>
            <td style="padding:28px 30px;background:#17324d;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:1.4px;text-transform:uppercase;opacity:.78;">АРХИТЕКТУРА</div>
              <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;">${safeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;">
              <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Откройте таблицу на компьютере или ноутбуке. Для личной работы в Google Таблицах выберите <b>Файл → Создать копию</b>.</p>
              <p style="margin:24px 0;text-align:center;">
                <a href="${safeUrl}" style="display:inline-block;padding:14px 24px;border-radius:11px;background:#17324d;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;">Открыть таблицу</a>
              </p>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#667383;">Письмо отправлено по запросу из приложения «АРХИТЕКТУРА». Если кнопка не открывается, скопируйте ссылку ниже в браузер:</p>
              <p style="margin:8px 0 0;font-size:12px;line-height:1.45;word-break:break-all;color:#667383;">${safeUrl}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailText({ title, url }: { title: string; url: string }) {
  return `АРХИТЕКТУРА\n\n${title}\n\nОткройте таблицу на компьютере или ноутбуке:\n${url}\n\nПосле открытия выберите «Файл → Создать копию».`;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json() as Record<string, unknown>;
    } catch (_error) {
      return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
    }

    const action = String(body.action || "send").trim().toLowerCase();
    if (!["profile", "send"].includes(action)) {
      return jsonResponse({ ok: false, error: "INVALID_ACTION" }, 400);
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const telegram = await validateTelegramInitData(
      String(body.initData || ""),
      botToken,
    );

    if (!telegram.ok) {
      return jsonResponse({ ok: false, error: telegram.error }, 401);
    }

    const supabaseAdmin = ctx.supabaseAdmin;
    if (!supabaseAdmin) {
      return jsonResponse({ ok: false, error: "DATABASE_NOT_READY" }, 503);
    }

    if (action === "profile") {
      const { data, error } = await supabaseAdmin
        .from("app_table_email_profiles")
        .select("email")
        .eq("telegram_id", telegram.telegramId)
        .maybeSingle();

      if (error) {
        console.error("TABLE_EMAIL_PROFILE_READ", error);
        return jsonResponse({
          ok: false,
          error: databaseNotReady(error) ? "DATABASE_NOT_READY" : "DATABASE_ERROR",
        }, 503);
      }

      return jsonResponse({
        ok: true,
        hasEmail: Boolean(data?.email),
        maskedEmail: data?.email ? maskEmail(data.email) : "",
      });
    }

    const materialUrl = normalizeGoogleSheetUrl(body.materialUrl);
    if (!materialUrl) {
      return jsonResponse({ ok: false, error: "INVALID_TABLE_URL" }, 400);
    }

    const materialTitle = normalizeTitle(body.materialTitle);
    const materialKind = normalizeKind(body.materialKind);

    let email = normalizeEmail(body.email);
    if (email && !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "INVALID_EMAIL" }, 400);
    }

    if (!email) {
      const { data, error } = await supabaseAdmin
        .from("app_table_email_profiles")
        .select("email")
        .eq("telegram_id", telegram.telegramId)
        .maybeSingle();

      if (error) {
        console.error("TABLE_EMAIL_PROFILE_LOOKUP", error);
        return jsonResponse({
          ok: false,
          error: databaseNotReady(error) ? "DATABASE_NOT_READY" : "DATABASE_ERROR",
        }, 503);
      }
      email = normalizeEmail(data?.email);
    }

    if (!isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "EMAIL_REQUIRED" }, 400);
    }

    const now = Date.now();
    try {
      const lastMinute = await countRecentSends(
        supabaseAdmin,
        telegram.telegramId,
        new Date(now - 60 * 1000).toISOString(),
      );
      if (lastMinute >= MINUTE_LIMIT) {
        return jsonResponse({ ok: false, error: "RATE_LIMIT_MINUTE" }, 429);
      }

      const lastDay = await countRecentSends(
        supabaseAdmin,
        telegram.telegramId,
        new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      );
      if (lastDay >= DAILY_LIMIT) {
        return jsonResponse({ ok: false, error: "RATE_LIMIT_DAY" }, 429);
      }
    } catch (error) {
      console.error("TABLE_EMAIL_RATE_LIMIT", error);
      return jsonResponse({
        ok: false,
        error: databaseNotReady(error) ? "DATABASE_NOT_READY" : "DATABASE_ERROR",
      }, 503);
    }

    const { error: profileError } = await supabaseAdmin
      .from("app_table_email_profiles")
      .upsert({
        telegram_id: telegram.telegramId,
        email,
        first_name: telegram.user.firstName,
        last_name: telegram.user.lastName,
        username: telegram.user.username,
        email_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "telegram_id" });

    if (profileError) {
      console.error("TABLE_EMAIL_PROFILE_UPSERT", profileError);
      return jsonResponse({
        ok: false,
        error: databaseNotReady(profileError) ? "DATABASE_NOT_READY" : "DATABASE_ERROR",
      }, 503);
    }

    const { data: sendRow, error: sendInsertError } = await supabaseAdmin
      .from("app_table_email_sends")
      .insert({
        telegram_id: telegram.telegramId,
        email,
        material_title: materialTitle,
        material_kind: materialKind,
        material_url: materialUrl,
        status: "pending",
      })
      .select("id")
      .single();

    if (sendInsertError) {
      console.error("TABLE_EMAIL_LOG_INSERT", sendInsertError);
      return jsonResponse({
        ok: false,
        error: databaseNotReady(sendInsertError) ? "DATABASE_NOT_READY" : "DATABASE_ERROR",
      }, 503);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const emailFrom = Deno.env.get("EMAIL_FROM") || "";
    if (!resendApiKey || !emailFrom) {
      await supabaseAdmin
        .from("app_table_email_sends")
        .update({ status: "failed", error_message: "EMAIL_SERVICE_NOT_CONFIGURED" })
        .eq("id", sendRow.id);

      return jsonResponse({ ok: false, error: "EMAIL_SERVICE_NOT_CONFIGURED" }, 503);
    }

    let providerResponse: Response;
    let providerBody: Record<string, unknown> = {};

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        providerResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [email],
            subject: `Таблица «${materialTitle}» — АРХИТЕКТУРА`,
            html: emailHtml({ title: materialTitle, url: materialUrl }),
            text: emailText({ title: materialTitle, url: materialUrl }),
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      try {
        providerBody = await providerResponse.json() as Record<string, unknown>;
      } catch (_error) {
        providerBody = {};
      }
    } catch (error) {
      console.error("TABLE_EMAIL_RESEND_NETWORK", error);
      await supabaseAdmin
        .from("app_table_email_sends")
        .update({
          status: "failed",
          error_message: String(
            error instanceof Error ? error.message : "RESEND_NETWORK_ERROR",
          ).slice(0, 500),
        })
        .eq("id", sendRow.id);

      return jsonResponse({ ok: false, error: "EMAIL_SEND_FAILED" }, 502);
    }

    if (!providerResponse.ok || !providerBody.id) {
      const providerError = String(
        providerBody.message || providerBody.name || `RESEND_HTTP_${providerResponse.status}`,
      ).slice(0, 500);

      console.error("TABLE_EMAIL_RESEND_REJECTED", providerResponse.status, providerError);
      await supabaseAdmin
        .from("app_table_email_sends")
        .update({ status: "failed", error_message: providerError })
        .eq("id", sendRow.id);

      return jsonResponse({ ok: false, error: "EMAIL_SEND_FAILED" }, 502);
    }

    const { error: sendUpdateError } = await supabaseAdmin
      .from("app_table_email_sends")
      .update({
        status: "sent",
        provider_message_id: String(providerBody.id),
        sent_at: new Date().toISOString(),
      })
      .eq("id", sendRow.id);

    if (sendUpdateError) {
      console.error("TABLE_EMAIL_LOG_UPDATE", sendUpdateError);
    }

    return jsonResponse({
      ok: true,
      maskedEmail: maskEmail(email),
      messageId: String(providerBody.id),
    });
  }),
};
