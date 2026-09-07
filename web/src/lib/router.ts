// Маршруты страниц по #hash: работает и на github.io/arena/, и как файл, и на своём сервере.
// Страницы: #/join — вход, #/app — зритель, #/screen — экран на сцену, #/admin — пульт.
import { useEffect, useState } from 'react'

export type Route = 'join' | 'app' | 'screen' | 'admin'

export const paths: Record<Route, string> = {
  join: '#/join',
  app: '#/app',
  screen: '#/screen',
  admin: '#/admin',
}

function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/$/, '')
  switch (path) {
    case 'app':
      return 'app'
    case 'screen':
      return 'screen'
    case 'admin':
      return 'admin'
    default:
      return 'join'
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(route: Route) {
  location.hash = paths[route]
}

// Полная ссылка на страницу входа — для QR-кода
export function joinUrl(): string {
  return `${location.origin}${location.pathname}${paths.join}`
}
