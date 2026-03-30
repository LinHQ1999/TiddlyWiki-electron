import Alpine from 'alpinejs'
import 'iconify-icon'

Alpine.data('searchApp', () => ({
  text: '',
  result: null,
  debounceTimer: null,

  get indicatorText() {
    return this.result?.totalMatches > 0
      ? `${this.result.activeMatch}/${this.result.totalMatches}`
      : '-/-'
  },

  init() {
    this.cancelResult = window.SC?.onResult?.(res => this.result = res)
  },

  destroy() {
    this.cancelResult?.()
  },

  handleInput() {
    clearTimeout(this.debounceTimer)
    if (!this.text) {
      this.result = null
      window.SC.search({ type: 'clear' })
    } else {
      this.debounceTimer = setTimeout(() => {
        window.SC.search({ type: 'search', text: this.text })
      }, 150)
    }
  },

  handleKey(e) {
    if (e.key === 'Enter') {
      window.SC.search(e.shiftKey ? { type: 'prev' } : { type: 'next' })
    } else if (e.key === 'Escape') {
      if (this.text) {
        this.text = ''
        this.result = null
        window.SC.search({ type: 'clear' })
      } else {
        window.SC.search({ type: 'stop' })
      }
    }
  },

  searchPrev: () => window.SC.search({ type: 'prev' }),
  searchNext: () => window.SC.search({ type: 'next' })
}))

Alpine.start()
