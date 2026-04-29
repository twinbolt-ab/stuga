/**
 * DragTest - Isolated test page for debugging ReorderableList drag behavior
 */

import { useState } from 'react'
import { ReorderableList } from '@/components/shared/ReorderableList'

interface TestItem {
  id: string
  name: string
  color: string
}

const initialItems: TestItem[] = [
  { id: '1', name: 'Item 1', color: 'bg-red-500' },
  { id: '2', name: 'Item 2', color: 'bg-blue-500' },
  { id: '3', name: 'Item 3', color: 'bg-green-500' },
  { id: '4', name: 'Item 4', color: 'bg-yellow-500' },
  { id: '5', name: 'Item 5', color: 'bg-purple-500' },
]

export function DragTest() {
  const [items, setItems] = useState(initialItems)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const addLog = (msg: string) => {
    setDebugLog((prev) => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  const handleReorder = (newItems: TestItem[]) => {
    addLog(`Reordered: ${newItems.map((i) => i.id).join(', ')}`)
    setItems(newItems)
  }

  const handleDragEnd = () => {
    addLog('Drag ended')
    setIsReorderMode(false)
  }

  return (
    <div className="min-h-screen bg-bg-primary p-4">
      <h1 className="text-xl font-bold mb-4">Drag Test Page</h1>

      {/* Toggle button */}
      <button
        onClick={() => {
          setIsReorderMode(!isReorderMode)
          addLog(isReorderMode ? 'Exited reorder mode' : 'Entered reorder mode')
        }}
        className="mb-4 px-4 py-2 bg-accent text-white rounded-lg"
      >
        {isReorderMode ? 'Exit Reorder Mode' : 'Enter Reorder Mode'}
      </button>

      {/* Simple list without ReorderableList for comparison */}
      {!isReorderMode && (
        <div className="space-y-2 mb-8">
          <p className="text-sm text-muted mb-2">Normal list (tap button above to reorder)</p>
          {items.map((item) => (
            <div key={item.id} className={`${item.color} p-4 rounded-lg text-white font-medium`}>
              {item.name}
            </div>
          ))}
        </div>
      )}

      {/* ReorderableList */}
      {isReorderMode && (
        <div className="mb-8">
          <p className="text-sm text-muted mb-2">Reorderable list - drag items to reorder</p>
          <ReorderableList
            items={items}
            getKey={(item) => item.id}
            onReorder={handleReorder}
            onDragEnd={handleDragEnd}
            renderItem={(item, _index, isDragging) => (
              <div
                className={`${item.color} p-4 rounded-lg text-white font-medium ${
                  isDragging ? 'opacity-80' : ''
                }`}
                style={{ touchAction: 'none' }}
              >
                {item.name} {isDragging && '(dragging)'}
              </div>
            )}
          />
        </div>
      )}

      {/* Debug log */}
      <div className="mt-8 p-4 bg-card rounded-lg">
        <h2 className="font-bold mb-2">Debug Log</h2>
        <div className="text-xs font-mono space-y-1">
          {debugLog.length === 0 && <p className="text-muted">No events yet</p>}
          {debugLog.map((log, i) => (
            <p key={i}>{log}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
