import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

// The server has no viewport, so it renders the desktop layout and lets the
// client correct on hydration — same behaviour as the previous `undefined`
// initial state, minus the cascading render from setting state in an effect.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
