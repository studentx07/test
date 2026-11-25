# Sakina AI Worker (Cloudflare Workers AI)

This Worker is the private server-side bridge between the Sakina app and Cloudflare Workers AI. The browser never receives a provider API key.

## Required server configuration

Set these values in the Worker environment:

- Binding `AI`: Cloudflare Workers AI binding (the Wrangler configuration declares it).
- Secret `SAKINA_ACCESS_TOKEN`: a separate, long random access token used by the app to authenticate to this Worker. Keep it private and do not reuse another credential.
- Variable `ALLOWED_ORIGINS`: exact allowed origins, comma-separated. Include the deployed web-app origin and the Capacitor Android origin used by your build. Do not use `*`.

No OpenAI API key or OpenAI billing is required.

The Worker uses model `@cf/google/gemma-4-26b-a4b-it`, which Cloudflare lists as available on the Workers Free plan. Workers AI Free currently includes 10,000 Neurons per day; requests can fail after the free allocation is exhausted. Do not upgrade to a paid plan or enable paid billing just to keep this project running.

Deploy from the repository root with Wrangler after configuring the secret and allowed origins. The deployment URL ends in `.workers.dev`; enter that URL in Sakina's AI connection settings. Enter the separate `SAKINA_ACCESS_TOKEN` in the app when connecting. The app keeps this access token in memory only; it is not saved to localStorage or committed.

## Privacy and safety design

- Uses the Cloudflare Workers AI binding; no provider API key is placed in the browser or repository.
- Sends `store: false` with model requests.
- Accepts only bounded user/assistant text messages, rejects oversized payloads, and has no transcript database or storage.
- CORS is restricted to exact configured origins and requests require the separate access token.
- The app requires explicit per-session consent before sending conversation text to the AI provider.
- Sending excerpts from other conversations is a second, separate opt-in and is off by default.
- A shared access token is not a substitute for user accounts or production abuse controls. Keep the Worker private to intended users and add server-side rate limits before public deployment.
- Conversations are sent to Cloudflare to generate replies. Review Cloudflare's current AI data-use terms and usage limits with the account owner.

This repository does not contain an access token or any other secret. Do not add secrets to GitHub, HTML, app assets, or the Android package.
