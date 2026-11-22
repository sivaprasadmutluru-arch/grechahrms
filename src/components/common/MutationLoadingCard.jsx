import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import Spinner from './Spinner'
import { getMutationLoading, subscribeToMutations } from '../../services/mutationLoading'

export default function MutationLoadingCard() {
  const message = useSyncExternalStore(subscribeToMutations, getMutationLoading, () => null)
  const dialogRef = useRef(null)
  const busy = message !== null

  useLayoutEffect(() => {
    if (!busy) return
    const dialog = dialogRef.current
    dialog.showModal()
    return () => { if (dialog.open) dialog.close() }
  }, [busy])

  return (
    <dialog ref={dialogRef} onCancel={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation() } }}
      aria-labelledby="mutation-loading-title"
      aria-describedby="mutation-loading-description"
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-xl backdrop:bg-black/40">
      <div role="status" aria-atomic="true">
        <div aria-hidden="true"><Spinner /></div>
        <h2 id="mutation-loading-title" className="mt-4 text-base font-semibold text-gray-900">{message}</h2>
        <p id="mutation-loading-description" className="mt-1 text-sm text-gray-600">Please wait while this request completes.</p>
      </div>
    </dialog>
  )
}
