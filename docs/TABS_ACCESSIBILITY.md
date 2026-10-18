# Accessible tabs and stale state

The React renderer accepts a `tabs` node with `bind`, `props.options`, and matching `tab-panel` children. Each option uses a `label` and `value`, and each panel's `props.value` matches an option value.

When the bound state contains a value that no longer matches any option (for example, after a streamed update), the renderer uses a valid `props.defaultValue`, or the first available option. This ensures that one tab remains selected and reachable with Tab, rather than leaving every tab at `tabIndex=-1`. Selecting another tab updates the bound state.

Keyboard controls: Left/Right arrows move between tabs, Home moves to the first tab, and End moves to the last tab. Supply unique option values and corresponding panels; a missing panel cannot provide content to assistive technology.
