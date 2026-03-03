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

    // Reset file input so same file can be uploaded again if needed
    if (e.target) {
      e.target.value = '';
    }
  }

  const handleResetSchema = () => {
    setSchemaTree(null);
    setLayouts(null);
    setSimulationMode(false);
    setSimulationDiff(null);
    setError(null);
  };

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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 w-full font-sans relative overflow-hidden">

      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto flex flex-col items-center relative z-10 w-full">

        {/* Header */}
        <div className="flex flex-col items-center mb-10 text-center w-full">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-500 bg-clip-text text-transparent drop-shadow-sm tracking-tight">
            Cap'n Console
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl">
            Interactive Memory Layout Optimizer for Cap'n Proto. Drag and drop struct fields to eliminate padding waste and calculate real-time alignment efficiency.
          </p>
          {schemaTree && (
            <button
              onClick={handleResetSchema}
              className="mt-6 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/80 text-slate-300 text-sm font-medium rounded-full border border-slate-700 transition-all flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Load Different Schema
            </button>
          )}
        </div>

        {!wasmLoaded && !error && <p className="animate-pulse mb-8 text-emerald-400 font-semibold tracking-wide">Initializing Wasm Engine...</p>}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-6 py-4 rounded-xl mb-8 w-full max-w-3xl flex items-center gap-3 shadow-lg backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Upload State */}
        {wasmLoaded && !schemaTree && (
          <div className="w-full max-w-3xl mt-8">
            <label className="group flex flex-col items-center justify-center w-full h-64 border-2 border-slate-700 border-dashed rounded-3xl cursor-pointer bg-slate-900/50 hover:bg-slate-800/60 hover:border-emerald-500/50 transition-all duration-300 backdrop-blur-sm overflow-hidden relative shadow-2xl">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 z-10 transition-transform duration-300 group-hover:scale-105">
                <svg className="w-16 h-16 mb-4 text-slate-500 group-hover:text-emerald-400 transition-colors duration-300 drop-shadow-lg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                </svg>
                <p className="mb-2 text-xl text-slate-300"><span className="font-semibold text-emerald-400">Click to upload</span> or drag and drop</p>
                <p className="text-sm text-slate-500">.capnp schema files</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
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
            <div className={`col-span-1 lg:col-span-2 flex flex-col gap-6 w-full min-w-0 order-1 lg:order-2 ${simulationMode ? 'xl:grid xl:grid-cols-2' : ''}`}>

              {!simulationMode ? (
                <div className="space-y-4 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] w-full overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent tracking-tight">Current Memory Layout</h2>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleExport}
                        className="bg-emerald-600/90 hover:bg-emerald-500 text-white transition-all px-4 py-2.5 rounded-xl text-sm font-semibold shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 border border-emerald-500/50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export .capnp
                      </button>
                      <button
                        onClick={() => setSimulationMode(true)}
                        className="bg-purple-600/90 hover:bg-purple-500 text-white transition-all px-4 py-2.5 rounded-xl text-sm font-semibold shadow-[0_0_15px_rgba(147,51,234,0.2)] hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] flex items-center gap-2 border border-purple-500/50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Simulator
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
    </div>
  )
}

export default App
