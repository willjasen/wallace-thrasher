export default async function dailyDeploy() {
  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

  if (!buildHookUrl) {
    throw new Error('NETLIFY_BUILD_HOOK_URL is not configured.');
  }

  const response = await fetch(buildHookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: '{}'
  });

  if (!response.ok) {
    throw new Error(`Daily deploy trigger failed with HTTP ${response.status}.`);
  }
}

export const config = {
  schedule: '0 8 * * *'
};
