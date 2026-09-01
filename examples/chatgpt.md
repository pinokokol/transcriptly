# ChatGPT developer mode

ChatGPT reaches a local stdio MCP server through [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). Create a tunnel in Platform settings, then run:

```sh
export CONTROL_PLANE_API_KEY="sk-..."

tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile transcriptly \
  --tunnel-id tunnel_0123456789abcdef0123456789abcdef \
  --mcp-command "npx -y transcriptly mcp"

tunnel-client doctor --profile transcriptly --explain
tunnel-client run --profile transcriptly
```

In ChatGPT, enable developer mode under **Settings → Security and login**. Create a developer-mode plugin, choose **Tunnel** for the connection, and select the same tunnel.
