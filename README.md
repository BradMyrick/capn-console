# Cap'n Console

Cap'n Console is a web-based Cap'n Proto message layout visualizer and optimizer. It allows developers to upload a `.capnp` schema, visualize its memory layout, identify padding inefficiencies, and reorder fields to optimize the packed size.

## Features

- **Schema Parsing:** Parses standard `.capnp` schema syntax completely within the browser using WebAssembly.
- **Visual Memory Layout:** (WIP) Renders struct definitions as byte blocks, clearly showing padding and alignment.
- **Interactive Editing:** (WIP) Drag-and-drop fields to instantly see the impact on memory packing efficiency.
- **Export Schema:** (WIP) Download the reordered schema to use directly in your projects.

## Architecture

This project is a monorepo consisting of two parts:
- **`wasm-core`**: A Rust crate built with `wasm-bindgen` to perform fast parsing and byte layout calculations.
- **`web-ui`**: A React App built with Vite and Tailwind CSS for rapid prototyping and rendering.

## Setup & Development

### Prerequisites
- Node.js (v18+)
- Rust & Cargo
- `wasm-pack` (`cargo install wasm-pack`)

### Building and Running

1. **Build the Wasm Core:**
   ```bash
   cd wasm-core
   wasm-pack build --target web
   ```

2. **Run the React Frontend:**
   ```bash
   cd web-ui
   npm install
   npm run dev
   ```

## Development Progress

- [x] **Checkpoint 1: Wasm Runtime & File Parsing**
  - Setup Rust `wasm-bindgen` and Vite + React.
  - Implemented `.capnp` text parser for Struct definitions.
- [x] **Checkpoint 2: Layout Calculation & Static Visualization**
  - Wasm calculation logic for sizing, alignment, and padding tracking.
  - React HTML5 Canvas component with drag/pan and tooltip highlights.
- [x] **Checkpoint 3: Drag-and-Drop Reordering Engine**
  - Integrated `dnd-kit` for interactive reordering.
  - Implemented real-time layout recalculation in Wasm.
  - Added Packing Efficiency stats and Heatmap highlighting.
- [x] **Checkpoint 4: Simulation Mode & Predictive Analysis**
  - Built a split-screen "Simulation Zone" for non-destructive testing.
  - Added an "Auto-Optimize Order" Wasm function to sort fields by alignment impact.
- [x] **Checkpoint 5: Hex Dump & Schema Export**
  - Generated exportable `.capnp` schemas dynamically.
  - Implemented interactive hex dump with bidirectional field mapping.
- [ ] **Checkpoint 6: Polish, Testing & Deployment**
