# AI support

Disabled by default for every bot. Uses its existing WhatsApp connection, so the
owner's phone need not be online. It does not train on or scrape historical chats.

In a private chat, the linked owner or permanent platform administrator can use:

- `.aisupport facts TEXT`: save approved public business information (maximum 12,000 characters).
- `.aisupport on`: enable after configuring facts and a provider key.
- `.aisupport off`: disable and cancel pending replies.
- `.aisupport status`: show configuration status without exposing secrets or facts.
- `.aisupport forget`: clear all temporary conversation memory and consent.

Use your configured command prefix. Add `GEMINI_API_KEY` privately to `config.env`;
optionally set `AI_SUPPORT_MODEL` (default `gemini-2.5-flash`). Never send a key in
WhatsApp. Restart after changing environment variables. Gemini usage may be billed.
API documentation: https://ai.google.dev/api/generate-content

Customers receive an automated-support disclosure identifying Google Gemini.
`SUPPORT START` consents to processing subsequent support questions;
`SUPPORT STOP` or `HUMAN` stops AI responses. HUMAN directs customers to contact
the owner; it does not claim to open a ticket or notify an administrator.
Each private chat has separate RAM-only memory of the last four exchanges,
expires after 30 minutes of inactivity, and is forgotten on restart. Human account
replies clear context and pause support for 30 minutes. Groups, status, media and
old/replayed messages are excluded. No customer message history is saved to disk.

There are at most 100 remembered chats, two simultaneous requests, one request
per chat per five seconds, and 200 attempts per UTC day per process. The daily
counter resets on restart; use provider billing limits for a durable spending cap.
Requests time out after 15 seconds. No orders, wallet actions, external tools or
payment approval permissions are given to the model. Key-pattern filtering is
best effort: customers must still avoid sharing secrets. Approved facts should
include the business's human contact details and current policies.

When enabled, AI support replaces legacy private-chat Lydia/sales auto-replies;
explicit product commands, filters and group functions remain available.
Availability depends on the VPS connection and the configured AI provider.
