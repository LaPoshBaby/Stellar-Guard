import axios from "axios";

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY ?? "";
const FCM_TOPIC = process.env.FCM_TOPIC ?? "freeze_alerts";

export async function sendFreezeProposalNotification(
  assetCode: string,
  target: string
): Promise<void> {
  if (!FCM_SERVER_KEY) return; // FCM not configured — skip silently

  await axios.post(
    "https://fcm.googleapis.com/fcm/send",
    {
      to: `/topics/${FCM_TOPIC}`,
      notification: {
        title: "⚡ New Freeze Proposal",
        body: `Asset: ${assetCode} — Target: ${target.slice(0, 12)}…`,
      },
      data: { assetCode, target },
    },
    {
      headers: {
        Authorization: `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
}
