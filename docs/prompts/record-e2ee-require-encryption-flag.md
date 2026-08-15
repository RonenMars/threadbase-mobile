# Requirement — per-server “Require encryption” control

**Related design:** `tb-streamer/specs/end-to-end-encryption/mobile-design.md` §6

Each server record must have a per-server **Require encryption** boolean.
It is an anti-downgrade control, not a capability indicator.

## Required behaviour

- Store the flag beside the server record in SecureStore, never AsyncStorage.
- Surface it in `components/servers/ServerEditModal.tsx` as “Require encryption for this server”.
- Set it automatically after the first successful encrypted connection, and keep it set.
- Allow a user to set it before their first connection.
- Require a plain-language confirmation before turning it off after it has been set.

| Require encryption | Server offers E2EE | Behaviour |
| --- | --- | --- |
| On | Yes | Connect with encryption. |
| On | No | Refuse the connection and explain why. |
| Off | Yes | Connect with encryption, then set the flag on. |
| Off | No | Connect without encryption. |

Do not provide a “connect anyway” path when encryption is required.

## Security boundary

This prevents a downgrade after encryption has been required; it does not authenticate a hostile server.
An attacker who repoints the app at another server can satisfy this flag with that server's encryption.
The QR-carried static public key is the complementary control that authenticates the server.
