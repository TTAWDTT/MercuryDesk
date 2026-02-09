from __future__ import annotations

import logging
import json
from typing import Iterator, Any

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

    def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict] | None = None,
        tool_executor: Any = None,
    ) -> Iterator[str]:
        if not self.client:
            yield "Agent not configured."
            return

        # 1. First Call
        try:
            response = self.client.chat.completions.create(
                model=self.config.model,
                messages=messages,
                temperature=self.config.temperature,
                stream=True,
                tools=tools if tools else None,
            )
        except Exception as e:
            yield f"Error: {str(e)}"
            return

        # Buffer for tool calls (since they stream in chunks)
        tool_calls = []
        current_tool_call = None

        # We need to accumulate text to yield it,
        # but if it's a tool call, we accumulate that instead.
        for chunk in response:
            delta = chunk.choices[0].delta if chunk.choices else None
            if not delta:
                continue

            # Text content
            if delta.content:
                yield delta.content

            # Tool calls
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.index is not None:
                        # New tool call or switching index
                        if len(tool_calls) <= tc.index:
                            tool_calls.append({"id": "", "function": {"name": "", "arguments": ""}, "type": "function"})
                        current_tool_call = tool_calls[tc.index]

                    if tc.id:
                        current_tool_call["id"] += tc.id
                    if tc.function.name:
                        current_tool_call["function"]["name"] += tc.function.name
                    if tc.function.arguments:
                        current_tool_call["function"]["arguments"] += tc.function.arguments

        # 2. Check if we have tool calls to execute
        if tool_calls and tool_executor:
            # Append assistant's tool_call message to history
            # Convert tool_calls dicts to appropriate format if needed, but the structure matches
            messages.append({
                "role": "assistant",
                "tool_calls": tool_calls
            })

            # Execute each tool
            for tc in tool_calls:
                func_name = tc["function"]["name"]
                args_str = tc["function"]["arguments"]

                # Notify frontend we are executing
                yield f"\n\n> ⚙️ Executing: {func_name}...\n\n"

                # Execute
                result_content = tool_executor.execute(func_name, args_str)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": str(result_content)
                })

            # 3. Second Call (with tool results)
            try:
                response2 = self.client.chat.completions.create(
                    model=self.config.model,
                    messages=messages,
                    temperature=self.config.temperature,
                    stream=True,
                )
                for chunk in response2:
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            except Exception as e:
                yield f"Error calling tool response: {str(e)}"

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
