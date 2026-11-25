# Sakina AI Worker (server-side scaffold)

This Worker is the private server-side bridge between the static Sakina app and the OpenAI Responses API. The browser never receives the provider API key.

## Required server configuration

Set these values in the Worker environment:

- Secret `OPENAI_API_KEY`: an API key managed by the adult responsible for deploying the service.
- Secret `SAKINA_ACCESS_TOKEN`: a separate, long random access token used by the app to authenticate to this Worker. Do not reuse the OpenAI key.
- Variable `ALLOWED_ORIGINS`: exact allowed origins, comma-separated. For example, include the deployed web-app origin and the Capacitor Android origin used by your build. Do not use `*`.

Optional variable:

- `OPENAI_MODEL`: model identifier enabled for the API project. The included default is `gpt-5.5`; change it only to a model available to the API project.

Deploy from the repository root with Wrangler after configuring the secrets and allowed origins. The deployment URL ends in `.workers.dev`; enter that URL in Sakina's AI connection settings. Enter the separate `SAKINA_ACCESS_TOKEN` in the app when connecting. The app keeps this access token in memory only; it is not saved to localStorage or committed.

## Privacy and safety design

- The Worker uses the Responses API with `store: false`.
- It accepts only bounded user/assistant text messages, rejects oversized payloads, and has no database or transcript storage.
- CORS is restricted to the exact configured origins and requests require the separate access token.
- The app requires an explicit per-session consent toggle before sending conversation text to the AI provider.
- Sending excerpts from other conversations is a second, separate opt-in and is off by default.
- A shared access token is not a substitute for user accounts or production abuse controls. Before public deployment, add per-user authentication and server-side rate limits. Keep the Worker private to the intended user(s).
- API requests may incur usage charges and are handled under the provider's current data policies. The adult account owner should review those policies and manage any billing before enabling the service.

This repository does not contain a real API key, access token, deployed endpoint, or live connection. Do not add secrets to GitHub, HTML, app assets, or the Android package.
