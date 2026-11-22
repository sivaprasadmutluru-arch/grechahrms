function namePart(value) {
  if (typeof value !== 'string') return ''
  const text = value.trim()
  return /\p{L}/u.test(text) && !text.includes('@') ? text : ''
}

export function getProfileDisplayName(user, fallback = 'User') {
  const fullName = [namePart(user?.firstName), namePart(user?.lastName)].filter(Boolean).join(' ')
  return fullName || namePart(user?.fullName) || namePart(user?.name) || fallback
}
