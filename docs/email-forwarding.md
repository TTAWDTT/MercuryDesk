# MercuryDesk 邮件转发接入逻辑

本文档解释“只填邮箱地址 -> 生成专属转发地址 -> 自动收信”的工作方式。

## 1. 目标

相比 IMAP（需要主机、端口、授权码），转发接入的目标是：

- 用户只填写一个邮箱地址用于标识
- 系统生成唯一转发地址
- 用户在原邮箱里配置自动转发
- MercuryDesk 接收并入库邮件

## 2. 创建转发账号

前端调用 `POST /api/v1/accounts`，参数示例：

```json
{
  "provider": "forward",
  "identifier": "you@example.com",
  "forward_source_email": "you@example.com"
}
```

后端会为该账号生成 `inbound_secret`，并在查询时返回：

- `forward_address`：专属转发地址（例：`md-12-abc1234567@inbox.example.com`）
- `inbound_url`：统一入口（`/api/v1/inbound/forward`）

其中域名由环境变量 `MERCURYDESK_FORWARD_INBOUND_DOMAIN` 控制。

## 3. 收信入口

统一入口：`POST /api/v1/inbound/forward`

支持三类常见格式：

- `application/json`
- `application/x-www-form-urlencoded`
- `multipart/form-data`

并兼容 `raw`/`raw_email` 原始 MIME 邮件内容解析。

后端会从 `recipient/to/delivered_to/x-original-to` 等字段提取收件地址，再解析本地别名（`md-<account_id>-<signature>`）定位账号，并用 `inbound_secret` 验签。

## 4. 入库流程

定位到账号后，后端会：

1. 提取发件人、主题、正文、时间
2. 生成或复用 `external_id` 做去重
3. 写入 `messages`（`source=email`）
4. 更新联系人最后消息时间、账号最后同步时间

如果同一邮件重复投递，会被 `external_id` 去重逻辑拦截。

## 5. 旧接口兼容

仍保留 `POST /api/v1/inbound/forward/{secret}`，用于你已有的 webhook/自动化场景（可直接按 secret 投递）。

## 6. 部署注意事项

1. 配置 DNS 与邮件转发服务，让 `MERCURYDESK_FORWARD_INBOUND_DOMAIN` 能接收转发邮件。
2. 将接收服务（或网关）收到的邮件转发到 `POST /api/v1/inbound/forward`。
3. 若使用第三方 inbound provider（Mailgun/Postmark/SendGrid 等），只需将其 webhook 指向该接口，并确保 payload 含有收件地址字段或 raw MIME 内容。
