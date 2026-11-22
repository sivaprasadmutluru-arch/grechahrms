const pending = new Map()
const listeners = new Set()
let snapshot = null

export function subscribeToMutations(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getMutationLoading() {
  return snapshot
}

function publish() {
  const next = pending.values().next().value ?? null
  if (snapshot === next) return
  snapshot = next
  for (const listener of listeners) listener()
}

export function beginMutation(message) {
  const id = Symbol()
  pending.set(id, message)
  publish()
  return () => {
    if (pending.delete(id)) publish()
  }
}

const backgroundPosts = [
  /^\/auth\/login$/,
  /^\/chatbot\/ask$/,
  /^\/notifications\/(?:mark-all-read|[^/]+\/read)$/,
  /^\/carr\/(?:kpis\/suggestions|job-description\/extract)$/,
]

export function mutationMessage(config) {
  if (config.mutationLoading === false) return null
  const method = config.method?.toLowerCase()
  if (!['post', 'put', 'patch', 'delete'].includes(method)) return null
  const path = (config.url || '').split(/[?#]/, 1)[0].replace(/\/+$/, '')
  if (method === 'post' && backgroundPosts.some(pattern => pattern.test(path))) return null
  return {
    post: 'Saving…',
    put: 'Updating…',
    patch: 'Updating…',
    delete: 'Deleting…',
  }[method]
}

export function trackMutation(config, send) {
  const message = mutationMessage(config)
  if (!message) return send(config)
  const finish = beginMutation(message)
  return (async () => {
    try {
      return await send(config)
    } finally {
      finish()
    }
  })()
}
