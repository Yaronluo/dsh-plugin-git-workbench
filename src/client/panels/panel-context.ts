import { createContext } from 'react'

/** Forms reuse their content in a native sidebar without an overlay or focus trap. */
export const GitPanelContext = createContext(false)
