#!/usr/bin/env python3
"""Minimal stdio MCP server exposing a profile-scoped notify_user tool."""
import json
import os
import sys
import urllib.error
import urllib.request

NOTIFY_URL = os.environ.get("PWA_NOTIFY_URL", "http://pwa:3000/internal/notify")
NOTIFY_TOKEN = os.environ.get("PWA_NOTIFY_TOKEN", "")
TARGET_SUBJECT = os.environ.get("TARGET_SUBJECT", "")

TOOL_DEF = {
    "name": "notify_user",
    "description": (
        "Send a push notification directly to this user's subscribed PWA devices "
        "(phone/desktop). Use for scheduled reminders, briefings, or important "
        "follow-ups when the user is not actively watching the chat."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Short notification title (max 80 chars).",
            },
            "body": {
                "type": "string",
                "description": "Concise notification body (max 300 chars).",
            },
        },
        "required": ["title", "body"],
    },
}


def send_push(title: str, body: str) -> str:
    if not NOTIFY_TOKEN or not TARGET_SUBJECT:
        return "Push notifications are not configured for this profile."
    payload = json.dumps({
        "subject": TARGET_SUBJECT,
        "title": title.strip()[:120],
        "body": body.strip()[:500],
        "url": "/",
        "tag": "assist-alert",
    }).encode("utf-8")
    req = urllib.request.Request(
        NOTIFY_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {NOTIFY_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            sent = data.get("sent", 0)
            if sent > 0:
                return f"Push notification delivered to {sent} device(s)."
            return "No subscribed devices found for this user yet (they can enable push in Assist)."
    except urllib.error.HTTPError as exc:
        return f"Push notification failed (HTTP {exc.code})."
    except Exception as exc:
        return f"Push notification failed: {type(exc).__name__}."


def respond(req_id, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": req_id}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


for raw_line in sys.stdin:
    line = raw_line.strip()
    if not line:
        continue
    try:
        req = json.loads(line)
    except json.JSONDecodeError:
        continue
    method = req.get("method")
    req_id = req.get("id")
    if method == "initialize":
        respond(req_id, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "pwa-notify", "version": "1.0.0"},
        })
    elif method == "notifications/initialized":
        continue
    elif method == "tools/list":
        respond(req_id, {"tools": [TOOL_DEF]})
    elif method == "tools/call":
        params = req.get("params") or {}
        if params.get("name") != "notify_user":
            respond(req_id, {"content": [{"type": "text", "text": "Unknown tool."}], "isError": True})
            continue
        args = params.get("arguments") or {}
        title = str(args.get("title") or "").strip()
        body = str(args.get("body") or "").strip()
        if not title or not body:
            respond(req_id, {"content": [{"type": "text", "text": "Both title and body are required."}], "isError": True})
            continue
        text = send_push(title, body)
        respond(req_id, {"content": [{"type": "text", "text": text}]})
    elif req_id is not None:
        respond(req_id, error={"code": -32601, "message": f"Method not found: {method}"})
