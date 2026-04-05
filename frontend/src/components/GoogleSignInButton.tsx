import { useEffect, useRef } from 'react'

export default function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function render() {
      if (containerRef.current && window.google?.accounts?.id) {
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 280,
        })
      }
    }

    // Wait until google is initialized (initialize() must be called first in AuthContext)
    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval)
        // Small delay to ensure AuthContext's initialize() has run
        setTimeout(render, 50)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  return <div ref={containerRef} />
}
