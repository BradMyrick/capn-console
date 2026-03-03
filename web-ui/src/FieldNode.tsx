import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FieldNodeProps {
    id: string; // The dnd id, e.g., "field-0"
    field: any;
}

export const FieldNode: React.FC<FieldNodeProps> = ({ id, field }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items - center gap - 3 p - 3 bg - slate - 800 border border - slate - 700 rounded shadow - sm mb - 2 group ${isDragging ? 'ring-2 ring-emerald-500 shadow-lg' : 'hover:border-slate-500'
                } `}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 touch-none"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
            </div>

            <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="font-semibold text-slate-200 truncate">{field.name}</span>
                <span className="text-xs text-slate-500">@{field.id}</span>
            </div>

            <div className="text-sm font-mono text-blue-400">
                {field.field_type}
            </div>
        </div>
    );
};
