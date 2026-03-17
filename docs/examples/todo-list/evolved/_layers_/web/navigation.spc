# Navigation

## Bottom Toolbar

The toolbar is a fixed-position bar at the bottom of the viewport.
The toolbar uses CSS flexbox with `justify-content: space-around`.
On viewports wider than 768px, the toolbar moves to a left sidebar.

Icons use inline SVG with a consistent 24x24 viewBox.

## Screen Transitions

Screen transitions use CSS transitions with a 200ms ease-out fade.
The browser back button and keyboard navigation are fully supported.
The app uses hash-based routing (`#/tasks`, `#/lists`, `#/settings`).
