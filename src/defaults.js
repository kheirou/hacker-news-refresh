// Shared by content.js and the popup. on=false is the one-click "original HN design".
// Slider limits [min, max, step]; also used to clamp numbers imported from a backup file.
const LIMITS = { size: [12, 22, 1], line: [1.2, 2, 0.1], width: [600, 1400, 20] }
const settingsChanged = changes => Object.keys(changes).some(k => k in DEFAULTS)

// Table columns: [key, heading, menu name]. 'site' has no heading: it is the domain shown inside the link cell.
const COLUMN_DEFS = [
  ['rank', '', 'Rank'], ['points', 'Score', 'Score'], ['title', 'Story', 'Story'], ['site', null, 'Domain'],
  ['by', 'By', 'Author'], ['age', 'Posted', 'Posted'], ['comments', 'Comments', 'Comments'],
]

const DEFAULTS = {
  on: true, theme: 'light', font: 'sans', size: 16, width: 1060, line: 1.4, justify: false,
  fade: true, hoverIcons: false, fixedHeader: true, newTab: false, autoDark: false, smoothing: true, boldTitle: false, controlPad: true,
  view: 'table', columns: ['rank', 'points', 'title', 'site', 'age', 'comments'],
}
