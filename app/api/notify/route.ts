import { NextResponse } from "next/server";
import { sendFeishuNotification } from "@/lib/notify";

export async function POST() {
  try {
    const success = await sendFeishuNotification(
      "测试通知",
      "这是一条来自 HR数字助手 的测试通知。\n如果您看到此消息，说明飞书通知配置正确。",
      "blue"
    );
    if (!success) {
      return NextResponse.json(
        { error: "通知发送失败，请检查 Webhook 地址是否正确" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "通知发送失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
