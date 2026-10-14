// Cookie and analytics choice, shown once (bottom of the screen; full width on phones, a card bottom-right from md).
// The app keeps the answer in its own consent store; the mock shows the banner only on ?state=cookies (App.jsx).
//   onChoose(analytics: boolean)
export default function CookieBanner({ onChoose }) {
  return (
    <div role="dialog" aria-label="Cookie and analytics preferences"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-line bg-surface p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-lg md:inset-x-auto md:bottom-6 md:right-6 md:w-[400px] md:rounded-2xl md:border md:p-5">
      <p className="text-[15px] leading-5 font-semibold text-stone-900">Cookies & analytics</p>
      <p className="mt-1 text-[14px] leading-5 text-stone-600">
        Essential cookies keep you signed in. Optional analytics help improve the product. We don’t use session replay
        or capture keystrokes or form inputs.
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => onChoose(false)}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-line px-3 text-small font-medium text-stone-700 outline-none transition-colors duration-150 hover:bg-tint hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-focus md:flex-none">
          Essential only
        </button>
        <button type="button" onClick={() => onChoose(true)}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-ink px-3.5 text-small font-medium text-on-ink outline-none transition-colors duration-150 hover:bg-ink-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 md:flex-none">
          Accept analytics
        </button>
      </div>
    </div>
  )
}
