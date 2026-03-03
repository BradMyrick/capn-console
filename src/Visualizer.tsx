import React, { useRef, useEffect, useState } from 'react';

interface FieldLayout {
    name: string;
    id: number;
    field_type: string;
    size: number;
    start_offset: number;
    end_offset: number;
    padding_bytes: number;
}

interface StructLayout {
    name: string;
    total_size: number;
    fields: FieldLayout[];
}

interface VisualizerProps {
    layout: StructLayout;
}

const COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#8b5cf6', // violet-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#eab308', // yellow-500
];

export const Visualizer: React.FC<VisualizerProps> = ({ layout }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const [hoveredField, setHoveredField] = useState<FieldLayout | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    const BYTE_WIDTH = 40;
    const HEIGHT = 60;
    const PADDING_X = 20;

    const autoFit = () => {
        if (!containerRef.current || !layout.total_size) return;
        const rect = containerRef.current.getBoundingClientRect();
        const totalWidth = layout.total_size * BYTE_WIDTH + PADDING_X * 2;

        // Calculate scale to fit width with some breathing room
        const newScale = Math.min(1.5, (rect.width * 0.9) / totalWidth);
        setScale(newScale);

        // Center vertically and set initial X offset
        setOffset({
            x: (rect.width - totalWidth * newScale) / 2,
            y: (rect.height - HEIGHT * newScale) / 2 - 20
        });
    };

    useEffect(() => {
        if (isFirstLoad && layout.total_size > 0) {
            autoFit();
            setIsFirstLoad(false);
        }
    }, [layout, isFirstLoad]);

    useEffect(() => {
        drawCanvas();
    }, [layout, scale, offset]);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => drawCanvas();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const drawCanvas = () => {
        if (!canvasRef.current || !containerRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high-DPI scaling
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // Draw grid/background limits
        const startX = 20;
        const startY = 40;

        // Draw padding and fields
        layout.fields.forEach((field, i) => {
            // Draw padding
            if (field.padding_bytes > 0) {
                // Red heatmap if padding is >= 50% of field size or >= 4 bytes waste
                const isInefficient = field.padding_bytes >= field.size * 0.5 || field.padding_bytes >= 4;
                ctx.fillStyle = isInefficient ? 'rgba(239, 68, 68, 0.7)' : '#475569'; // red-500 or slate-600

                const padX = startX + (field.start_offset - field.padding_bytes) * BYTE_WIDTH;
                ctx.fillRect(padX, startY, field.padding_bytes * BYTE_WIDTH, HEIGHT);
                ctx.strokeStyle = '#334155';
                ctx.strokeRect(padX, startY, field.padding_bytes * BYTE_WIDTH, HEIGHT);
            }

            // Draw field
            ctx.fillStyle = COLORS[i % COLORS.length];
            const fieldX = startX + field.start_offset * BYTE_WIDTH;
            ctx.fillRect(fieldX, startY, field.size * BYTE_WIDTH, HEIGHT);

            // Field stroke
            ctx.strokeStyle = '#1e293b'; // slate-800
            ctx.lineWidth = 1;
            ctx.strokeRect(fieldX, startY, field.size * BYTE_WIDTH, HEIGHT);

            // Label
            if (field.size * scale >= 1) { // Only draw text if wide enough
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px Inter, sans-serif';
                ctx.textBaseline = 'middle';
                ctx.fillText(field.name, fieldX + 4, startY + HEIGHT / 2);
            }
        });

        // Draw struct total padding at end if needed
        const lastFieldEnd = layout.fields.length > 0 ? layout.fields[layout.fields.length - 1].end_offset : 0;
        if (layout.total_size > lastFieldEnd) {
            const remainingPad = layout.total_size - lastFieldEnd;
            ctx.fillStyle = '#475569'; // slate-600
            const padX = startX + lastFieldEnd * BYTE_WIDTH;
            ctx.fillRect(padX, startY, remainingPad * BYTE_WIDTH, HEIGHT);
            ctx.strokeStyle = '#334155';
            ctx.strokeRect(padX, startY, remainingPad * BYTE_WIDTH, HEIGHT);
        }

        // Draw ruler points
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textBaseline = 'bottom';
        for (let i = 0; i <= layout.total_size; i++) {
            ctx.fillText(i.toString(), startX + i * BYTE_WIDTH, startY - 4);
            ctx.beginPath();
            ctx.moveTo(startX + i * BYTE_WIDTH, startY);
            ctx.lineTo(startX + i * BYTE_WIDTH, startY - 4);
            ctx.stroke();
        }

        ctx.restore();
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const newScale = Math.max(0.1, Math.min(5, scale - e.deltaY * zoomSensitivity));

        // Try to zoom towards mouse position
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleRatio = newScale / scale;
        setOffset({
            x: mouseX - (mouseX - offset.x) * scaleRatio,
            y: mouseY - (mouseY - offset.y) * scaleRatio,
        });
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
            return;
        }

        // Hover detection
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Transform mouse into canvas coordinates
        const startX = 20;
        const startY = 40;
        const canvasX = (mouseX - offset.x) / scale - startX;
        const canvasY = (mouseY - offset.y) / scale - startY;

        if (canvasY >= 0 && canvasY <= HEIGHT) {
            const byteHovered = canvasX / BYTE_WIDTH;
            let found = null;
            for (const field of layout.fields) {
                if (byteHovered >= (field.start_offset - field.padding_bytes) && byteHovered < field.end_offset) {
                    found = field;
                    break;
                }
            }
            setHoveredField(found);
            if (found) {
                setTooltipPos({ x: e.clientX, y: e.clientY });
            }
        } else {
            setHoveredField(null);
        }
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleMouseLeave = () => {
        setIsDragging(false);
        setHoveredField(null);
    };

    // Calculate Stats
    const usedBytes = layout.fields.reduce((acc, f) => acc + f.size, 0);
    const wastedBytes = layout.total_size - usedBytes;
    const efficiency = layout.total_size > 0 ? ((usedBytes / layout.total_size) * 100).toFixed(1) : "0";

    return (
        <div className="w-full mt-4 bg-slate-800 rounded-lg p-4 border border-slate-700 relative">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-200">Layout: {layout.name}</h3>
                    <p className="text-sm text-slate-400">Total Size: {layout.total_size} bytes (words: {Math.ceil(layout.total_size / 8)})</p>
                </div>
                <div className="flex gap-4 text-sm text-right items-center">
                    <button
                        onClick={autoFit}
                        className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-emerald-400 transition-colors title='Reset View'"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                    <div className="bg-slate-900 border border-slate-700 rounded px-3 py-1">
                        <span className="text-slate-400 block text-xs">Used Bytes</span>
                        <span className="text-emerald-400 font-mono">{usedBytes} B</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded px-3 py-1">
                        <span className="text-slate-400 block text-xs">Wasted</span>
                        <span className={`font-mono ${wastedBytes > 0 ? 'text-red-400' : 'text-slate-200'}`}>{wastedBytes} B</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded px-3 py-1">
                        <span className="text-slate-400 block text-xs">Efficiency</span>
                        <span className="text-blue-400 font-mono font-bold">{efficiency}%</span>
                    </div>
                </div>
            </div>

            <div
                ref={containerRef}
                className="w-full h-[200px] overflow-hidden rounded bg-slate-900 border border-slate-700 cursor-grab active:cursor-grabbing"
            >
                <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: '100%' }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                />
            </div>

            {hoveredField && (
                <div
                    className="fixed pointer-events-none z-50 bg-slate-900 border border-slate-600 p-3 rounded shadow-xl text-sm"
                    style={{ top: tooltipPos.y + 15, left: tooltipPos.x + 15 }}
                >
                    <p className="font-bold text-emerald-400">{hoveredField.name} <span className="text-slate-400 font-normal">@{hoveredField.id}</span></p>
                    <p>Type: <span className="text-blue-300">{hoveredField.field_type}</span></p>
                    <p>Size: {hoveredField.size} byte(s)</p>
                    <p>Offset: {hoveredField.start_offset} - {hoveredField.end_offset}</p>
                    {hoveredField.padding_bytes > 0 && (
                        <p className="text-red-400">Padding Before: {hoveredField.padding_bytes} byte(s)</p>
                    )}
                </div>
            )}
        </div>
    );
};
