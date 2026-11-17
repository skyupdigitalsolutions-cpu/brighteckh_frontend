import { useLocation } from 'react-router-dom';

/** "/mg" or "/a": the shell the shared MIS pages are mounted in (for links between them). */
export function useMisBase() {
  return `/${useLocation().pathname.split('/')[1]}`;
}
