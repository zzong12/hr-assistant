import { loadSetting } from "@/lib/storage";

let clientInstance: any = null;

async function getFeishuClient() {
  if (clientInstance) return clientInstance;

  const appId = process.env.FEISHU_APP_ID || loadSetting("feishu_app_id");
  const appSecret = process.env.FEISHU_APP_SECRET || loadSetting("feishu_app_secret");

  if (!appId || !appSecret) return null;

  try {
    const lark = await import("@larksuiteoapi/node-sdk");
    clientInstance = new lark.Client({ appId, appSecret, appType: lark.AppType.SelfBuild });
    return clientInstance;
  } catch (error) {
    console.error("[Feishu] Failed to init client:", error);
    return null;
  }
}

export async function replyFeishuMessage(messageId: string, text: string): Promise<boolean> {
  const client = await getFeishuClient();
  if (!client) return false;

  try {
    await client.im.message.reply({
      path: { message_id: messageId },
      data: {
        content: JSON.stringify({ text }),
        msg_type: "text",
      },
    });
    return true;
  } catch (error) {
    console.error("[Feishu] Reply failed:", error);
    return false;
  }
}

export async function replyFeishuCard(messageId: string, title: string, content: string, color: string = "blue"): Promise<boolean> {
  const client = await getFeishuClient();
  if (!client) return false;

  try {
    const card = {
      header: {
        title: { tag: "plain_text", content: `[小HR] ${title}` },
        template: color,
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content } },
      ],
    };

    await client.im.message.reply({
      path: { message_id: messageId },
      data: {
        content: JSON.stringify(card),
        msg_type: "interactive",
      },
    });
    return true;
  } catch (error) {
    console.error("[Feishu] Card reply failed:", error);
    return false;
  }
}

export async function sendFeishuMessage(chatId: string, text: string): Promise<boolean> {
  const client = await getFeishuClient();
  if (!client) return false;

  try {
    await client.im.message.create({
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text }),
        msg_type: "text",
      },
      params: { receive_id_type: "chat_id" },
    });
    return true;
  } catch (error) {
    console.error("[Feishu] Send message failed:", error);
    return false;
  }
}

export async function downloadFeishuFile(messageId: string, fileKey: string): Promise<Buffer | null> {
  const client = await getFeishuClient();
  if (!client) return null;

  try {
    const resp = await client.im.messageResource.get({
      path: { message_id: messageId, file_key: fileKey },
      params: { type: "file" },
    });
    if (resp?.data) {
      const chunks: Buffer[] = [];
      for await (const chunk of resp.data as any) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    return null;
  } catch (error) {
    console.error("[Feishu] Download file failed:", error);
    return null;
  }
}

export function isFeishuConfigured(): boolean {
  const appId = process.env.FEISHU_APP_ID || loadSetting("feishu_app_id");
  const appSecret = process.env.FEISHU_APP_SECRET || loadSetting("feishu_app_secret");
  return !!(appId && appSecret);
}
