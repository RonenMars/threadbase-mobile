/**
 * Opens a sealed socket carrying its one-time ticket, in a browser.
 *
 * A browser `WebSocket` cannot set `X-TB-Ticket`, so the ticket is offered as a
 * second subprotocol and the server selects `threadbase-e2ee-v1`. The offer
 * order is part of the wire contract. The ticket never goes in the URL, and
 * there is no `?key=` fallback: a server that cannot read the offer refuses the
 * upgrade.
 */
export const E2EE_WS_PROTOCOL = 'threadbase-e2ee-v1'
const TICKET_PROTOCOL_PREFIX = 'tb-ticket.'

export function openTicketedSocket(url: string, ticket: string): WebSocket {
  const socket = new WebSocket(url, [E2EE_WS_PROTOCOL, `${TICKET_PROTOCOL_PREFIX}${ticket}`])
  // A browser's default is `'blob'`, and a sealed socket accepts only bytes it
  // can unseal synchronously. Configured here rather than widening what
  // `ws-client` accepts.
  socket.binaryType = 'arraybuffer'
  return socket
}

/**
 * A browser opens a socket whose server selected no subprotocol at all, so an
 * `onopen` alone does not prove the server took the ticket path. Anything other
 * than `threadbase-e2ee-v1` here is a server this build must not talk to.
 */
export function ticketedSocketProtocolOk(socket: WebSocket): boolean {
  return socket.protocol === E2EE_WS_PROTOCOL
}
