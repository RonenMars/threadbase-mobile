/**
 * Opens a sealed socket carrying its one-time ticket. Native: the
 * `X-TB-Ticket` header React Native's `WebSocket` accepts as a third argument.
 *
 * Metro resolves `ticketed-socket.web.ts` for the web bundle, where a browser
 * cannot set upgrade headers and the ticket rides as a subprotocol instead.
 */
type HeaderWebSocketConstructor = {
  new (
    uri: string,
    protocols?: string | string[] | null,
    options?: { headers: Record<string, string> } | null,
  ): WebSocket
}

export function openTicketedSocket(url: string, ticket: string): WebSocket {
  const HeaderWebSocket = WebSocket as HeaderWebSocketConstructor
  return new HeaderWebSocket(url, null, { headers: { 'X-TB-Ticket': ticket } })
}

/** The header path negotiates no subprotocol, so there is nothing to verify. */
export function ticketedSocketProtocolOk(_socket: WebSocket): boolean {
  return true
}
