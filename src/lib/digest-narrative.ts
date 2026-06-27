import Anthropic from "@anthropic-ai/sdk";
import type { DigestData } from "@/lib/digest";

/**
 * Generate a short, group-wide "sports news" recap of the day from the
 * computed digest data. Uses Claude Haiku. Returns a fallback string if the
 * API key is missing or the call fails — the structured digest is still saved.
 */
export async function generateNarrative(
  tournamentName: string,
  data: DigestData
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackNarrative(data);
  }

  const client = new Anthropic();

  const summary = buildPromptContext(tournamentName, data);

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system:
        "You are a witty sports columnist writing a short daily recap for a friendly tennis " +
        "bracket pool. Write 2-4 sentences in the style of a sports news blurb. Be specific: " +
        "name the leader, notable movers, big upsets and who called them, and what's at stake. " +
        "Keep it punchy and fun, not flowery. Refer to participants by their usernames. " +
        "Do not use markdown, headers, or bullet points — just prose.",
      messages: [
        {
          role: "user",
          content: `Here is today's data for the ${tournamentName} bracket pool. Write the recap.\n\n${summary}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    if (text && text.type === "text" && text.text.trim()) {
      return text.text.trim();
    }
    return fallbackNarrative(data);
  } catch {
    return fallbackNarrative(data);
  }
}

function buildPromptContext(tournamentName: string, data: DigestData): string {
  const lines: string[] = [];

  lines.push("STANDINGS (rank. username — score, change since yesterday):");
  for (const s of data.standings) {
    const delta =
      s.scoreDelta > 0 ? `+${s.scoreDelta} today` : "no change today";
    const rankMove =
      s.rankChange > 0
        ? `, up ${s.rankChange}`
        : s.rankChange < 0
        ? `, down ${-s.rankChange}`
        : "";
    lines.push(
      `${s.rank}. ${s.username} — ${s.score} pts (${delta}${rankMove}); max possible ${s.maxPossibleScore}${
        s.stillInContention ? "" : " — eliminated from winning"
      }`
    );
  }

  if (data.playerOfTheDay) {
    lines.push(
      `\nBIGGEST GAINER: ${data.playerOfTheDay.username} (+${data.playerOfTheDay.scoreDelta})`
    );
  }

  lines.push(`\nMATCHES COMPLETED TODAY: ${data.matchesCompletedToday}`);

  if (data.notableUpsets.length > 0) {
    lines.push("\nNOTABLE UPSETS TODAY:");
    for (const u of data.notableUpsets) {
      const calledBy =
        u.calledBy.length > 0 ? `called by ${u.calledBy.join(", ")}` : "nobody called it";
      lines.push(
        `- ${u.winnerName} (seed ${u.winnerSeed ?? "unseeded"}) beat ${u.loserName} (seed ${u.loserSeed ?? "unseeded"}); ${calledBy}`
      );
    }
  }

  if (data.criticalPlayers.length > 0) {
    lines.push("\nKEY PLAYERS STILL ALIVE (points riding on them across the pool):");
    for (const c of data.criticalPlayers) {
      lines.push(
        `- ${c.name} (${c.gender === "MENS" ? "M" : "W"}): ${c.pointsRiding} pts riding, ${c.backers} backer(s)`
      );
    }
  }

  return lines.join("\n");
}

function fallbackNarrative(data: DigestData): string {
  const leader = data.standings[0];
  if (!leader) return "No standings yet — the bracket pool is just getting started.";

  const parts: string[] = [];
  parts.push(`${leader.username} leads the pool with ${leader.score} points.`);

  if (data.playerOfTheDay) {
    parts.push(
      `${data.playerOfTheDay.username} had the best day, adding ${data.playerOfTheDay.scoreDelta} points.`
    );
  }

  if (data.notableUpsets.length > 0) {
    const u = data.notableUpsets[0];
    const caller =
      u.calledBy.length > 0
        ? `${u.calledBy.join(" and ")} called it`
        : "nobody saw it coming";
    parts.push(`Biggest shock: ${u.winnerName} took down ${u.loserName} — ${caller}.`);
  }

  return parts.join(" ");
}
