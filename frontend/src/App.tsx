import SignInPanel from './auth/SignInPanel.tsx'
import LogoutControl from './auth/LogoutControl.tsx'

function App() {
  return (
    <main>
      <h1>Hello world!</h1>
      <p>Welcome to Local Markets.</p>
      <LogoutControl />
      <SignInPanel />
    </main>
  )
}

export default App
