# Kapture Finance — Voice AI Collections Agent ("Maya")

> An intelligent, compliance-first voice AI agent for automated outbound debt collections, built for the Indian lending market.

## Overview

**Maya** is an automated outbound collections voice agent built for **Kapture Finance**. She handles the delicate process of debt recovery — professionally, empathetically, and in strict compliance with RBI Fair Practices Code.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **State-Enforced Auth** | Identity verification via `verify_customer` tool MUST succeed before any debt is disclosed. Not prompt-discretionary — enforced at the tool-call level. |
| **PTP Collection** | Negotiates Promise-to-Pay commitments, logs them via `log_promise_to_pay`, and dispatches payment links via `send_payment_link`. |
| **Compliance Guardrails** | Handles DNC opt-out, disputes, hardship claims, third-party disclosure prevention, and abusive caller protocols. |
| **Bilingual Support** | Seamlessly switches between English, Hindi, and Hinglish mid-conversation. |
| **Full Disposition Logging** | Every call ends with a `mark_disposition` tool call logging the outcome. |

### Architecture Pipeline

```
Customer ← Telephony (SIP/PSTN) ← → Vapi Engine ← → Deepgram Nova-2 (STT)
                                        ↕                    
                                   GPT-4o (LLM/Orchestrator) ← → Mock Webhook Server (Tools)
                                        ↕
                                   ElevenLabs (TTS)
```

**Target latency: < 1.2s end-to-end** (STT ~200ms → LLM ~400ms → TTS ~300ms → Network ~200ms)

---

## Project Structure

```
kapture-collections-voicebot/
├── README.md                    # This file — setup guide, design choices, debugging
├── docs/
│   └── HLD_Document.md          # Complete High-Level Design Document (9 sections)
├── vapi/
│   ├── system_prompt.txt        # Production Vapi system prompt (state machine + compliance)
│   └── tool_definitions.json    # 5 tool schemas for Vapi function calling
├── mock-server/             # Express webhook server handling Vapi tool calls
│   ├── package.json             # Node.js dependencies (express, cors, dotenv)
│   ├── server.js                # Express webhook server handling Vapi tool calls
│   └── .env.example             # Environment variables template
├── frontend/                    # Vite React Web Interface
│   ├── src/                     # React source code and Vapi Web SDK integration
│   └── package.json             # React dependencies
└── tests/
    └── test_cases.json          # 14 test scenarios covering all flows and edge cases
```

---

## Quick Start

### Prerequisites
- **Node.js v18+** installed
- **ngrok** installed (for exposing local server to Vapi)
- **Vapi account** (free tier at [vapi.ai](https://vapi.ai))

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd kapture-collections-voicebot

# 2. Install mock server dependencies
cd mock-server
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start the webhook server
npm start
# Server runs on http://localhost:3000

# 5. In a separate terminal, expose via ngrok
ngrok http 3000
# Copy the HTTPS forwarding URL (e.g., https://xxxx.ngrok-free.app)

# 6. Set up the frontend UI (in a new terminal)
cd frontend
npm run dev
# Open http://localhost:5173 to view the Maya UI!

# 7. Configure Vapi assistant (see guide below)
```

---

## Vapi Setup Guide

Follow these steps to configure the voice assistant in the Vapi Dashboard:

| Step | Action | Details |
|------|--------|---------|
| 1 | **Create Account** | Sign up at [vapi.ai](https://vapi.ai) (free tier provides trial credits) |
| 2 | **Create Assistant** | Click **Assistants** → **Create Assistant** → **Blank Template** |
| 3 | **Transcriber** | Provider: **Deepgram**, Model: `nova-2`, Language: `multi` (for EN/HI bilingual) |
| 4 | **Model** | Provider: **OpenAI**, Model: `gpt-4o`, Temperature: `0.1` |
| 5 | **Voice** | Provider: **ElevenLabs**, Voice: `Sarah` (professional female voice) |
| 6 | **First Message** | `"Hello, this is Maya calling from Kapture Finance. Am I speaking with Mr. Rahul Sharma?"` |
| 7 | **System Prompt** | Paste the full contents of `vapi/system_prompt.txt` |
| 8 | **Tools** | Add each tool from `vapi/tool_definitions.json` (5 tools total) |
| 9 | **Server URL** | Set to your ngrok URL + `/webhook` (e.g., `https://xxxx.ngrok-free.app/webhook`) |

### Tool Registration

For each tool in `tool_definitions.json`, go to the **Tools** tab in your Vapi assistant and create a new function:
1. Copy the `function.name` as the tool name
2. Copy the `function.description` as the description
3. Copy the `function.parameters` as the parameter schema
4. Set the server URL to your webhook endpoint

---

## Design Choices & Rationale

### Why GPT-4o (not GPT-4o-mini)?
Superior function calling reliability and instruction-following accuracy for compliance-critical scenarios. Temperature set to `0.1` for deterministic, predictable behavior — essential when a wrong word before auth could violate regulations.

### Why Deepgram Nova-2?
Purpose-built for 8kHz telephony audio with the lowest streaming latency of any production STT. Strong accuracy on Indian English accents and supports multilingual transcription for Hindi/Hinglish.

### Why ElevenLabs TTS?
Most natural conversational voice quality available, reducing the "robotic" feel that causes customers to hang up. Supports expressive, empathetic tone crucial for collections conversations.

### Why State-Enforced Auth (not prompt-only)?
This is the single most important design decision. Auth is enforced via the `verify_customer` tool call response — the LLM physically cannot reach the disclosure state without a `verified: true` response from the backend. Prompt-only enforcement can be jailbroken; tool-gated enforcement cannot.

### Why Express.js for the Mock Server?
Lightweight, universally understood, and fast to develop for a proof-of-concept. A production system would use NestJS or FastAPI with a proper database, authentication, and rate limiting.

---

## Debugging Notes

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **Tool calls not triggering** | Schema mismatch between Vapi config and webhook | Ensure tool parameter names in Vapi match exactly: `verification_code`, `ptp_date`, `channel`, `status` |
| **Webhook returns 500** | Missing `message.type` check | Server handles non-tool-call events (status-update, end-of-call-report) by returning `200` |
| **Auth bypass** | LLM skipping verification step | Lower temperature to 0.1, add explicit "CRITICAL" warnings in system prompt, ensure `verify_customer` tool is properly registered |
| **ngrok URL changes** | Free tier rotates URLs on restart | Update Vapi Server URL each time you restart ngrok. Consider ngrok paid tier for static URLs |
| **Hindi not transcribed** | Deepgram language set to `en-US` only | Change Deepgram language to `multi` for bilingual EN/HI transcription |
| **Tool response format error** | Vapi expects specific JSON structure | Webhook must return `{ results: [{ toolCallId, result: JSON.stringify(resultObj) }] }` — note that `result` must be a **stringified** JSON |

---

## Testing

### Evaluation Matrix
See `tests/test_cases.json` for 14 comprehensive test scenarios covering:
- Auth guardrails (no pre-auth disclosure)
- Happy path PTP flow
- Already paid / Dispute / DNC
- Wrong person / Third-party guard
- Bilingual switch / Abusive caller
- Partial payment / Callback request

### Mock Server cURL Tests

```bash
# Health check
curl http://localhost:3000/health

# Test verify_customer (valid code)
curl -X POST http://localhost:3000/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":{\"type\":\"tool-calls\",\"toolCalls\":[{\"id\":\"call-1\",\"function\":{\"name\":\"verify_customer\",\"arguments\":{\"account_id\":\"ACC-88392\",\"verification_code\":\"1234\"}}}]}}"

# Test verify_customer (invalid code)
curl -X POST http://localhost:3000/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":{\"type\":\"tool-calls\",\"toolCalls\":[{\"id\":\"call-2\",\"function\":{\"name\":\"verify_customer\",\"arguments\":{\"account_id\":\"ACC-88392\",\"verification_code\":\"9999\"}}}]}}"

# Test log_promise_to_pay
curl -X POST http://localhost:3000/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":{\"type\":\"tool-calls\",\"toolCalls\":[{\"id\":\"call-3\",\"function\":{\"name\":\"log_promise_to_pay\",\"arguments\":{\"account_id\":\"ACC-88392\",\"ptp_date\":\"2026-08-14\",\"amount\":8499}}}]}}"

# Test send_payment_link
curl -X POST http://localhost:3000/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":{\"type\":\"tool-calls\",\"toolCalls\":[{\"id\":\"call-4\",\"function\":{\"name\":\"send_payment_link\",\"arguments\":{\"account_id\":\"ACC-88392\",\"channel\":\"SMS\"}}}]}}"

# Test mark_disposition
curl -X POST http://localhost:3000/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":{\"type\":\"tool-calls\",\"toolCalls\":[{\"id\":\"call-5\",\"function\":{\"name\":\"mark_disposition\",\"arguments\":{\"account_id\":\"ACC-88392\",\"status\":\"PTP_AGREED\",\"notes\":\"Customer agreed to pay by Friday\"}}}]}}"

# Test escalate_to_agent
curl -X POST http://localhost:3000/webhook ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":{\"type\":\"tool-calls\",\"toolCalls\":[{\"id\":\"call-6\",\"function\":{\"name\":\"escalate_to_agent\",\"arguments\":{\"account_id\":\"ACC-88392\",\"reason\":\"DISPUTE\",\"notes\":\"Customer disputes amount\"}}}]}}"
```

---

## What I'd Improve with More Time

1. **Real Database** — PostgreSQL/MongoDB for disposition logging, customer records, and call history
2. **Dynamic Customer Loading** — `get_account_details` API to load customer context dynamically instead of hardcoding
3. **Real Payment Gateway** — Razorpay/PayU integration for actual payment link generation
4. **A/B Testing** — Different prompt strategies to optimize PTP conversion rates
5. **Call Analytics Pipeline** — Transcription → intent classification → quality scoring → auto-coaching
6. **Language Detection** — Auto-detect language from first few seconds and configure STT accordingly
7. **Regression Testing** — Automated evaluation framework running against recorded call transcripts
8. **Production Monitoring** — Grafana/DataDog dashboards for real-time latency, PTP rate, and compliance tracking
9. **Webhook Security** — Rate limiting, HMAC signature verification, and API key auth on webhook endpoints
10. **Supervisor Dashboard** — WebSocket-based real-time call monitoring with live transcript streaming

---

## Evaluation Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **Containment Rate** | >80% | Calls resolved without human escalation |
| **PTP Rate** | >40% | Calls ending in a valid promise-to-pay |
| **Auth Compliance** | 100% | Zero pre-auth debt disclosure violations |
| **Avg Latency** | <1.2s | End-to-end turn response time |
| **FCR** | >70% | First call resolution rate |
| **Drop Rate** | <10% | Calls dropped before disposition logged |
| **Auth Success Rate** | >85% | Successful identity verifications |


