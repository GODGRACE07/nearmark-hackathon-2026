import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AppShell } from './components/Chrome';

const Landing = lazy(() => import('./pages/Landing'));
const Overview = lazy(() => import('./pages/Overview'));
const Inspector = lazy(() => import('./pages/Inspector'));
const Counterparty = lazy(() => import('./pages/Counterparty'));
const Lab = lazy(() => import('./pages/Lab'));
const Benchmarks = lazy(() => import('./pages/Benchmarks'));
const Developers = lazy(() => import('./pages/Developers'));
const Methodology = lazy(() => import('./pages/Methodology'));
const Passport = lazy(() => import('./pages/Passport'));

function PageLoader() { return <div className="page-loader"><span className="loader-orbit"/><span>Loading Nearmark</span></div>; }
function ConsolePage({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <AppShell><AnimatePresence mode="wait"><motion.div key={location.pathname} className="route-page" initial={{opacity:0,y:10,filter:'blur(5px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} exit={{opacity:0,y:-6,filter:'blur(4px)'}} transition={{duration:.28,ease:[.22,1,.36,1]}}>{children}</motion.div></AnimatePresence></AppShell>;
}

export function App() {
  return <Suspense fallback={<PageLoader/>}><Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/app" element={<ConsolePage><Overview/></ConsolePage>}/>
    <Route path="/inspect" element={<ConsolePage><Inspector/></ConsolePage>}/>
    <Route path="/counterparty" element={<ConsolePage><Counterparty/></ConsolePage>}/>
    <Route path="/lab" element={<ConsolePage><Lab/></ConsolePage>}/>
    <Route path="/benchmarks" element={<ConsolePage><Benchmarks/></ConsolePage>}/>
    <Route path="/developers" element={<ConsolePage><Developers/></ConsolePage>}/>
    <Route path="/methodology" element={<ConsolePage><Methodology/></ConsolePage>}/>
    <Route path="/passport/:account" element={<ConsolePage><Passport/></ConsolePage>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense>;
}
