import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Icon } from "@iconify/react";

createRoot(document.getElementById("root")).render(<App />)

function App() {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const debounceRef = useRef()

  const onResult = useEffectEvent((res) => setResult(res))

  useEffect(() => {
    const cancel = window.SC?.onResult?.(onResult)
    return () => cancel()
  }, [])

  const debouncedSearch = useCallback((value) => {
    clearTimeout(debounceRef.current)
    if (value) {
      debounceRef.current = setTimeout(() => {
        window.SC.search({ type: 'search', text: value })
      }, 150)
    } else {
      window.SC.search({ type: 'clear' })
    }
  }, [])

  const handleInput = (e) => {
    const value = e.target.value
    setText(value)
    if (!value) {
      clearTimeout(debounceRef.current)
      setResult(null)
    }
    debouncedSearch(value)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      window.SC.search(e.shiftKey ? { type: 'prev' } : { type: 'next' })
    } else if (e.key === 'Escape') {
      if (text) {
        setText('')
        setResult(null)
        window.SC.search({ type: 'clear' })
      } else {
        window.SC.search({ type: 'stop' })
      }
    }
  }

  return (
    <div id="container">
      <input autoFocus placeholder="页面内搜索" value={text} onInput={handleInput} onKeyDown={handleKey} />
      <div className="buttons">
        <button onClick={() => window.SC.search({ type: 'prev' })}>
          <Icon icon="material-symbols:arrow-upward" />
        </button>
        <button onClick={() => window.SC.search({ type: 'next' })}>
          <Icon icon="material-symbols:arrow-downward" />
        </button>
      </div>
      <span className="indicator">
        {result != null && result.totalMatches > 0
          ? `${result.activeMatch}/${result.totalMatches}`
          : '-/-'}
      </span>
    </div>
  )
}
