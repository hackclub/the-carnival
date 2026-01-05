const HACKATIME_API_TOKEN = process.env.HACKATIME_API_TOKEN!;
const HACKATIME_RACK_ATTACK_BYPASS_TOKEN = process.env.HACKATIME_RACK_ATTACK_BYPASS_TOKEN!;

async function makeHackatimeRequest(uri: string) {
    const response = await fetch(uri, {
        headers: {
            'Authorization': `Bearer ${HACKATIME_API_TOKEN}`,
            // 'Rack-Attack-Bypass': HACKATIME_RACK_ATTACK_BYPASS_TOKEN || '',
        }
    });
    return response;
}

// the user id here is most likely always going to be the user's slack id
export async function fetchHackatimeProjects(hackatimeUserId: string) {
    const uri = `https://hackatime.hackclub.com/api/v1/users/${hackatimeUserId}/stats?features=projects`;
    const response = await makeHackatimeRequest(uri);
    if (!response.ok) {
        throw new Error(`Failed to fetch Hackatime projects: ${response.statusText}`);
    }
    const data = await response.json();

    return (data as { data: { projects: { id: string; name: string; }[] } }).data.projects;
}