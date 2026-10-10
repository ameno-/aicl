# Runner sandbox image: the stock Sandbox Agent image plus a pinned Codex
# release. The stock image ships Codex 0.116.0, which ChatGPT accounts reject
# ("requires a newer version of Codex"). Installing at build time keeps the
# harness version in config and avoids a per-sandbox install.
FROM rivetdev/sandbox-agent:0.5.0-rc.2-full
ARG CODEX_VERSION=rust-v0.162.1
RUN sandbox-agent install-agent codex --reinstall --agent-version ${CODEX_VERSION}
