from __future__ import annotations

import logging
from typing import Iterator

import openai
from app.schemas import AgentConfigOut

_log = logging.getLogger(__name__)


class LLMService:
    def __init__(self, config: AgentConfigOut, api_key: str | None = None):
        self.config = config
        self.api_key = api_key
        self.client: openai.Client | None = None
        self._setup_client()

    def _setup_client(self) -> None:
        if self.config.provider != "rule_based" and self.api_key:
            try:
                self.client = openai.Client(
                    base_url=self.config.base_url,
                    api_key=self.api_key,
                    timeout=30.0,
                    max_retries=1,
                )
            except Exception as e:
                _log.warning("Failed to initialize OpenAI client: %s", e)

    def is_configured(self) -> bool:
        return self.client is not None

    def _chat(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 500,
        stream: bool = False,
    ) -> str | Iterator[str]:
        if not self.client:
            raise ValueError("LLM not configured")

        try:
            response = self.client.chat.completions.create(
                model=self.config.model,
                messages=messages,
                temperature=self.config.temperature,
                max_tokens=max_tokens,
                stream=stream,
            )
            if stream:
                return self._stream_generator(response)
            return response.choices[0].message.content.strip()
        except Exception as e:
            _log.error("LLM Error: %s", e)
            raise ValueError(f"LLM invocation failed: {str(e)}") from e

    def _stream_generator(self, response) -> Iterator[str]:
        try:
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            _log.error("Stream Error: %s", e)
            yield f"\n[Error: {str(e)}]"

    def summarize(self, text: str, stream: bool = False) -> str | Iterator[str]:
        messages = [
            {
                "role": "system",
                "content": "你是 MercuryDesk 的邮件助手。请用简体中文在 120 字以内总结用户提供的内容，保留关键信息，避免冗余。",
            },
            {"role": "user", "content": text},
        ]
        return self._chat(messages, max_tokens=220, stream=stream)

    def draft_reply(
        self, text: str, tone: str = "friendly", stream: bool = False
    ) -> str | Iterator[str]:
        tone_zh = "友好" if tone in {"friendly", "casual"} else "正式"
        messages = [
            {
                "role": "system",
                "content": f"你是 MercuryDesk 的邮件助手。请用简体中文生成一封“{tone_zh}”语气的回复草稿，简洁清晰，可直接发送。",
            },
            {"role": "user", "content": text},
        ]
        return self._chat(messages, max_tokens=360, stream=stream)
