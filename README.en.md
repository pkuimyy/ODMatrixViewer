# ODMatrix Viewer

[中文](./README.md)

ODMatrix Viewer is a Vite-based front-end tool for visualizing OD matrix data from CSV files as a grid heatmap over a custom base map.

It is designed for quick inspection of traffic flows, simulation outputs, logistics patterns, or movement behavior. The current implementation runs entirely in the browser and does not require a backend service.

## Features

- Import CSV datasets and parse them in batches inside a Web Worker.
- Import a PNG / JPG base map and overlay the heatmap on top of it.
- View a single hourly slice or switch to a full-day 24-hour aggregate.
- Toggle Origin and Destination layers independently.
- Filter by trip-reason categories and color cells by the dominant category.
- Pan, zoom, hover, and inspect grid-based spatial patterns.
- Double-click to focus on a single grid cell.
- Hold Shift and drag to focus on an area and inspect related flows.
- Adjust map extent and grid resolution.
- Edit trip-reason mapping rules in the settings page and persist them in LocalStorage.

## Tech Stack

- Vite 8
- Vanilla JavaScript ES Modules
- HTML Canvas 2D
- Web Worker
- Prettier

## Project Structure

```text
.
├─ index.html                # Main viewer page
├─ settings.html             # Advanced configuration page
├─ src/
│  ├─ main.js                # App entry
│  ├─ settings.js            # Settings page logic
│  ├─ state.js               # Global state and subscriptions
│  ├─ config/reasons.json    # Default trip-reason mapping
│  ├─ core/
│  │  ├─ data-pipeline.js    # CSV pipeline and Worker messaging
│  │  └─ parser.worker.js    # Chunked file parser
│  ├─ render/
│  │  ├─ aggregator.js       # Grid aggregation logic
│  │  ├─ color-utils.js      # Heatmap color calculation
│  │  └─ heatmap.js          # Canvas renderer
│  ├─ ui/
│  │  ├─ sidebar.js          # Sidebar interactions
│  │  └─ viewport.js         # Zoom, pan, and selection interactions
│  └─ utils/math.js          # Camera and coordinate helpers
└─ vite.config.js            # Multi-page build config
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the dev server

```bash
npm run dev
```

### 3. Build for production

```bash
npm run build
```

### 4. Preview the production build

```bash
npm run preview
```

## How to Use

### Main Viewer

1. Click `Load CSV Dataset` to import OD data.
2. Optionally click `Import Base Map (PNG/JPG)` to load a background image.
3. Use the left sidebar to adjust:
   - `Base Map Opacity`
   - `Heatmap Opacity`
   - `Map Size (Tiles)`
   - `Grid Resolution`, displayed in `u`, with an approximate conversion of `1u = 8m`
   - `Time Slice`
   - `Show All Day (24h)`
4. Use the right sidebar to toggle:
   - `Origin (O)` / `Destination (D)`
   - Individual trip-reason categories

### Viewport Interaction

- Mouse wheel: zoom
- Left drag: pan
- Double-click a cell: focus a single grid cell
- `Esc`: clear focused cell or focused area
- `Shift + drag`: create an area selection

### Advanced Settings

Open `settings.html`, or use the top-right navigation link in the main page, to edit the trip-reason mapping JSON.

Configuration behavior:

- Default values come from `src/config/reasons.json`
- User edits are stored in browser `LocalStorage`
- Changes only affect the current browser environment
- Restoring defaults clears local overrides and falls back to the built-in mapping

## CSV Data Requirements

The current parser reads CSV using fixed column positions and skips the first row as a header.

### Minimum Requirements

- The file must be a plain text CSV file.
- The first row is treated as a header and skipped.
- Each row must contain at least 9 columns.
- Complex CSV features such as quoted fields containing commas are not supported because parsing is based on a simple `split(',')`.

### Used Column Indexes

The parser currently reads these column positions:

| Column Index | Meaning |
| --- | --- |
| 1 | Time value, expected in `0.0 ~ 1.0`, mapped to `0 ~ 23` hours |
| 3 | Raw trip-reason value used for category matching |
| 5 | Origin X |
| 6 | Origin Y / Z |
| 7 | Destination X |
| 8 | Destination Y / Z |

All other columns are ignored.

### Time Mapping Rule

The parser converts time using:

```text
hour = floor(timeValue * 24) % 24
```

### Trip-Reason Mapping Rule

- Raw values are converted to lowercase strings.
- Matching is evaluated in the current configuration order.
- Numeric and text exact matches are supported.
- Text containment matches are also supported.
- If no match is found, the parser falls back to the last configured category.

## Rendering and Aggregation

- Records are aggregated into a regular grid.
- Origin and Destination counts can be included independently.
- When a single grid cell is focused, the view shows flows associated with that cell.
- When an area is focused, the view shows distributions related to that selected region.
- Cell color is determined by the dominant trip-reason category.
- Cell opacity is normalized by total volume using the 95th percentile of active cells.

## Default Category Configuration

Default category rules are defined in `src/config/reasons.json`. The current built-in categories include:

- Work / Education
- Home / Resident
- Commercial / Leisure
- Industry / Logistics
- Public Services / Emergency
- Public Transit
- Any additional fallback categories defined in the JSON

The actual number of visible categories depends on the current JSON configuration.

## Known Constraints

- The app is browser-only and does not provide backend storage or collaboration features.
- The CSV parser is intentionally lightweight and does not support advanced CSV escaping.
- Base maps are imported manually and do not include georeferencing workflows.
- Spatial coordinates use the app's internal world coordinate system, not GIS latitude/longitude.
- Trip-reason configuration is stored locally in the browser and is not synced back to the repository.

## Development Notes

### Formatting

```bash
npm run format
```

### Multi-page Build

The Vite configuration builds two entry pages:

- `index.html`
- `help.html`
- `settings.html`

Both are emitted into `dist/` during production build.

## Typical Use Cases

- Visualizing citizen or vehicle flows from city simulations
- Fast spatial analysis of traffic OD datasets
- Comparing the spatial footprint of different trip reasons
- Exploring localized interactions over a custom base map

## License

This project is released under the MIT License.

- See `LICENSE` for the full license text
- You may use, modify, distribute, and use it commercially
- Redistributions must retain the original copyright notice and license text
