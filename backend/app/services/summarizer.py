from __future__ import annotations

import re


class RuleBasedSummarizer:
    def summarize(self, text: str) -> str:
        cleaned = re.sub(r"\s+", " ", text or "").strip()
        if not cleaned:
            return ""
        if len(cleaned) <= 160:
            return cleaned
        return f"{cleaned[:157]}..."

    def draft_reply(self, text: str, tone: str = "friendly") -> str:
        summary = self.summarize(text)
        if tone.lower() in {"formal", "professional"}:
            return (
                "您好，\n\n"
                f"已收到您的信息：{summary}\n\n"
                "我会尽快处理并回复。谢谢。\n"
            )
        return (
            "你好！\n\n"
            f"我看到了你的消息：{summary}\n\n"
            "我稍后给你一个更完整的回复。\n"
        )

