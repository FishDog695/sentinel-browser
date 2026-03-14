import { session } from 'electron'
import { parse } from 'tldts'
import type { CookieEvent } from '../shared/ipcEvents'

export function isFirstParty(cookieDomain: string, pageUrl: string): boolean {
  try {
    const pageParsed = parse(pageUrl, { allowPrivateDomains: false })
    const clean = cookieDomain.replace(/^./, '')
    const cookieParsed = parse(clean, { allowPrivateDomains: false })
    return pageParsed.domain === cookieParsed.domain
  } catch { return false }
}

export function electronCookieToEvent(cookie: Electron.Cookie, pageUrl: string): CookieEvent {
  const size = Buffer.byteLength(cookie.name + '=' + cookie.value, 'utf8')
  return {
    id: cookie.name + '@' + (cookie.domain ?? ''),
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? '',
    path: cookie.path ?? '/',
    secure: cookie.secure ?? false,
    httpOnly: cookie.httpOnly ?? false,
    sameSite: cookie.sameSite as CookieEvent['sameSite'],
    expirationDate: cookie.expirationDate,
    firstParty: isFirstParty(cookie.domain ?? '', pageUrl),
    session: cookie.session ?? true,
    size
  }
}

export async function getSnapshotForUrl(pageUrl: string): Promise<CookieEvent[]> {
  const ses = session.defaultSession
  const cookies = await ses.cookies.get({ url: pageUrl })
  return cookies.map(c => electronCookieToEvent(c, pageUrl))
}