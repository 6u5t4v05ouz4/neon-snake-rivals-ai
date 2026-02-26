import React, { useRef, useCallback } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';

export interface PanelPosition {
    x: number;
    y: number;
}

interface DraggablePanelProps {
    id: string;
    children: React.ReactNode;
    defaultPosition: PanelPosition;
    onPositionChange: (id: string, pos: PanelPosition) => void;
    getPanelRects: (excludeId: string) => DOMRect[];
    className?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
}

const DraggablePanel: React.FC<DraggablePanelProps> = ({
    id,
    children,
    defaultPosition,
    onPositionChange,
    getPanelRects,
    className = '',
    style = {},
    disabled = false,
}) => {
    const nodeRef = useRef<HTMLDivElement>(null);

    const checkCollision = useCallback((myRect: DOMRect, otherRects: DOMRect[]): boolean => {
        for (const other of otherRects) {
            const GAP = 4;
            if (
                myRect.left < other.right + GAP &&
                myRect.right > other.left - GAP &&
                myRect.top < other.bottom + GAP &&
                myRect.bottom > other.top - GAP
            ) {
                return true;
            }
        }
        return false;
    }, []);

    const handleDrag = useCallback((_e: DraggableEvent, data: DraggableData) => {
        if (!nodeRef.current) return;

        const el = nodeRef.current;
        const rect = el.getBoundingClientRect();
        const proposedRect = new DOMRect(
            rect.left + data.deltaX,
            rect.top + data.deltaY,
            rect.width,
            rect.height
        );

        // Viewport bounds
        if (
            proposedRect.left < 0 ||
            proposedRect.top < 0 ||
            proposedRect.right > window.innerWidth ||
            proposedRect.bottom > window.innerHeight
        ) {
            return false;
        }

        // Collision with other panels
        const otherRects = getPanelRects(id);
        if (checkCollision(proposedRect, otherRects)) {
            return false;
        }
    }, [id, getPanelRects, checkCollision]);

    const handleStop = useCallback((_e: DraggableEvent, data: DraggableData) => {
        onPositionChange(id, { x: data.x, y: data.y });
    }, [id, onPositionChange]);

    // Disable drag on mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (isMobile || disabled) {
        return (
            <div className={className} style={{ position: 'fixed', left: defaultPosition.x, top: defaultPosition.y, ...style }}>
                {children}
            </div>
        );
    }

    return (
        <Draggable
            nodeRef={nodeRef as React.RefObject<HTMLElement>}
            handle=".drag-handle"
            defaultPosition={defaultPosition}
            onDrag={handleDrag}
            onStop={handleStop}
        >
            <div
                ref={nodeRef}
                className={`${className} group`}
                style={{ position: 'fixed', left: 0, top: 0, ...style }}
            >
                {/* Drag handle — visible on hover */}
                <div className="drag-handle flex items-center justify-center cursor-grab active:cursor-grabbing py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex gap-[3px]">
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                        <div className="w-1 h-1 rounded-full bg-slate-500" />
                    </div>
                </div>
                {children}
            </div>
        </Draggable>
    );
};

export default DraggablePanel;
