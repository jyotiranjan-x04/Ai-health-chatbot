/**
 * API client for the MediBot chat endpoint.
 * Returns { response: string } on success, or { error: string } on failure.
 */
export async function consultDoctor(
  messages: { role: "user" | "bot"; content: string }[]
): Promise<{ response?: string; error?: string }> {
  try {
    // Map the internal "bot" role to "assistant" for the backend
    const mappedMessages = messages.map(msg => ({
      role: msg.role === "bot" ? "assistant" : msg.role,
      content: msg.content
    }));

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: mappedMessages }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        error: data.error || "AI service returned an error. Please try again.",
      };
    }

    return data;
  } catch (error) {
    console.error("[MediBot] Network error:", error);
    return { error: "Network error. Please check your connection." };
  }
}
