import { lazy, Suspense } from 'react';
import { useAuth } from './auth/AuthContext';
import { AuthScreen } from './auth/AuthScreen';
import './App.css';

// The editor pulls in Monaco and Yjs, which is most of the bundle. Loading it
// only after sign-in keeps the sign-in screen quick.
const EditorScreen = lazy(() => import('./EditorScreen'));

function App() {
  const { token, logout } = useAuth();

  if (!token) return <AuthScreen />;

  return (
    <Suspense fallback={<p className="editor-status">Loading the editor...</p>}>
      <EditorScreen token={token} onSignOut={logout} />
    </Suspense>
  );
}

export default App;
