type HackatimeStatsResponse = {
  data?: {
    projects?: {
      id?: string;
      name?: string;
      total_seconds?: number;
      hours?: number;
      minutes?: number;
    }[];
  };
};

async function makeHackatimeRequest(uri: string) {
  const token = process.env.HACKATIME_API_TOKEN;
  if (!token) {
    throw new Error("Missing HACKATIME_API_TOKEN");
  }

  const rackAttackBypass = process.env.HACKATIME_RACK_ATTACK_BYPASS_TOKEN;

  const response = await fetch(uri, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rackAttackBypass ? { "Rack-Attack-Bypass": rackAttackBypass } : {}),
    },
    // Keep this dynamic; stats can change quickly.
    cache: "no-store",
  });
  return response;
}

// the user id here is most likely always going to be the user's slack id
export async function fetchHackatimeProjectHoursByName(
  hackatimeUserId: string,
): Promise<Record<string, { hours: number; minutes: number }>> {
  const uri = `https://hackatime.hackclub.com/api/v1/users/${hackatimeUserId}/stats?features=projects`;

  try {
    const response = await makeHackatimeRequest(uri);
    if (!response.ok) return {};

    const raw = (await response.json()) as HackatimeStatsResponse;
    const projects = raw.data?.projects ?? [];

    const out: Record<string, { hours: number; minutes: number }> = {};
    for (const p of projects) {
      const name = (p.name ?? "").trim();
      if (!name) continue;

      const hours =
        typeof p.hours === "number" && Number.isFinite(p.hours) ? p.hours : undefined;
      const minutes =
        typeof p.minutes === "number" && Number.isFinite(p.minutes) ? p.minutes : undefined;

      if (hours !== undefined && minutes !== undefined) {
        out[name] = {
          hours: Math.max(0, Math.floor(hours)),
          minutes: Math.max(0, Math.floor(minutes)),
        };
        continue;
      }

      const seconds = typeof p.total_seconds === "number" ? p.total_seconds : 0;
      const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      const totalMinutes = Math.floor(safeSeconds / 60);

      out[name] = {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
      };
    }
    return out;
  } catch {
    // Hackatime is an enhancement; don't break pages if it's down/misconfigured.
    return {};
  }
}

export async function fetchHackatimeProjectNames(
  hackatimeUserId: string,
): Promise<string[]> {
  const uri = `https://hackatime.hackclub.com/api/v1/users/${hackatimeUserId}/stats?features=projects`;

  const response = await makeHackatimeRequest(uri);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Hackatime request failed (${response.status} ${response.statusText})${body ? `: ${body}` : ""}`,
    );
  }

  const raw = (await response.json()) as HackatimeStatsResponse;
  const projects = raw.data?.projects ?? [];

  const names = new Set<string>();
  for (const p of projects) {
    const name = (p.name ?? "").trim();
    if (name) names.add(name);
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}