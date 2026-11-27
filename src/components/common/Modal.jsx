import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import Spinner from './Spinner'

export default function Modal({ open, onClose, title, children, footer, size = 'md', pendingMessage }) {
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => { if (!pendingMessage) onClose() }}>
        <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
            <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <DialogPanel className={`w-full min-w-0 ${pendingMessage ? 'max-w-sm' : sizes[size]} bg-white rounded-2xl shadow-xl overflow-hidden`}>
                {pendingMessage && (
                  <div className="px-6 py-8 text-center" role="status">
                    <div aria-hidden="true"><Spinner /></div>
                    <DialogTitle className="mt-4 text-base font-semibold text-gray-900">{pendingMessage}</DialogTitle>
                    <p className="mt-1 text-sm text-gray-600">Please wait while this request completes.</p>
                  </div>
                )}
                <div hidden={!!pendingMessage}>
                  {!pendingMessage && (
                    <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 border-b border-gray-100">
                      <DialogTitle className="min-w-0 wrap-anywhere text-base font-semibold text-gray-900">{title}</DialogTitle>
                      <button onClick={onClose} aria-label="Close dialog" className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"><XMarkIcon className="h-5 w-5" /></button>
                    </div>
                  )}
                  <div className="px-4 py-4 sm:px-6">{children}</div>
                  {footer && <div className="px-4 py-4 sm:px-6 border-t border-gray-100 bg-gray-50">{footer}</div>}
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
