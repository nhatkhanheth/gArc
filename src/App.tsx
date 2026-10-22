import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { parseEther } from 'viem'
import { ExternalLink, CheckCircle2, AlertCircle, Loader2, Wallet } from 'lucide-react'
import { arcMainnet } from './config'
import { buildTxExplorerUrl } from '@/onchain-facts'

const ARC_CHAIN_ID = arcMainnet.id // 5042

const springs = {
  snappy: { type: 'spring', stiffness: 420, damping: 32 } as const,
  gentle: { type: 'spring', stiffness: 300, damping: 26 } as const,
}

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1.0] },
}

function formatAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const QUOTES: string[] = [
  'Every sunrise is a blank canvas. Make your mark.',
  'A new day, a new block. Begin well.',
  'The best time to start is right now.',
  'Small steps onchain, big leaps forward.',
  'Breathe in the morning light. You made it.',
  "Today's possibilities are yesterday's dreams, sent onchain.",
  'Each transaction is a quiet act of intention.',
  'Rise easy. The day belongs to you.',
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function getDailyQuote(): string {
  // Deterministic by day so it doesn't flicker on re-render
  const day = new Date().getDate()
  return QUOTES[day % QUOTES.length] ?? QUOTES[0]
}

function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) {
    return 'Transaction cancelled.'
  }
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient balance to cover gas fees.'
  }
  if (msg.includes('reverted')) {
    const m = msg.match(/reason="([^"]+)"/)
    return m ? `Transaction failed: ${m[1]}` : 'Transaction reverted. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

// Sunrise sun SVG logo
function SunLogo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="sun-rise-anim"
    >
      {/* Outer rotating rays */}
      <g className="ray-spin-anim" style={{ transformOrigin: '32px 32px' }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <line
            key={deg}
            x1="32"
            y1="6"
            x2="32"
            y2="12"
            stroke="url(#rayGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            transform={`rotate(${deg} 32 32)`}
            opacity="0.7"
          />
        ))}
      </g>
      {/* Glow halo */}
      <circle cx="32" cy="32" r="20" fill="url(#haloGrad)" opacity="0.35" />
      {/* Sun body */}
      <circle cx="32" cy="32" r="14" fill="url(#sunGrad)" />
      {/* Highlight */}
      <ellipse cx="28" cy="26" rx="4" ry="2.5" fill="rgba(255,255,255,0.35)" />
      <defs>
        <radialGradient id="sunGrad" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff176" />
          <stop offset="45%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#f48c27" />
        </radialGradient>
        <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd166" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f48c27" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rayGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff176" />
          <stop offset="100%" stopColor="#ffd166" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// Horizon divider
function Horizon() {
  return (
    <div className="w-full h-px my-1" style={{ background: 'var(--spectral)', opacity: 0.6 }} />
  )
}

export default function App() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const {
    sendTransaction,
    data: hash,
    isPending,
    error: sendError,
    reset,
  } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [txCount, setTxCount] = useState(0)
  const [time, setTime] = useState<Date>(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const greeting = getGreeting()
  const quote = getDailyQuote()
  const isWrongChain = isConnected && chainId !== ARC_CHAIN_ID
  const isBusy = isPending || isConfirming || isSwitching
  const explorerUrl = hash ? buildTxExplorerUrl(ARC_CHAIN_ID, hash) : null

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  function handleGArc() {
    if (!isConnected) return
    if (isWrongChain) {
      switchChain({ chainId: ARC_CHAIN_ID })
      return
    }
    sendTransaction(
      {
        to: address!,
        value: parseEther('0'),
        chainId: ARC_CHAIN_ID,
      },
      { onSuccess: () => setTxCount((n) => n + 1) },
    )
  }

  const buttonLabel = () => {
    if (!isConnected) return 'Connect wallet first'
    if (isSwitching) return 'Switching network…'
    if (isWrongChain) return 'Switch to Arc Mainnet'
    if (isPending) return 'Confirm in wallet…'
    if (isConfirming) return 'Confirming on Arc…'
    if (isSuccess) return 'gArc again'
    return 'gArc'
  }

  return (
    <div className="relative min-h-dvh overflow-hidden sunrise-bg flex flex-col">

      {/* === Liquid blobs === */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {/* Warm amber bloom at horizon */}
        <div
          className="blob-1 absolute"
          style={{
            top: '55%', left: '-8%',
            width: 440, height: 440,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(140,74,47,0.30) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Deep terracotta upper-right */}
        <div
          className="blob-2 absolute"
          style={{
            top: '-8%', right: '-8%',
            width: 380, height: 380,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(107,48,40,0.22) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
        {/* Antique gold glow at base */}
        <div
          className="blob-3 absolute"
          style={{
            bottom: '-8%', right: '25%',
            width: 320, height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(196,154,82,0.18) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Deep indigo vignette top */}
        <div
          className="absolute"
          style={{
            top: 0, left: 0, right: 0,
            height: '42%',
            background: 'linear-gradient(180deg, rgba(18,13,31,0.85) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* === Header === */}
      <motion.header
        {...fadeUp}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative z-20 flex items-center justify-between px-5 pt-5 pb-3"
      >
        <div className="flex items-center gap-2.5">
          <SunLogo size={32} />
          <span
            className="display text-2xl font-bold shimmer-text"
            style={{ letterSpacing: '-0.04em' }}
          >
            gArc
          </span>
        </div>
        <ConnectKitButton />
      </motion.header>

      {/* === Main === */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5">

        {/* Hero sun */}
        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springs.gentle, delay: 0.2 }}
        >
          <div className="relative pulse-ring">
            <SunLogo size={80} />
          </div>
          <div className="mt-3 flex flex-col items-center gap-2">
            <span
              className="display text-5xl font-bold shimmer-text"
              style={{ letterSpacing: '-0.05em' }}
            >
              {greeting}
            </span>
            <span
              className="text-xs font-medium tracking-widest uppercase"
              style={{ color: 'var(--subtle)', letterSpacing: '0.10em' }}
            >
              {dateStr}
            </span>
            <p
              className="text-sm text-center max-w-xs mt-1"
              style={{ color: 'var(--muted)', lineHeight: 1.6, fontStyle: 'italic' }}
            >
              "{quote}"
            </p>
          </div>
        </motion.div>

        {/* Time chip */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="px-5 py-2 rounded-full"
          style={{
            background: 'var(--glass-pill)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            color: 'var(--golden)',
          }}
        >
          <span className="mono text-lg font-semibold tabular-nums">{timeStr}</span>
        </motion.div>

        {/* Main card */}
        <motion.div
          className="w-full max-w-sm flex flex-col gap-4"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.35 }}
        >
          {/* Spectral top strip */}
          <div className="h-0.5 w-full rounded-full" style={{ background: 'var(--spectral)' }} />

          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{
              background: 'var(--glass-card)',
              backdropFilter: 'blur(28px) saturate(180%)',
              WebkitBackdropFilter: 'blur(28px) saturate(180%)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
            }}
          >
            {/* Network pill */}
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--subtle)', letterSpacing: '0.1em' }}
              >
                Arc Mainnet
              </span>
              <motion.span
                layout
                className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                style={{
                  background: 'var(--glass-inner)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--muted)',
                }}
              >
                <motion.span
                  animate={{
                    backgroundColor:
                      isConnected && !isWrongChain ? '#6fcf97' : 'rgba(200,178,140,0.42)',
                    scale: isConnected && !isWrongChain ? [1, 1.4, 1] : 1,
                  }}
                  transition={{ duration: 0.6 }}
                  className="w-1.5 h-1.5 rounded-full inline-block"
                />
                {isConnected && !isWrongChain ? 'Connected' : isWrongChain ? 'Wrong chain' : 'Not connected'}
              </motion.span>
            </div>

            <Horizon />

            {/* Tagline */}
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
                {isConnected
                  ? "You're all set. Tap the button to greet the chain."
                  : "Connect your wallet and let the chain know you're here."}
              </p>
              <p className="text-xs" style={{ color: 'var(--subtle)', lineHeight: 1.5 }}>
                One tap sends a gentle transaction on Arc Mainnet. USDC covers the gas — nothing extra needed.
              </p>
            </div>

            {/* Address row */}
            <AnimatePresence>
              {address && (
                <motion.div
                  key="addr"
                  {...fadeUp}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--glass-inner)', border: '1px solid var(--glass-border)' }}
                >
                  <Wallet size={13} style={{ color: 'var(--subtle)' }} />
                  <span className="mono text-xs" style={{ color: 'var(--muted)' }}>
                    {formatAddress(address)}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TX counter */}
            <AnimatePresence>
              {txCount > 0 && (
                <motion.div
                  key="counter"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springs.snappy}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'var(--glass-inner)', border: '1px solid var(--glass-border)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                    Transactions sent today
                  </span>
                  <motion.span
                    key={txCount}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={springs.snappy}
                    className="display text-sm font-bold tabular-nums"
                    style={{ color: 'var(--golden)' }}
                  >
                    {txCount}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CTA button */}
          <motion.button
            onClick={isSuccess ? () => { reset(); } : handleGArc}
            disabled={isBusy || !isConnected}
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: isBusy || !isConnected ? 1 : 1.015 }}
            transition={springs.snappy}
            className="relative w-full overflow-hidden flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold transition-colors duration-200"
            style={{
              background: isWrongChain
                ? 'var(--glass-pill)'
                : 'linear-gradient(135deg, #c49a52 0%, #9a6234 50%, #6b3a24 100%)',
              color: isWrongChain ? 'var(--ink)' : '#f5ede0',
              border: isWrongChain ? '1px solid var(--glass-border-strong)' : 'none',
              boxShadow: !isWrongChain && !isBusy
                ? '0 4px 28px rgba(140,74,47,0.38), 0 1px 0 rgba(255,255,255,0.12) inset'
                : 'none',
              minHeight: 56,
              backdropFilter: isWrongChain ? 'blur(12px)' : undefined,
            }}
          >
            {/* Shimmer overlay — subtle only */}
            {!isWrongChain && !isBusy && !isSuccess && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.09) 50%, transparent 62%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 4s linear infinite',
                }}
              />
            )}

            <AnimatePresence mode="wait">
              <motion.span
                key={buttonLabel()}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2"
              >
                {isBusy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                ) : (
                  <SunLogo size={20} />
                )}
                <span>{buttonLabel()}</span>
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {/* Status surfaces */}
          <AnimatePresence>
            {isWrongChain && !isBusy && (
              <motion.div key="wrong-chain" {...fadeUp}
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--glass-card)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,200,100,0.30)',
                  color: 'var(--muted)',
                }}
              >
                <AlertCircle size={15} style={{ color: 'var(--golden)', flexShrink: 0, marginTop: 1 }} />
                <span>Almost there — just one small step. Tap to switch to Arc Mainnet and you're ready.</span>
              </motion.div>
            )}

            {isSuccess && hash && explorerUrl && (
              <motion.div key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={springs.snappy}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--glass-card)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(126,241,179,0.35)',
                }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--ink-2)' }}>Day started. You're onchain.</span>
                </div>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: 'var(--golden)' }}
                >
                  View <ExternalLink size={11} />
                </a>
              </motion.div>
            )}

            {sendError && !isPending && (
              <motion.div key="error" {...fadeUp}
                className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--glass-card)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,107,122,0.35)',
                  color: 'var(--danger)',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{parseOnchainError(sendError)}</span>
              </motion.div>
            )}

            {!isConnected && (
              <motion.p key="no-wallet" {...fadeUp}
                className="text-center text-sm"
                style={{ color: 'var(--subtle)', lineHeight: 1.6 }}
              >
                Connect your wallet above and make this morning count.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* === Footer === */}
      <motion.footer
        {...fadeUp}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="relative z-10 py-5 flex flex-col items-center gap-1"
      >
        <div className="h-px w-16 rounded-full mb-2" style={{ background: 'var(--spectral)', opacity: 0.5 }} />
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          Every morning deserves a first block.
        </span>
      </motion.footer>
    </div>
  )
}
