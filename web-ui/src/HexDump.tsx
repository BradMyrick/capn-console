import React, { useMemo } from 'react';

interface HexDumpProps {
    layout: any;
}

export const HexDump: React.FC<HexDumpProps> = ({ layout }) => {
    // Generate fake hex data based on the layout structure to simulate a binary blob
    const { hexLines, byteToFieldMap } = useMemo(() => {
        const bytes = Array(Math.max(64, layout.total_size)).fill(0);
        const map = new Map<number, string>();

        // Fill bytes with identifiable patterns based on fields
        let currentByte = 0;
        layout.fields.forEach((f: any, i: number) => {
            // Skip padding
            currentByte = f.start_offset;

            // Fill field with a consistent hex based on its index
            const val = 0x10 + (i % 15) * 0x10 + (f.id % 0x10);
            for (let b = 0; b < f.size; b++) {
                if (currentByte + b < bytes.length) {
                    bytes[currentByte + b] = val;
                    map.set(currentByte + b, f.name);
                }
            }
            currentByte += f.size;
        });

        const lines = [];
        for (let i = 0; i < bytes.length; i += 16) {
            lines.push({
                offset: i,
                bytes: bytes.slice(i, i + 16)
            });
        }
        return { hexLines: lines, byteToFieldMap: map };
    }, [layout]);

    const [hoveredByte, setHoveredByte] = React.useState<number | null>(null);

    return (
        <div className="w-full mt-6 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden font-mono text-xs shadow-inner">
            <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex justify-between">
                <h3 className="text-emerald-400 font-bold uppercase tracking-wider">Simulated Hex Dump</h3>
                <span className="text-slate-500">Bytes: {layout.total_size}</span>
            </div>

            <div className="p-4 overflow-x-auto max-h-[300px] overflow-y-auto">
                {hexLines.map((line, lineIdx) => (
                    <div key={lineIdx} className="flex hover:bg-slate-800/50 px-2 py-1 transition-colors">
                        {/* Offset */}
                        <div className="text-slate-500 w-16 select-none">
                            {line.offset.toString(16).padStart(8, '0')}
                        </div>

                        {/* Hex values */}
                        <div className="flex gap-2 mx-4 flex-1">
                            {line.bytes.map((byte, byteIdx) => {
                                const globalIndex = line.offset + byteIdx;
                                const fieldName = byteToFieldMap.get(globalIndex);
                                const isHovered = hoveredByte === globalIndex;
                                const hasValue = byte > 0;

                                return (
                                    <span
                                        key={byteIdx}
                                        onMouseEnter={() => setHoveredByte(globalIndex)}
                                        onMouseLeave={() => setHoveredByte(null)}
                                        title={fieldName ? `Field: ${fieldName}` : 'Padding/Empty'}
                                        className={`
                      px-1 rounded cursor-crosshair transition-all duration-75
                      ${byteIdx === 8 ? 'ml-2' : ''}
                      ${isHovered ? 'bg-emerald-500 text-white font-bold scale-110' : ''}
                      ${!isHovered && fieldName ? 'text-blue-400 hover:text-blue-300' : ''}
                      ${!isHovered && !fieldName ? 'text-slate-600' : ''}
                      ${hasValue && !isHovered && !fieldName ? 'text-slate-400' : ''}
                    `}
                                    >
                                        {byte.toString(16).padStart(2, '0').toUpperCase()}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Status Bar */}
            <div className="bg-slate-800 border-t border-slate-700 px-4 py-1 text-slate-400 flex justify-between">
                <span>Offset: {hoveredByte !== null ? `0x${hoveredByte.toString(16).padStart(4, '0')} (${hoveredByte})` : '--'}</span>
                <span>Field: {hoveredByte !== null && byteToFieldMap.get(hoveredByte) ? byteToFieldMap.get(hoveredByte) : 'None (Padding)'}</span>
            </div>
        </div>
    );
};
