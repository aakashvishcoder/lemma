import { useState } from 'react'
import Editor from '@monaco-editor/react'

function App() {
  const [content, setContent] = useState('// start typing...')

  return (
    <Editor
      height="100vh"
      defaultLanguage="typescript"
      value={content}
      onChange={(value) => setContent(value ?? '')}
    />
  )
}

export default App
