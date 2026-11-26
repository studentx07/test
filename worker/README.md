# Sakina AI Worker (Cloudflare Workers AI)

This Worker is the private server-side bridge between the Sakina app and Cloudflare Workers AI. The browser never receives a provider API key.

## Required server configuration

- Bind Cloudflare Workers AI as `AI` (declared in `wrangler.toml`).
- Store `SAKINA_ACCESS_TOKEN` as a Worker secret; never commit it.
- Set `ALLOWED_ORIGINS` to exact app origins, comma-separated. Do not use `*`.

The Worker uses `@cf/google/gemma-4-26b-a4b-it`. Workers AI free usage is subject to Cloudflare's daily Neurons allowance and model availability. No paid billing is enabled by this repository.

Deploy only after the account owner configures the secret and allowed origins. The deployment URL ends in `.workers.dev`; enter it in Sakina's AI connection settings with the separate access token.

## Privacy and safety

- Sends `store: false` with model requests.
- Accepts bounded user/assistant text and has no transcript database.
- Restricts CORS to configured origins and requires the separate access token.
- The app requires explicit consent before sending conversation text to the AI provider.
- Conversation excerpts from other chats are a separate opt-in.
- A shared access token is not a substitute for user accounts or production abuse controls. Add server-side rate limits before public deployment.
- Never put secrets in HTML, app assets, or this repository.
