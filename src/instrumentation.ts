export function register() {
  // Only execute self-ping in the node.js server runtime, not edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (Render Free tier sleeps after 15 minutes of inactivity)
    const SELF_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://demo-bank-3h7t.onrender.com/';

    console.log(`[Self-Ping] Activated. Target URL: ${SELF_URL}`);

    // Wait 1 minute before first ping to let build/startup finish smoothly
    setTimeout(() => {
      pingSelf(SELF_URL);
      
      setInterval(() => {
        pingSelf(SELF_URL);
      }, PING_INTERVAL);
    }, 60000);
  }
}

async function pingSelf(url: string) {
  try {
    console.log(`[Self-Ping] Pinging ${url} to keep server awake...`);
    const res = await fetch(url);
    console.log(`[Self-Ping] Response Status: ${res.status}`);
  } catch (err: any) {
    console.error(`[Self-Ping] Error pinging target:`, err.message);
  }
}
