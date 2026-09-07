// Корень приложения: выбирает страницу по адресу. В прототипе добавляет полоску ролей и вступление.
import { DemoBar, DemoIntro } from './components/Demo'
import { IS_DEMO } from './lib/api'
import { useRoute } from './lib/router'
import { AdminPage } from './pages/AdminPage'
import { GuestPage } from './pages/GuestPage'
import { JoinPage } from './pages/JoinPage'
import { ResultsPage } from './pages/ResultsPage'
import { ScreenPage } from './pages/ScreenPage'

export default function App() {
  const route = useRoute()

  const page = {
    join: <JoinPage />,
    app: <GuestPage />,
    screen: <ScreenPage />,
    results: <ResultsPage />,
    admin: <AdminPage />,
  }[route]

  return (
    <div className="min-h-dvh bg-bg text-text" style={IS_DEMO ? ({ '--demo-bar': '44px', paddingTop: '44px' } as React.CSSProperties) : undefined}>
      {IS_DEMO && <DemoBar route={route} />}
      {IS_DEMO && <DemoIntro />}
      {page}
    </div>
  )
}
