import { NextResponse } from 'next/server';

// ── Constants ──────────────────────────────────────
const TIMEOUT_MS = 30_000; // 30 seconds hard limit

const SYSTEM_PROMPT = `You are an AI medical assistant called MediBot.
1. ALWAYS respond with crisp, clear, and concise answers (under 60 words).
2. Avoid generic pleasantries if the user is already in conversation.
3. Use plain text (no markdown, no bullets).
4. Maintain conversational context from the history.
5. End with a very brief disclaimer to consult a real human doctor ONLY if providing medical advice.
6. The user is using a voice interface, so keep responses conversational and natural to be spoken aloud.`;

// ── POST Handler ───────────────────────────────────
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const incomingMessages = body.messages || [];

    // ── Input Validation ───────────────────────────
    if (!incomingMessages || incomingMessages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided." },
        { status: 400 }
      );
    }

    const latestMessage = incomingMessages[incomingMessages.length - 1].content?.trim();
    if (!latestMessage || latestMessage.length < 3) {
      return NextResponse.json(
        { response: "Please describe your symptoms more clearly." }
      );
    }

    // ── Build Messages ─────────────────────────────
    // Prepend the strict system prompt to the user's conversation history
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...incomingMessages
    ];

    // ── Debug Logging ──────────────────────────────
    console.log(`[MediBot] Request — history length: ${incomingMessages.length}, latest query: "${latestMessage.slice(0, 80)}"`);

    // ── Fetch with Hard Timeout ────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let openRouterRes: Response;
    try {
      openRouterRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "http://localhost:3000",
            "X-Title": "MediBot Voice UI",
          },
          body: JSON.stringify({
            models: [
              "arcee-ai/trinity-large-preview:free",
              "stepfun/step-3.5-flash:free"
            ],
            route: "fallback",
            messages,
            max_tokens: 150,
            temperature: 0.3,
          }),
          signal: controller.signal,
        }
      );
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        console.error(`[MediBot] Timeout after ${TIMEOUT_MS / 1000}s`);
        return NextResponse.json(
          { error: "AI is taking too long. Please try again." },
          { status: 504 }
        );
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    // ── Handle Non-OK Responses ────────────────────
    if (!openRouterRes.ok) {
      const errBody = await openRouterRes.text().catch(() => "unknown");
      console.error(`[MediBot] OpenRouter ${openRouterRes.status}: ${errBody.slice(0, 300)}`);
      return NextResponse.json(
        { error: "AI service returned an error. Please try again." },
        { status: 502 }
      );
    }

    // ── Parse Response ─────────────────────────────
    const data = await openRouterRes.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.warn("[MediBot] Empty content from OpenRouter:", JSON.stringify(data).slice(0, 300));
      return NextResponse.json({
        response: "⚠️ Unable to generate response. Please try again.",
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[MediBot] Success — ${elapsed}ms, ${content.length} chars`);

    return NextResponse.json({ response: content });

  } catch (error: any) {
    console.error("[MediBot] Unhandled error:", error?.message || error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
