// Vercel Routing Middleware: HTTP Basic Auth in front of the hosted web export.
// Not part of the app bundle — Metro never imports it.
// eslint-disable-next-line i18next/no-literal-string -- HTTP protocol text, not UI copy
const UNAUTHORIZED = 'Authentication required'

export default function middleware(request) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASSWORD
  const header = request.headers.get('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')

  // Fail closed: unset credentials must never mean an open site.
  if (user && pass && scheme === 'Basic' && encoded && atob(encoded) === `${user}:${pass}`) {
    return
  }

  return new Response(UNAUTHORIZED, {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Threadbase", charset="UTF-8"' },
  })
}
