import { useState, useEffect, useRef } from 'react'
import init, { parse_schema, calculate_all_layouts, reorder_fields, simulate_layout, suggest_optimal_order, export_schema } from 'wasm-core'
import { Visualizer } from './Visualizer'
import { FieldNode } from './FieldNode'
import { HexDump } from './HexDump'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import './App.css'

function App() {
  const [wasmLoaded, setWasmLoaded] = useState(false)
  const [schemaTree, setSchemaTree] = useState<any>(null)
  const [activeStructIdx, setActiveStructIdx] = useState<number>(0)
  const [layouts, setLayouts] = useState<any[] | null>(null)
  const [simulationMode, setSimulationMode] = useState(false)
  const [simulationDiff, setSimulationDiff] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    init().then(() => setWasmLoaded(true)).catch(e => setError(e.toString()))
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSchemaTree(null)

    try {
      const text = await file.text()
      const parsed = parse_schema(text)
      setSchemaTree(parsed)
      setActiveStructIdx(0)

      const calc_layouts = calculate_all_layouts(parsed)
      setLayouts(calc_layouts)
    } catch (err: any) {
      setError(err.toString())
      console.error(err)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && schemaTree) {
      const activeDef = schemaTree.structs[activeStructIdx];
      const oldIndex = activeDef.fields.findIndex((f: any) => `field-${f.id}` === active.id);
      const newIndex = activeDef.fields.findIndex((f: any) => `field-${f.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Compute new numerical mapping
        const currentOrder = activeDef.fields.map((_: any, i: number) => i);
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex);

        try {
          const numberArray = newOrder.map(Number); // Ensure numbers
          const uintOrder = new Uint32Array(numberArray);

          if (simulationMode) {
            const diff = simulate_layout(activeDef, uintOrder);
            setSimulationDiff(diff);
            // Reorder fields just for the UI tree to reflect the drag visually during simulation
            const updatedStruct = reorder_fields(activeDef, uintOrder);
            const newSchemaTree = { ...schemaTree };
            newSchemaTree.structs[activeStructIdx] = updatedStruct;
            setSchemaTree(newSchemaTree);
          } else {
            // Real mutation mode
            const updatedStruct = reorder_fields(activeDef, uintOrder);

            // Re-hydrate full schema tree
            const newSchemaTree = { ...schemaTree };
            newSchemaTree.structs[activeStructIdx] = updatedStruct;
            setSchemaTree(newSchemaTree);

            // Update layouts
            const calc_layouts = calculate_all_layouts(newSchemaTree);
            setLayouts(calc_layouts);
          }
        } catch (err: any) {
          setError(`Wasm Reorder Error: ${err.toString()}`);
        }
      }
    }
  };

  const handleSuggestOptimal = () => {
    if (!schemaTree) return;
    try {
      setSimulationMode(true);
      const activeDef = schemaTree.structs[activeStructIdx];
      const optimalArray = suggest_optimal_order(activeDef);

      const diff = simulate_layout(activeDef, optimalArray);
      setSimulationDiff(diff);

      const updatedStruct = reorder_fields(activeDef, optimalArray);
      const newSchemaTree = { ...schemaTree };
      newSchemaTree.structs[activeStructIdx] = updatedStruct;
      setSchemaTree(newSchemaTree);
    } catch (err: any) {
      setError(`Optimization Error: ${err.toString()}`);
    }
  };

  const applySimulation = () => {
    if (!simulationDiff || !schemaTree) return;
    try {
      const calc_layouts = calculate_all_layouts(schemaTree);
      setLayouts(calc_layouts);
      setSimulationMode(false);
      setSimulationDiff(null);
    } catch (err: any) {
      setError(err.toString());
    }
  }

  const handleExport = () => {
    if (!schemaTree) return;
    try {
      const exportedText = export_schema(schemaTree);

      const blob = new Blob([exportedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'optimized.capnp';
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Export Error: ${err.toString()}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 w-full max-w-7xl mx-auto flex flex-col items-center">
      <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
        Cap'n Console
      </h1>
      <p className="mb-8 text-slate-400">Interactive Memory Layout Optimizer</p>

      {!wasmLoaded && !error && <p className="animate-pulse">Loading Wasm Engine...</p>}
      {error && <div className="bg-red-900/50 text-red-200 p-4 rounded mb-4 border border-red-500">{error}</div>}

      {wasmLoaded && (
        <div className="w-full flex justify-center mb-8">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 transition-colors px-6 py-3 rounded-lg shadow-lg font-medium">
            Upload .capnp File
            <input type="file" ref={fileInputRef} accept=".capnp" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {schemaTree && layouts && layouts.length > 0 && (
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Sidebar - Field Tree */}
          <div className="col-span-1 bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-xl">
            <h2 className="text-xl font-bold text-emerald-400 mb-4 text-center">Field Order</h2>
            <p className="text-xs text-slate-400 mb-4 text-center">Drag to reorder fields & optimize padding.</p>

            {schemaTree.structs.length > 1 && (
              <select
                title="Select Struct"
                className="w-full mb-4 p-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200"
                value={activeStructIdx}
                onChange={(e) => setActiveStructIdx(parseInt(e.target.value))}
              >
                {schemaTree.structs.map((s: any, idx: number) => (
                  <option key={idx} value={idx}>{s.name}</option>
                ))}
              </select>
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={schemaTree.structs[activeStructIdx].fields.map((f: any) => `field-${f.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1">
                  {schemaTree.structs[activeStructIdx].fields.map((field: any) => (
                    <FieldNode key={`field-${field.id}`} id={`field-${field.id}`} field={field} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Main Content - Visualizers */}
          <div className={`col-span-1 ${simulationMode ? 'lg:col-span-2 grid grid-cols-2 gap-4' : 'lg:col-span-2'} space-y-6`}>

            {!simulationMode ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-semibold text-emerald-400">Current Layout View</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleExport}
                      className="bg-emerald-600 hover:bg-emerald-500 transition-colors px-4 py-2 rounded text-sm font-medium shadow"
                    >
                      Export .capnp
                    </button>
                    <button
                      onClick={() => setSimulationMode(true)}
                      className="bg-purple-600 hover:bg-purple-500 transition-colors px-4 py-2 rounded text-sm font-medium shadow"
                    >
                      Enter Simulation Mode
                    </button>
                  </div>
                </div>
                <Visualizer layout={layouts[activeStructIdx]} />
              </div>
            ) : (
              <>
                <div className="space-y-4 col-span-2">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-semibold text-purple-400 animate-pulse">Simulation Zone Active</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSuggestOptimal}
                        className="bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 rounded text-sm font-medium shadow"
                      >
                        Auto-Optimize Order
                      </button>
                      <button
                        onClick={() => {
                          setSimulationMode(false)
                          setSimulationDiff(null)
                          // Force a total refresh from original
                          if (fileInputRef.current && fileInputRef.current.files) {
                            fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                          }
                        }}
                        className="bg-slate-600 hover:bg-slate-500 transition-colors px-4 py-2 rounded text-sm font-medium shadow"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  {simulationDiff && (
                    <div className="bg-slate-800 p-4 rounded-lg flex justify-between items-center border border-purple-500 shadow-purple-500/20 shadow-lg">
                      <span className="text-xl font-bold">Predicted Savings:</span>
                      <span className={`text-2xl font-mono ${simulationDiff.bytes_saved > 0 ? 'text-emerald-400' : simulationDiff.bytes_saved < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                        {simulationDiff.bytes_saved > 0 ? '+' : ''}{simulationDiff.bytes_saved} bytes
                      </span>
                      {simulationDiff.bytes_saved > 0 && (
                        <button
                          onClick={applySimulation}
                          className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2 rounded font-bold transition-colors"
                        >
                          Apply Changes
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-1 border-r border-slate-700 pr-2 pb-4">
                  <h3 className="text-lg font-bold text-slate-400 mb-2">Original Target</h3>
                  <Visualizer layout={simulationDiff ? simulationDiff.original_layout : layouts[activeStructIdx]} />
                </div>


                <div className="col-span-1 pl-2 pb-4">
                  <h3 className="text-lg font-bold text-purple-400 mb-2">Simulation Result</h3>
                  <Visualizer layout={simulationDiff ? simulationDiff.simulated_layout : layouts[activeStructIdx]} />
                </div>
              </>
            )}

            {/* Hex Dump Panel */}
            <div className="pt-8 w-full col-span-1 lg:col-span-2">
              <HexDump layout={simulationMode && simulationDiff ? simulationDiff.simulated_layout : layouts[activeStructIdx]} />
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default App
